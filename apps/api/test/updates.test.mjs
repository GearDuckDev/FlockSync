import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { setImmediate as tick } from "node:timers/promises";
import { test } from "node:test";
import { selectLatestRelease } from "@flocksync/shared-types";
import { createReleaseCatalog } from "../dist/services/releaseCatalog.js";
import "./combinedReleaseChecks.mjs";

const release = (tag, extra = {}) => ({
  tag_name: tag, html_url: `https://github.com/GearDuckDev/FlockSync/releases/tag/${tag}`,
  draft: false, prerelease: /-(alpha|beta)/.test(tag), body: "Release notes", assets: [], ...extra
});
const json = (value, init) => new Response(JSON.stringify(value), init);
const repository = "GearDuckDev/FlockSync";

test("paginated release fetch is validated, deduplicated, cached, and refreshed after TTL", async () => {
  let now = 0;
  const urls = [];
  const catalog = createReleaseCatalog({
    repository, now: () => now, ttlMs: 10,
    fetcher: async (url) => {
      urls.push(url);
      return String(url).endsWith("page=1")
        ? json([release("desktop-v9.0.0")], { headers: { link: '<ignored>; rel="next"' } })
        : json([release("server-v1.0.0")]);
    }
  });
  const results = await Promise.all([catalog.list(), catalog.list()]);
  assert.strictEqual(results[0], results[1]);
  assert.equal(urls.length, 2);
  assert.match(urls[1], /per_page=100&page=2$/);
  assert.equal(selectLatestRelease(results[0], "server", "release").version, "1.0.0");
  await catalog.list();
  assert.equal(urls.length, 2);
  now = 11;
  await catalog.list();
  assert.equal(urls.length, 4);
});

test("inclusive server channel selection and exact-channel addon catalogs", async () => {
  const releases = [
    release("server-v1.0.0"), release("server-v2.0.0-beta.2"), release("server-v3.0.0-alpha.1"),
    release("server-v99.0.0", { draft: true }),
    release("server-v98.0.0-beta.1", { prerelease: false }),
    release("addon-v3.0.0"), release("addon-v2.0.0-beta.2"), release("addon-v1.0.0-alpha.3"),
    release("desktop-v999.0.0")
  ];
  const catalog = createReleaseCatalog({ repository, fetcher: async () => json(releases) });
  const list = await catalog.list();
  for (const [channel, expected] of [
    ["release", "1.0.0"], ["beta", "2.0.0-beta.2"], ["alpha", "3.0.0-alpha.1"]
  ]) assert.equal(selectLatestRelease(list, "server", channel).version, expected);
  const addons = catalog.cachedAddonReleases(assert.fail);
  assert.deepEqual(Object.fromEntries(Object.entries(addons).map(([key, value]) => [key, value.version])), {
    release: "3.0.0", beta: "2.0.0-beta.2", alpha: "1.0.0-alpha.3"
  });
});

test("missing addon channels are omitted, never synthesized from a stable release", async () => {
  const catalog = createReleaseCatalog({
    repository, fetcher: async () => json([release("addon-v1.0.0")])
  });
  await catalog.list();
  assert.deepEqual(Object.keys(catalog.cachedAddonReleases(assert.fail)), ["release"]);
});

test("GitHub failures have a retry cooldown and never return stale success", async () => {
  let now = 0;
  let calls = 0;
  const catalog = createReleaseCatalog({
    repository, now: () => now, ttlMs: 10, failureTtlMs: 20,
    fetcher: async () => ++calls === 1 ? json([]) : json({}, { status: 403 })
  });
  await catalog.list();
  now = 11;
  await assert.rejects(catalog.list(), /HTTP 403/);
  await assert.rejects(catalog.list(), /HTTP 403/);
  assert.equal(calls, 2);
  assert.equal(catalog.cachedAddonReleases(assert.fail), undefined);
  now = 32;
  await assert.rejects(catalog.list(), /HTTP 403/);
  assert.equal(calls, 3);
});

test("malformed, failed network, and truncated responses explicitly fail", async () => {
  for (const fetcher of [
    async () => json({ invalid: true }),
    async () => { throw new Error("Network unavailable"); },
    async () => json([release("server-v1.0.0")], { headers: { link: '<ignored>; rel="next"' } }),
    async () => json(Array.from({ length: 100 }, () => release("server-v1.0.0")))
  ]) {
    const catalog = createReleaseCatalog({ repository, maxPages: 1, fetcher });
    await assert.rejects(catalog.list(), /invalid|Network unavailable|pagination limit/);
  }
});

test("timeouts abort the entire release operation", async () => {
  const catalog = createReleaseCatalog({
    repository, timeoutMs: 10,
    fetcher: async (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    })
  });
  // AbortSignal.timeout does not itself keep the event loop alive.
  const hold = setTimeout(() => {}, 1000);
  try { await assert.rejects(catalog.list(), /timed out/); } finally { clearTimeout(hold); }
});

test("sync metadata refresh is non-blocking, deduplicated, and warns without throwing", async () => {
  let rejectFetch;
  let calls = 0;
  const warnings = [];
  const catalog = createReleaseCatalog({
    repository,
    fetcher: () => {
      calls++;
      return new Promise((_resolve, reject) => { rejectFetch = reject; });
    }
  });
  assert.equal(catalog.cachedAddonReleases((error) => warnings.push(error)), undefined);
  assert.equal(catalog.cachedAddonReleases(assert.fail), undefined);
  assert.equal(calls, 1);
  rejectFetch(new Error("Offline"));
  await tick();
  assert.equal(warnings.length, 1);
  assert.equal(catalog.cachedAddonReleases(assert.fail), undefined);
  assert.equal(calls, 1);
});

test("JWT guards, update notices for every role, query/status, and optional metadata on sync", () => {
  const directory = mkdtempSync(resolve("test", ".updates-"));
  try {
    const result = spawnSync(process.execPath, [resolve("test/updatesEndpointChecks.mjs")], {
      env: {
        ...process.env, DATABASE_URL: join(directory, "test.db"),
        JWT_SECRET: "test-only-update-check-jwt-secret-123456",
        INITIAL_ADMIN_EMAIL: "", INITIAL_ADMIN_PASSWORD: "",
        GITHUB_REPOSITORY: repository
      },
      encoding: "utf8", timeout: 30_000
    });

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}\n${result.error ?? ""}`);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("release repository is validated on startup and defaults to GearDuckDev/FlockSync", () => {
  const environment = {
    ...process.env, DATABASE_URL: "./test/unused.db",
    JWT_SECRET: "test-only-update-check-jwt-secret-123456",
    INITIAL_ADMIN_EMAIL: "", INITIAL_ADMIN_PASSWORD: ""
  };
  for (const value of ["https://github.com/owner/repo", "owner/repo/extra", "owner/..", "owner\\repo"]) {
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", "await import('./dist/config/env.js')"], {
      env: { ...environment, GITHUB_REPOSITORY: value }, encoding: "utf8"
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /GITHUB_REPOSITORY/);
  }
  delete environment.GITHUB_REPOSITORY;
  const result = spawnSync(process.execPath, [
    "--input-type=module", "-e",
    "const { env } = await import('./dist/config/env.js'); console.log(env.GITHUB_REPOSITORY)"
  ], { env: environment, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /GearDuckDev\/FlockSync/);
});
