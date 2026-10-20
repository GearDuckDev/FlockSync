import {
  getVersionChannel, GitHubReleaseListSchema, selectLatestRelease, UpdateChannelSchema,
  type AddonReleaseCatalog, type GitHubRelease
} from "@flocksync/shared-types";

interface ReleaseCatalogOptions {
  repository: string;
  fetcher?: typeof fetch;
  now?: () => number;
  ttlMs?: number;
  failureTtlMs?: number;
  timeoutMs?: number;
  maxPages?: number;
}

export const createReleaseCatalog = (options: ReleaseCatalogOptions) => {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now;
  const ttlMs = options.ttlMs ?? 5 * 60_000;
  const failureTtlMs = options.failureTtlMs ?? 60_000;
  const maxPages = options.maxPages ?? 20;
  let cached: { releases: GitHubRelease[]; expires: number } | undefined;
  let failure: { error: Error; expires: number } | undefined;
  let pending: Promise<GitHubRelease[]> | undefined;
  let addonRefresh: Promise<void> | undefined;

  const download = async (): Promise<GitHubRelease[]> => {
    const signal = AbortSignal.timeout(options.timeoutMs ?? 10_000);
    const releases: GitHubRelease[] = [];
    for (let page = 1; page <= maxPages; page++) {
      const response = await fetcher(
        `https://api.github.com/repos/${options.repository}/releases?per_page=100&page=${page}`,
        {
          signal,
          headers: {
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "FlockSync-update-notices"
          }
        }
      );
      if (!response.ok) {
        throw new Error(`GitHub update check failed (HTTP ${response.status}); try again later.`);
      }
      const body: unknown = await response.json();
      const parsed = GitHubReleaseListSchema.safeParse(body);
      if (!parsed.success) throw new Error("GitHub returned invalid release metadata.");
      releases.push(...parsed.data);
      const hasNext = /rel="next"/.test(response.headers.get("link") ?? "");
      if (!hasNext && parsed.data.length < 100) return releases;
    }
    throw new Error("GitHub release history exceeds the pagination limit; update status is unknown.");
  };

  const list = (): Promise<GitHubRelease[]> => {
    if (cached && cached.expires > now()) return Promise.resolve(cached.releases);
    if (failure && failure.expires > now()) return Promise.reject(failure.error);
    if (pending) return pending;
    pending = download().then((releases) => {
      cached = { releases, expires: now() + ttlMs };
      failure = undefined;
      return releases;
    }).catch((error: unknown) => {
      const problem = error instanceof Error && error.name !== "TimeoutError" && error.name !== "AbortError"
        ? error : new Error("GitHub update check timed out or could not be completed.");
      failure = { error: problem, expires: now() + failureTtlMs };
      throw problem;
    }).finally(() => { pending = undefined; });
    return pending;
  };

  // Never await GitHub on the sync path. A cold/expired catalog arrives on a later sync.
  const cachedAddonReleases = (onError: (error: unknown) => void): AddonReleaseCatalog | undefined => {
    if (cached && cached.expires > now()) {
      const catalog: AddonReleaseCatalog = {};
      for (const channel of UpdateChannelSchema.options) {
        const candidates = cached.releases.filter((release) =>
          release.tag_name.startsWith("addon-v") &&
          getVersionChannel(release.tag_name.slice("addon-v".length)) === channel);
        const latest = selectLatestRelease(candidates, "addon", channel);
        if (latest) catalog[channel] = latest;
      }
      return catalog;
    }
    if (!addonRefresh && (!failure || failure.expires <= now())) {
      addonRefresh = list().then(() => undefined).catch(onError)
        .finally(() => { addonRefresh = undefined; });
    }
    return undefined;
  };

  return { list, cachedAddonReleases };
};
