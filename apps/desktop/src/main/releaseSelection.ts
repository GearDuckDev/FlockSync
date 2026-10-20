import {
  compareReleaseVersions,
  selectLatestRelease,
  type GitHubRelease,
  type ReleaseInfo,
  type UpdateChannel,
} from '@flocksync/shared-types';

export const selectDesktopUpdate = (
  releases: readonly GitHubRelease[],
  currentVersion: string,
  channel: UpdateChannel,
): ReleaseInfo | null => {
  const latest = selectLatestRelease(releases, 'desktop', channel);
  return latest && compareReleaseVersions(latest.version, currentVersion) > 0 ? latest : null;
};
