import { z } from "zod";

export const UpdateChannelSchema = z.enum(["release", "beta", "alpha"]);
export type UpdateChannel = z.infer<typeof UpdateChannelSchema>;
export const ReleaseComponentSchema = z.enum(["desktop", "server", "addon", "helper"]);
export type ReleaseComponent = z.infer<typeof ReleaseComponentSchema>;
export const ReleaseVersionSchema = z.string().regex(
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(alpha|beta)(?:\.(0|[1-9]\d*))?)?$/
);
export const ReleaseInfoSchema = z.object({
  version: ReleaseVersionSchema,
  url: z.string().url().refine(
    (url) => url.startsWith("https://github.com/"),
    "Release URL must be on https://github.com"
  ),
  releaseNotes: z.string(),
  channel: UpdateChannelSchema
}).strict();
export type ReleaseInfo = z.infer<typeof ReleaseInfoSchema>;
export const AddonReleaseCatalogSchema = z.object({
  release: ReleaseInfoSchema.optional(),
  beta: ReleaseInfoSchema.optional(),
  alpha: ReleaseInfoSchema.optional()
}).strict();
export type AddonReleaseCatalog = z.infer<typeof AddonReleaseCatalogSchema>;
export const UpdateCheckQuerySchema = z.object({
  channel: UpdateChannelSchema.default("release")
}).strict();
export const ServerUpdateStatusSchema = z.object({
  currentVersion: ReleaseVersionSchema,
  channel: UpdateChannelSchema,
  latest: ReleaseInfoSchema.nullable(),
  updateAvailable: z.boolean()
}).strict();
export type ServerUpdateStatus = z.infer<typeof ServerUpdateStatusSchema>;
const ManifestComponentSchema = z.object({
  version: ReleaseVersionSchema,
  assets: z.array(z.string().min(1).max(200)).min(1)
}).strict();
export const ReleaseManifestSchema = z.object({
  schemaVersion: z.literal(1),
  releaseVersion: ReleaseVersionSchema,
  components: z.object({
    desktop: ManifestComponentSchema,
    server: ManifestComponentSchema,
    addon: ManifestComponentSchema,
    helper: ManifestComponentSchema
  }).strict()
}).strict();
export type ReleaseManifest = z.infer<typeof ReleaseManifestSchema>;
export const GitHubReleaseSchema = z.object({
  tag_name: z.string(),
  html_url: z.string().url(),
  body: z.string().nullable().optional(),
  draft: z.boolean(),
  prerelease: z.boolean(),
  assets: z.array(z.object({ name: z.string(), browser_download_url: z.string().url().optional() })),
  manifest: ReleaseManifestSchema.optional()
});
export const GitHubReleaseListSchema = z.array(GitHubReleaseSchema);
export type GitHubRelease = z.infer<typeof GitHubReleaseSchema>;

const ranks: Record<UpdateChannel, number> = { alpha: 0, beta: 1, release: 2 };
export const getVersionChannel = (version: string): UpdateChannel =>
  version.includes("-alpha") ? "alpha" : version.includes("-beta") ? "beta" : "release";

export const compareReleaseVersions = (left: string, right: string): number => {
  const a = ReleaseVersionSchema.parse(left);
  const b = ReleaseVersionSchema.parse(right);
  const [aBase = "", aPre] = a.split("-");
  const [bBase = "", bPre] = b.split("-");
  const aParts = aBase.split(".").map(Number);
  const bParts = bBase.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (aParts[i] ?? 0) - (bParts[i] ?? 0);
    if (diff !== 0) return diff;
  }
  const rank = ranks[getVersionChannel(a)] - ranks[getVersionChannel(b)];
  if (rank !== 0) return rank;
  if (aPre === bPre) return 0;
  if (aPre === undefined) return 1;
  if (bPre === undefined) return -1;
  const aNumber = aPre.split(".")[1];
  const bNumber = bPre.split(".")[1];
  if (aNumber === undefined) return -1;
  if (bNumber === undefined) return 1;
  return Number(aNumber) - Number(bNumber);
};

export const selectLatestRelease = (
  releases: readonly GitHubRelease[], component: ReleaseComponent, channel: UpdateChannel
): ReleaseInfo | null => {
  let latest: ReleaseInfo | null = null;
  for (const release of releases) {
    const prefix = `${component}-v`;
    if (release.draft) continue;
    const combined = release.manifest;
    if (!combined && !release.tag_name.startsWith(prefix)) continue;
    if (combined && (release.tag_name !== `v${combined.releaseVersion}` ||
      release.prerelease !== (getVersionChannel(combined.releaseVersion) !== "release"))) continue;
    const entry = combined?.components[component];
    if (entry && !entry.assets.every((name) => release.assets.some((asset) => asset.name === name))) continue;
    const parsed = ReleaseVersionSchema.safeParse(entry?.version ?? release.tag_name.slice(prefix.length));
    if (!parsed.success) continue;
    const version = parsed.data;
    const releaseChannel = getVersionChannel(version);
    if (ranks[releaseChannel] < ranks[channel]) continue;
    if (!combined && release.prerelease !== (releaseChannel !== "release")) continue;
    if (component === "desktop" && !release.assets.some((asset) =>
      asset.name === `FlockSync-Setup-${version}-x64.exe` ||
      asset.name === `FlockSync-Portable-${version}-x64.exe`)) continue;
    const candidate = ReleaseInfoSchema.safeParse({
      version, url: release.html_url, releaseNotes: release.body ?? "", channel: releaseChannel
    });
    if (!candidate.success) continue;
    if (!latest || compareReleaseVersions(version, latest.version) > 0) latest = candidate.data;
  }
  return latest;
};
