import assert from "node:assert/strict";
import { test } from "node:test";
import {
  compareReleaseVersions, selectLatestRelease, ReleaseVersionSchema,
  UpdateCheckQuerySchema, ServerReturnPayloadSchema, ReleaseInfoSchema
} from "../dist/index.js";

const release = (component, version, overrides = {}) => ({
  tag_name: `${component}-v${version}`,
  html_url: `https://github.com/GearDuckDev/FlockSync/releases/tag/${component}-v${version}`,
  draft: false,
  prerelease: version.includes("-"),
  assets: component === "desktop" ? [{ name: `FlockSync-Setup-${version}-x64.exe` }] : [],
  ...overrides
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
