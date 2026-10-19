interface ParsedVersion {
  parts: number[];
  prerelease: string;
}

const parseVersion = (raw: string): ParsedVersion | null => {
  const match = /^v?(\d+(?:\.\d+)*)(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/i.exec(raw.trim());
  if (!match?.[1]) return null;
  return { parts: match[1].split('.').map(Number), prerelease: match[2] ?? '' };
};

/** Positive when `a` is newer than `b`, negative when older, 0 when equal or unparsable. */
export const compareVersions = (a: string, b: string): number => {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  if (!va || !vb) return 0;
  const length = Math.max(va.parts.length, vb.parts.length);
  for (let i = 0; i < length; i++) {
    const diff = (va.parts[i] ?? 0) - (vb.parts[i] ?? 0);
    if (diff !== 0) return diff;
  }
  // A final release outranks its prereleases (1.0.0 > 1.0.0-beta.1).
  if (va.prerelease === vb.prerelease) return 0;
  if (!va.prerelease) return 1;
  if (!vb.prerelease) return -1;
  return va.prerelease.localeCompare(vb.prerelease, 'en', { numeric: true });
};

export const isNewerVersion = (candidate: string, current: string): boolean =>
  compareVersions(candidate, current) > 0;

export const stripVersionPrefix = (tag: string): string => tag.trim().replace(/^v/i, '');
