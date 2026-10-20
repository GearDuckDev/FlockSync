import {
  ReleaseManifestSchema, ReleaseVersionSchema, getVersionChannel, type GitHubRelease
} from "./releases.js";

export const RELEASE_MANIFEST_ASSET = "flocksync-release.json";

// All requests share the caller's deadline and cache; never contact asset-supplied hosts.
export const loadReleaseManifests = async (
  releases: readonly GitHubRelease[], repository: string,
  fetcher: typeof fetch, signal: AbortSignal
): Promise<GitHubRelease[]> => {
  const result: GitHubRelease[] = [];
  for (const release of releases) {
    const version = ReleaseVersionSchema.safeParse(release.tag_name.slice(1));
    const asset = release.assets.find((item) => item.name === RELEASE_MANIFEST_ASSET);
    if (release.draft || !release.tag_name.startsWith("v") || !version.success ||
      release.prerelease !== (getVersionChannel(version.data) !== "release") || !asset) {
      result.push(release);
      continue;
    }
    const url = `https://github.com/${repository}/releases/download/${encodeURIComponent(release.tag_name)}/${RELEASE_MANIFEST_ASSET}`;
    const response = await fetcher(url, { signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Release manifest download failed (HTTP ${response.status}).`);
    const text = await response.text();
    if (text.length > 64_000) throw new Error("Release manifest exceeds the size limit.");
    const manifest = ReleaseManifestSchema.parse(JSON.parse(text));
    if (manifest.releaseVersion !== version.data) throw new Error("Release manifest version does not match its tag.");
    result.push({ ...release, manifest });
  }
  return result;
};
