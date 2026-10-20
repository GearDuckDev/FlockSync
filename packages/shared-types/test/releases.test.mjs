import assert from "node:assert/strict";
import { test } from "node:test";
import {
  compareReleaseVersions, selectLatestRelease, ReleaseVersionSchema,
  UpdateCheckQuerySchema, ServerReturnPayloadSchema, ReleaseInfoSchema, loadReleaseManifests
} from "../dist/index.js";

const release = (component, version, overrides = {}) => ({
  tag_name: `${component}-v${version}`,
  html_url: `https://github.com/GearDuckDev/FlockSync/releases/tag/${component}-v${version}`,
  draft: false,
  prerelease: version.includes("-"),
  assets: component === "desktop" ? [{ name: `FlockSync-Setup-${version}-x64.exe` }] : [],
  ...overrides
});

const combined = (overall, desktop, server, addon) => ({
  ...release("unused", overall),
  tag_name: `v${overall}`,
  assets: [
    { name: "flocksync-release.json" },
    { name: `FlockSync-Setup-${desktop}-x64.exe` },
    { name: "server.zip" }, { name: "addon.zip" }
  ],
  manifest: {
    schemaVersion: 1, releaseVersion: overall,
    components: {
      desktop: { version: desktop, assets: [`FlockSync-Setup-${desktop}-x64.exe`] },
      server: { version: server, assets: ["server.zip"] },
      addon: { version: addon, assets: ["addon.zip"] },
      helper: { version: "0.2.1-beta", assets: ["addon.zip"] }
    }
  }
});

test("combined releases compare each component, not the overall tag", () => {
  const before = combined("0.3.1-beta", "0.2.1-beta", "0.2.1-beta", "0.3.1-beta");
  const after = combined("0.3.2-beta", "0.2.1-beta", "0.2.1-beta", "0.3.2-beta");
  for (const component of ["desktop", "server"]) {
    assert.equal(selectLatestRelease([after, before], component, "beta")?.version, "0.2.1-beta");
    assert.equal(compareReleaseVersions(selectLatestRelease([after], component, "beta").version, "0.2.1-beta"), 0);
  }
  assert.equal(selectLatestRelease([after, before], "addon", "beta")?.version, "0.3.2-beta");
  assert.equal(selectLatestRelease([after], "addon", "release"), null);
  const missing = { ...after, assets: [] };
  assert.equal(selectLatestRelease([missing], "server", "beta"), null);
  const mixed = combined("0.4.0-beta", "0.2.1", "0.2.1-beta", "0.3.2-beta");
  assert.equal(selectLatestRelease([mixed], "desktop", "release")?.version, "0.2.1");
  assert.equal(selectLatestRelease([mixed], "server", "release"), null);
  const changedServer = combined("0.3.3-beta", "0.2.1-beta", "0.2.2-beta", "0.3.2-beta");
  assert.equal(selectLatestRelease([changedServer, after], "server", "beta")?.version, "0.2.2-beta");
  assert.equal(selectLatestRelease([{ ...after, tag_name: "v9.0.0-beta" }], "desktop", "beta"), null);
});

