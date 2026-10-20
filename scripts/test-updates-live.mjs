import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, writeFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  compareReleaseVersions, selectLatestRelease
} from "../packages/shared-types/dist/index.js";
import { createReleaseCatalog } from "../apps/api/dist/services/releaseCatalog.js";

// Opt-in integration check: build the two :update-verification images before running.
const repository = "GearDuckDev/FlockSync";
const root = resolve(import.meta.dirname, "..");
const statePath = process.argv[2];
const directory = await mkdtemp(join(tmpdir(), "flocksync-live-updates-"));
const containers = [];
let network;
const run = (...args) => {
  const result = spawnSync("docker", args, { encoding: "utf8", timeout: 120_000 });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
};
const request = async (origin, path, token, payload) => {
  const response = await fetch(`${origin}${path}`, {
    method: payload ? "POST" : "GET",
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(payload ? { "content-type": "application/json" } : {})
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
    signal: AbortSignal.timeout(30_000)
  });
  return { status: response.status, body: await response.json() };
};
const ready = async (origin) => {
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(`${origin}/health`)).ok) return; } catch { /* Startup is bounded below. */ }
    await delay(200);
  }
  throw new Error(`Container did not become healthy: ${origin}`);
};

try {
  const catalog = createReleaseCatalog({ repository, timeoutMs: 30_000 });
  const releases = await catalog.list();
  const manifest = releases.find((release) => release.manifest)?.manifest;
  assert.ok(manifest, "Published combined manifest must load");
  assert.ok(Object.values(manifest.components).every((entry) => /-beta(?:\.\d+)?$/.test(entry.version)),
    "This live regression matrix expects the published beta bundle");
  console.log(`LIVE GitHub manifest: v${manifest.releaseVersion}`);
  const matrix = [];
  for (const component of ["desktop", "server", "addon"]) {
    const remote = manifest.components[component].version;
    const [base] = remote.split("-");
    const [major, minor, patch] = base.split(".").map(Number);
    const older = `${major}.${minor}.${Math.max(0, patch - 1)}-beta`;
    const newer = `${major}.${minor}.${patch + 1}-beta`;
    for (const [label, local] of [["older", older], ["current", remote], ["newer", newer]]) {
      for (const channel of ["release", "beta", "alpha"]) {
        const latest = selectLatestRelease(releases, component, channel);
        const update = latest !== null && compareReleaseVersions(latest.version, local) > 0;
        const expected = label === "older" && channel !== "release";
        assert.equal(update, expected, `${component} ${label} ${channel}`);
        matrix.push({ component, local, channel, update });
      }
    }
  }
  console.log(`LIVE manifest comparison matrix: ${matrix.length} cases passed`);
  const password = randomBytes(24).toString("hex");
  const current = JSON.parse(await readFile(join(root, "apps", "api", "package.json"), "utf8"));
  const remoteVersion = manifest.components.server.version;
  const [major, minor, patch] = remoteVersion.split("-")[0].split(".").map(Number);
  const scenarios = [
    ["older", `${major}.${minor}.${Math.max(0, patch - 1)}-beta`, true],
    ["current", remoteVersion, false],
    ["newer", `${major}.${minor}.${patch + 1}-beta`, false]
  ];
  network = run("network", "create", `flocksync-updates-${randomBytes(5).toString("hex")}`);
  const browser = [];
  for (const [name, version, expected] of scenarios) {
    const packageFile = join(directory, `${name}-package.json`);
    await writeFile(packageFile, JSON.stringify({ ...current, version }));
    const id = run("run", "--rm", "-d", "--network", network, "--network-alias", `api-${name}`,
      "-p", "127.0.0.1::3001", "--mount", `type=bind,source=${packageFile},target=/app/package.json,readonly`,
      "-e", "DATABASE_URL=/app/data/flocksync.db", "-e", `JWT_SECRET=${randomBytes(32).toString("hex")}`,
      "-e", "INITIAL_ADMIN_EMAIL=admin@example.test", "-e", `INITIAL_ADMIN_PASSWORD=${password}`,
      "-e", `GITHUB_REPOSITORY=${repository}`, "flocksync-api:update-verification");
    containers.push(id);
    const origin = `http://${run("port", id, "3001/tcp")}`;
    await ready(origin);
    const admin = await request(origin, "/api/auth/login", null, { email: "admin@example.test", password });
    assert.equal(admin.status, 200);
    const member = await request(origin, "/api/auth/register", null,
      { email: "member@example.test", username: "Test Member", password });
    assert.equal(member.status, 201);
    assert.equal((await request(origin, "/api/updates/server?channel=beta")).status, 401);
    const token = admin.body.token;
    const created = await request(origin, "/api/users", token,
      { email: "officer@example.test", username: "Test Officer", password, role: "OFFICER" });
    assert.equal(created.status, 201);
    const officer = await request(origin, "/api/auth/login", null, { email: "officer@example.test", password });
    assert.equal(officer.status, 200);
    for (const [role, roleToken] of [["ADMIN", token], ["MEMBER", member.body.token], ["OFFICER", officer.body.token]]) {
      for (const channel of ["release", "beta", "alpha"]) {
        const result = await request(origin, `/api/updates/server?channel=${channel}`, roleToken);
        assert.equal(result.status, 200, JSON.stringify(result.body));
        assert.equal(result.body.currentVersion, version);
        assert.equal(result.body.updateAvailable, expected && channel !== "release", `${name} ${role} ${channel}`);
      }
    }
    assert.equal((await request(origin, "/api/updates/server?channel=nope", token)).status, 400);
    const character = {
      guid: "Player-UpdateTest", name: "Update Test", realm: "Test", classId: 1, level: 60,
      isActive: true, role: { primaryRole: "DPS", offSpecEnabled: false, updatedAt: 1 },
      gear: { items: [], updatedAt: 1 }, lastSeenAt: 1
    };
    const synced = await request(origin, "/api/sync", officer.body.token, {
      addonVersion: manifest.components.addon.version, officerCharacter: character,
      characters: [], exportedAt: 1
    });
    assert.equal(synced.status, 200);
    assert.equal(synced.body.addonReleases.beta.version, manifest.components.addon.version);
    assert.equal(synced.body.addonReleases.release, undefined);
    console.log(`DOCKER ${name} server ${version}: all roles/channels, auth, invalid query and addon sync passed`);
    const webId = run("run", "--rm", "-d", "--network", network, "-p", "127.0.0.1::80",
      "flocksync-web:update-verification");
    containers.push(webId);
    // Use the built nginx configuration, replacing only its API DNS target in the test container.
    run("exec", webId, "sh", "-c",
      `sed -i 's/http:\\/\\/api:3001/http:\\/\\/api-${name}:3001/' /etc/nginx/conf.d/default.conf && nginx -s reload`);
    const webOrigin = `http://${run("port", webId, "80/tcp")}`;
    await ready(webOrigin);
    assert.equal((await request(webOrigin, "/api/updates/server?channel=beta", member.body.token)).body.updateAvailable, expected);
    browser.push({ name, version, origin: webOrigin, memberToken: member.body.token, adminToken: token, expected });
  }
  if (statePath) {
    await writeFile(statePath, JSON.stringify({ browser, matrix, addonReleases: catalog.cachedAddonReleases(assert.fail) }));
    console.log("Browser fixtures ready; waiting for completion marker (maximum 10 minutes).");
    let completed = false;
    for (let attempt = 0; attempt < 1200; attempt++) {
      try { await access(`${statePath}.done`); completed = true; break; } catch { await delay(500); }
    }
    assert.ok(completed, "Browser verification did not finish within its time limit");
  }
} finally {
  for (const id of containers.reverse()) run("rm", "-f", id);
  if (network) run("network", "rm", network);
  await rm(directory, { recursive: true, force: true });
  if (statePath) {
    await rm(statePath, { force: true });
    await rm(`${statePath}.done`, { force: true });
  }
}
