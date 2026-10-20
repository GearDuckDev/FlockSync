import assert from "node:assert/strict";
import { test } from "node:test";
import { compareReleaseVersions, selectLatestRelease } from "@flocksync/shared-types";
import { createReleaseCatalog } from "../dist/services/releaseCatalog.js";

const repository = "GearDuckDev/FlockSync";
const manifest = (releaseVersion, addonVersion = "0.3.1-beta") => ({
  schemaVersion: 1, releaseVersion,
  components: {
    desktop: { version: "0.2.1-beta", assets: ["FlockSync-Setup-0.2.1-beta-x64.exe"] },
    server: { version: "0.2.1-beta", assets: ["server.tar.gz"] },
    addon: { version: addonVersion, assets: ["FlockSync.zip"] },
    helper: { version: "0.2.1-beta", assets: ["FlockSync_AppHelper.zip"] }
  }
});
const release = (value) => ({
  tag_name: `v${value.releaseVersion}`,
  html_url: `https://github.com/${repository}/releases/tag/v${value.releaseVersion}`,
  draft: false, prerelease: value.releaseVersion.includes("-"),
  assets: [
    { name: "flocksync-release.json" },
    ...Object.values(value.components).flatMap((entry) => entry.assets.map((name) => ({ name })))
  ]
});
const json = (value, init) => new Response(JSON.stringify(value), init);

test("combined releases load after pagination with one deadline and cache independent component versions", async () => {
  const value = manifest("1.0.0-beta");
  const requests = [];
  const catalog = createReleaseCatalog({
    repository,
    fetcher: async (url, init) => {
      requests.push({ url, signal: init.signal });
      if (url.includes("/releases/download/")) return json(value);
      return url.endsWith("page=1")
        ? json([], { headers: { link: '<ignored>; rel="next"' } })
        : json([release(value)]);
    }
  });
  const list = await catalog.list();
  assert.equal(requests.length, 3);
  assert.equal(requests[2].url,
    `https://github.com/${repository}/releases/download/v1.0.0-beta/flocksync-release.json`);
  assert.ok(requests[0].signal);
  assert.ok(requests.every((request) => request.signal === requests[0].signal));
  for (const [component, version] of [["desktop", "0.2.1-beta"], ["server", "0.2.1-beta"], ["addon", "0.3.1-beta"]]) {
    assert.equal(selectLatestRelease(list, component, "beta").version, version);
    assert.equal(selectLatestRelease(list, component, "release"), null);
  }
  const addons = catalog.cachedAddonReleases(assert.fail);
  assert.deepEqual(Object.keys(addons), ["beta"]);
  assert.equal(addons.beta.version, "0.3.1-beta");
  assert.strictEqual(await catalog.list(), list);
  assert.equal(requests.length, 3);
});

test("new overall release tags only notify components whose own version changed", async () => {
  const older = manifest("1.0.0-beta");
  const newer = manifest("2.0.0", "0.3.2-alpha");
  const catalog = createReleaseCatalog({
    repository,
    fetcher: async (url) => {
      if (url.includes("/releases/download/v1.")) return json(older);
      if (url.includes("/releases/download/v2.")) return json(newer);
      return json([release(newer), release(older)]);
    }
  });
  const list = await catalog.list();
  for (const component of ["desktop", "server"]) {
    const latest = selectLatestRelease(list, component, "alpha");
    assert.equal(latest.version, "0.2.1-beta");
    assert.equal(compareReleaseVersions(latest.version, "0.2.1-beta") > 0, false);
    assert.equal(selectLatestRelease(list, component, "release"), null, "overall stable tag cannot promote beta components");
  }
  const addons = catalog.cachedAddonReleases(assert.fail);
  assert.deepEqual(Object.keys(addons), ["beta", "alpha"]);
  assert.equal(addons.beta.version, "0.3.1-beta");
  assert.equal(addons.alpha.version, "0.3.2-alpha");
  assert.ok(compareReleaseVersions(addons.alpha.version, "0.3.1-beta") > 0);
});

test("combined releases without a manifest or component assets cannot advertise that component", async () => {
  const value = manifest("1.0.0-beta");
  for (const missing of ["flocksync-release.json", "server.tar.gz", "FlockSync.zip", "FlockSync-Setup-0.2.1-beta-x64.exe"]) {
    const incomplete = release(value);
    incomplete.assets = incomplete.assets.filter((asset) => asset.name !== missing);
    const catalog = createReleaseCatalog({
      repository, fetcher: async (url) => json(url.includes("/releases/download/") ? value : [incomplete])
    });
    const list = await catalog.list();
    const affected = missing === "flocksync-release.json" ? ["desktop", "server", "addon"]
      : [missing === "server.tar.gz" ? "server" : missing === "FlockSync.zip" ? "addon" : "desktop"];
    for (const component of affected) assert.equal(selectLatestRelease(list, component, "alpha"), null);
    if (affected.includes("addon")) assert.deepEqual(catalog.cachedAddonReleases(assert.fail), {});
  }
});

test("manifest download, JSON, schema, and tag mismatch failures are explicit and cached", async () => {
  const value = manifest("1.0.0-beta");
  for (const [response, message] of [
    [() => json({}, { status: 503 }), /manifest.*HTTP 503/i],
    [() => new Response("invalid-json"), /JSON|Unexpected token/i],
    [() => json({ ...value, schemaVersion: 2 }), /schemaVersion/],
    [() => json({ ...value, releaseVersion: "9.0.0-beta" }), /does not match/]
  ]) {
    let requests = 0;
    const catalog = createReleaseCatalog({
      repository,
      fetcher: async (url) => {
        requests++;
        return url.includes("/releases/download/") ? response() : json([release(value)]);
      }
    });
    await assert.rejects(catalog.list(), message);
    await assert.rejects(catalog.list(), message);
    assert.equal(requests, 2);
    assert.equal(catalog.cachedAddonReleases(assert.fail), undefined);
  }
});

test("manifest requests remain subject to the total release deadline", async () => {
  const catalog = createReleaseCatalog({
    repository, timeoutMs: 10,
    fetcher: async (url, { signal }) => {
      if (!url.includes("/releases/download/")) return json([release(manifest("1.0.0-beta"))]);
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    }
  });
  const hold = setTimeout(() => {}, 1000);
  try { await assert.rejects(catalog.list(), /timed out/); } finally { clearTimeout(hold); }
});
