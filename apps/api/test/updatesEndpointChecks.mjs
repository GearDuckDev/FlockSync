import assert from "node:assert/strict";
import Fastify from "fastify";
import { setImmediate as tick } from "node:timers/promises";
import { ServerReturnPayloadSchema } from "@flocksync/shared-types";

let completeFetch;
let failFetch;
let requests = 0;
let clock = Date.now();
Date.now = () => clock;
globalThis.fetch = () => {
  requests++;
  return new Promise((resolve, reject) => { completeFetch = resolve; failFetch = reject; });
};
const { registerAuthPlugin } = await import("../dist/plugins/auth.js");
const { createUser } = await import("../dist/services/users.service.js");
const { updatesRoutes } = await import("../dist/routes/updates.routes.js");
const { syncRoutes } = await import("../dist/routes/sync.routes.js");
const { releaseCatalog } = await import("../dist/services/releases.service.js");
const { currentServerVersion } = await import("../dist/config/version.js");
const app = Fastify();
await registerAuthPlugin(app);
await app.register(updatesRoutes, { prefix: "/api" });
await app.register(syncRoutes, { prefix: "/api" });

const tokens = {};
for (const role of ["ADMIN", "OFFICER", "MEMBER"]) {
  const result = await createUser({
    email: `${role}@example.com`, username: role, password: "test-only-password", role
  });
  assert.equal(result.ok, true);
  const { id, email, username } = result.user;
  tokens[role] = app.jwt.sign({ id, email, username, role });
}
const call = (url, role, extra = {}) => app.inject({
  method: "GET", url, ...extra,
  headers: role ? { authorization: `Bearer ${tokens[role]}` } : {}
});
try {
  for (const url of ["/api/updates/server", "/api/updates/server/version"]) {
    assert.equal((await call(url)).statusCode, 401);
  }
  assert.equal(requests, 0);
  for (const query of ["channel=nope", "channel=release&channel=beta", "extra=1", "channel="]) {
    assert.equal((await call(`/api/updates/server?${query}`, "ADMIN")).statusCode, 400);
  }
  assert.equal(requests, 0);
  const version = await call("/api/updates/server/version", "ADMIN");
  assert.equal(version.statusCode, 200);
  assert.equal(version.json().currentVersion, currentServerVersion);
  const character = {
    guid: "update-test-officer", name: "Officer", realm: "Test", classId: 1, level: 60,
    isActive: true, role: { primaryRole: "DPS", offSpecEnabled: false, updatedAt: 1 },
    gear: { items: [], updatedAt: 1 }, lastSeenAt: 1
  };
  const sync = () => call("/api/sync", "OFFICER", {
    method: "POST",
    payload: { addonVersion: "test", officerCharacter: character, characters: [], exportedAt: 1 }
  });
  const cold = await sync();
  assert.equal(cold.statusCode, 200);
  assert.equal(cold.json().addonReleases, undefined);
  assert.equal(requests, 1);
  failFetch(new Error("GitHub offline"));
  await tick();
  const unavailable = await sync();
  assert.equal(unavailable.statusCode, 200);
  assert.equal(unavailable.json().addonReleases, undefined);
  assert.equal(requests, 1);
  clock += 61_000;
  const retrying = await sync();
  assert.equal(retrying.statusCode, 200);
  assert.equal(retrying.json().addonReleases, undefined);
  assert.equal(requests, 2);
  completeFetch(new Response(JSON.stringify([
    {
      tag_name: "addon-v1.0.0", html_url: "https://github.com/GearDuckDev/FlockSync/releases/tag/addon-v1.0.0",
      draft: false, prerelease: false, assets: []
    },
    {
      tag_name: "server-v1.0.0", html_url: "https://github.com/GearDuckDev/FlockSync/releases/tag/server-v1.0.0",
      draft: false, prerelease: false, assets: []
    }
  ])));
  await tick();
  const warm = await sync();
  assert.equal(warm.statusCode, 200);
  assert.equal(ServerReturnPayloadSchema.parse(warm.json()).addonReleases.release.version, "1.0.0");
  assert.equal(warm.json().addonReleases.alpha, undefined);
  const status = await call("/api/updates/server", "ADMIN");
  assert.equal(status.statusCode, 200);
  assert.equal(status.json().channel, "release");
  assert.equal(status.json().updateAvailable, true);
  assert.equal(status.json().latest.version, "1.0.0");
  for (const role of ["MEMBER", "OFFICER"]) {
    const notice = await call("/api/updates/server", role);
    assert.equal(notice.statusCode, 200, `${role} can read the update banner status`);
    assert.equal(notice.json().updateAvailable, true);
    assert.equal(notice.json().latest.version, "1.0.0");
    assert.equal((await call("/api/updates/server/version", role)).statusCode, 200);
  }
  assert.equal(requests, 2);
  for (const channel of ["alpha", "beta"]) {
    assert.equal((await call(`/api/updates/server?channel=${channel}`, "ADMIN")).json().channel, channel);
  }
  const originalList = releaseCatalog.list;
  releaseCatalog.list = async () => [];
  const empty = await call("/api/updates/server", "ADMIN");
  assert.equal(empty.json().latest, null);
  assert.equal(empty.json().updateAvailable, false);
  releaseCatalog.list = async () => { throw new Error("GitHub unavailable"); };
  const failed = await call("/api/updates/server", "ADMIN");
  assert.equal(failed.statusCode, 503);
  assert.match(failed.json().error, /GitHub unavailable/);
  assert.equal(failed.json().updateAvailable, undefined);
  releaseCatalog.list = originalList;
} finally {
  await app.close();
}
