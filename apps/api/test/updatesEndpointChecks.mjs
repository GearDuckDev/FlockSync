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
const { createReleaseCatalog } = await import("../dist/services/releaseCatalog.js");
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
  assert.equal(cold.json().authorizedCollectorGuild, undefined, "Legacy desktops must not receive a new field");
  const collectorGuild = { name: "Guild", realm: "Test" };
  for (const role of ["ADMIN", "OFFICER", "MEMBER"]) {
    const grant = await call("/api/sync", role, {
      method: "POST",
      payload: { addonVersion: "test", officerCharacter: character, characters: [],
        exportedAt: 1, collectorGuild }
    });
    assert.equal(grant.statusCode, role === "MEMBER" ? 403 : 200);
    if (role !== "MEMBER") {
      assert.deepEqual(ServerReturnPayloadSchema.parse(grant.json()).authorizedCollectorGuild, collectorGuild);
    }
  }
  const invalidGuild = await call("/api/sync", "ADMIN", {
    method: "POST",
    payload: { addonVersion: "test", officerCharacter: character, characters: [], exportedAt: 1,
      collectorGuild: { name: "Guild", realm: "OtherRealm" } }
  });
  assert.equal(invalidGuild.statusCode, 400);
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
  const combinedManifest = {
    schemaVersion: 1, releaseVersion: "99.0.0",
    components: {
      desktop: { version: currentServerVersion, assets: [`FlockSync-Setup-${currentServerVersion}-x64.exe`] },
      server: { version: currentServerVersion, assets: ["server.tar.gz"] },
      addon: { version: "0.3.2-beta", assets: ["FlockSync.zip"] },
      helper: { version: "0.2.1-beta", assets: ["FlockSync_AppHelper.zip"] }
    }
  };
  const combinedCatalog = createReleaseCatalog({
    repository: "GearDuckDev/FlockSync",
    fetcher: async (url) => new Response(JSON.stringify(url.includes("/releases/download/") ? combinedManifest : [{
      tag_name: "v99.0.0",
      html_url: "https://github.com/GearDuckDev/FlockSync/releases/tag/v99.0.0",
      draft: false, prerelease: false,
      assets: [
        { name: "flocksync-release.json" },
        ...Object.values(combinedManifest.components).flatMap((entry) => entry.assets.map((name) => ({ name })))
      ]
    }]))
  });
  const combinedList = await combinedCatalog.list();
  releaseCatalog.list = async () => combinedList;
  for (const role of ["ADMIN", "OFFICER", "MEMBER"]) {
    const unchanged = await call("/api/updates/server?channel=beta", role);
    assert.equal(unchanged.statusCode, 200);
    assert.equal(unchanged.json().latest.version, currentServerVersion);
    assert.equal(unchanged.json().updateAvailable, false, "a newer overall tag is not a server update");
  }
  assert.equal(combinedCatalog.cachedAddonReleases(assert.fail).beta.version, "0.3.2-beta");
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