test("combined manifest loader validates tag, schema and download failure", async () => {
  const hydrated = combined("0.3.1-beta", "0.2.1-beta", "0.2.1-beta", "0.3.1-beta");
  const { manifest, ...raw } = hydrated;
  const calls = [];
  const fetcher = async (url) => { calls.push(url); return new Response(JSON.stringify(manifest)); };
  const signal = AbortSignal.timeout(5000);
  const result = await loadReleaseManifests([raw], "GearDuckDev/FlockSync", fetcher, signal);
  assert.deepEqual(result[0].manifest, manifest);
  assert.equal(calls[0], "https://github.com/GearDuckDev/FlockSync/releases/download/v0.3.1-beta/flocksync-release.json");
  await assert.rejects(loadReleaseManifests([raw], "GearDuckDev/FlockSync",
    async () => new Response("not found", { status: 404 }), signal), /download failed/);
  await assert.rejects(loadReleaseManifests([raw], "GearDuckDev/FlockSync",
    async () => new Response(JSON.stringify({ ...manifest, releaseVersion: "9.0.0" })), signal), /does not match/);
  await assert.rejects(loadReleaseManifests([raw], "GearDuckDev/FlockSync",
    async () => new Response(JSON.stringify({ schemaVersion: 999 })), signal));
  const noManifest = { ...raw, assets: [] };
  const ignored = await loadReleaseManifests([noManifest], "GearDuckDev/FlockSync", fetcher, signal);
  assert.equal(selectLatestRelease(ignored, "desktop", "beta"), null);
});
const versions = ["0.3.0-alpha", "0.3.0-alpha.2", "0.3.0-alpha.10", "0.3.0-beta", "0.3.0-beta.1", "0.3.0", "0.4.0-alpha"];

test("versions order preview sequences numerically and final releases above previews", () => {
  for (let index = 0; index < versions.length - 1; index++) {
    assert.ok(compareReleaseVersions(versions[index], versions[index + 1]) < 0);
  }
  assert.equal(compareReleaseVersions("0.3.0", "0.3.0"), 0);
  for (const invalid of ["v0.3.0", "01.2.3", "1.2", "1.2.3-rc", "1.2.3-alpha.01"]) {
    assert.equal(ReleaseVersionSchema.safeParse(invalid).success, false);
  }
});

test("channels include only their own and more stable builds; highest version wins", () => {
  const releases = versions.map((version) => release("desktop", version)).reverse();
  assert.equal(selectLatestRelease(releases, "desktop", "release")?.version, "0.3.0");
  assert.equal(selectLatestRelease(releases, "desktop", "beta")?.version, "0.3.0");
  assert.equal(selectLatestRelease(releases, "desktop", "alpha")?.version, "0.4.0-alpha");
  assert.equal(selectLatestRelease([release("server", "0.4.0-beta")], "server", "beta")?.version, "0.4.0-beta");
});

test("components, assets and GitHub prerelease flag must match; legacy tags do not leak", () => {
  const invalid = [
    release("addon", "9.0.0"), release("server", "9.0.0"),
    release("desktop", "9.0.0", { draft: true }),
    release("desktop", "9.0.0", { assets: [] }),
    release("desktop", "9.0.0", { prerelease: true }),
    release("desktop", "9.0.0-alpha", { prerelease: false }),
    release("desktop", "9.0.0", { tag_name: "v9.0.0" }),
    release("desktop", "9.0.0", { html_url: "https://example.com/download" })
  ];
  assert.equal(selectLatestRelease(invalid, "desktop", "alpha"), null);
  assert.equal(selectLatestRelease([...invalid, release("desktop", "0.2.0")], "desktop", "alpha")?.version, "0.2.0");
});

test("release defaults and optional addon catalog preserve existing sync payloads", () => {
  assert.deepEqual(UpdateCheckQuerySchema.parse({}), { channel: "release" });
  assert.equal(UpdateCheckQuerySchema.safeParse({ channel: "nightly" }).success, false);
  const payload = { culledCharacterGuids: [], serverTimestamp: 1234 };
  assert.equal(ServerReturnPayloadSchema.parse(payload).addonReleases, undefined);
  const catalog = {
    release: {
      version: "0.3.0", channel: "release", releaseNotes: "",
      url: "https://github.com/GearDuckDev/FlockSync/releases/tag/addon-v0.3.0"
    }
  };
  assert.deepEqual(ServerReturnPayloadSchema.parse({ ...payload, addonReleases: catalog }).addonReleases, catalog);
  for (const url of ["not-a-url", "https://github.com.evil.test/releases", "http://github.com/releases"]) {
    assert.equal(ReleaseInfoSchema.safeParse({ ...catalog.release, url }).success, false);
  }
});
