import {
  compareReleaseVersions,
  selectLatestRelease,
  type GitHubRelease,
  type UpdateChannel,
} from '@flocksync/shared-types';

export const ADDON_BUNDLE_ASSET = 'FlockSync-Addon-Bundle.zip';

export interface HelperAddonUpdate {
  version: string;
  tag: string;
  downloadUrl: string;
  sha256: string;
}

const SHA256_DIGEST = /^sha256:([0-9a-f]{64})$/i;

/** Picks the newest combined release whose AppHelper is newer than the installed copy. */
export const selectHelperAddonUpdate = (
  releases: readonly GitHubRelease[],
  installedVersion: string,
  channel: UpdateChannel,
  repo: string,
): HelperAddonUpdate | null => {
  const latest = selectLatestRelease(releases, 'helper', channel);
  if (!latest || compareReleaseVersions(latest.version, installedVersion) <= 0) return null;
  const release = releases.find((item) =>
    item.manifest?.components.helper.version === latest.version && item.html_url === latest.url);
  const asset = release?.assets.find((item) => item.name === ADDON_BUNDLE_ASSET);
  const sha256 = SHA256_DIGEST.exec(asset?.digest ?? '')?.[1];
  if (!release || !sha256) return null;
  return {
    version: latest.version,
    tag: release.tag_name,
    // Built from the configured repository; never download from asset-supplied hosts.
    downloadUrl: `https://github.com/${repo}/releases/download/${encodeURIComponent(release.tag_name)}/${ADDON_BUNDLE_ASSET}`,
    sha256: sha256.toLowerCase(),
  };
};
