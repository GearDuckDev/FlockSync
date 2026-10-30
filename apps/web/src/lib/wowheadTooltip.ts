import { z } from 'zod';
import { WOWHEAD_PATH } from './wowhead';
import { entityKey, type Entity } from './wowheadNames';

export interface WowheadTooltipData {
  name: string;
  color: string | undefined;
  iconUrl: string | undefined;
  html: string | undefined;
}

const QUALITY_COLORS: Record<number, string> = {
  0: '#9d9d9d',
  1: '#ffffff',
  2: '#1eff00',
  3: '#0070dd',
  4: '#a335ee',
  5: '#ff8000',
  6: '#e6cc80',
  7: '#00ccff',
};

const RawTooltipSchema = z.object({
  name: z.string().min(1),
  quality: z.number().int().min(0).max(7).optional(),
  icon: z.string().regex(/^[\w-]+$/).optional(),
  tooltip: z.string().optional(),
});

const SAFE_TAGS = new Set([
  'table', 'tbody', 'tr', 'td', 'th', 'div', 'span', 'br', 'b', 'strong', 'i', 'em', 'ul', 'li', 'p', 'small',
]);
const SAFE_CLASS = /^(?:q[0-7]?|c(?:[1-9]|1[01])|indent|money(?:gold|silver|copper))$/;

const escapeText = (raw: string): string =>
  raw
    .replace(/&(?!(?:amp|lt|gt|quot|apos|nbsp|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/** Sanitizes Wowhead tooltip HTML to an inert allowlist of layout tags and WoW color classes. */
export const sanitizeTooltipHtml = (rawHtml: string): string => {
  const stripped = rawHtml
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');

  const tagPattern = /<\/?([a-zA-Z0-9]+)(\s[^>]*)?>/g;
  let out = '';
  let cursor = 0;

  for (let match = tagPattern.exec(stripped); match !== null; match = tagPattern.exec(stripped)) {
    out += escapeText(stripped.slice(cursor, match.index));
    cursor = match.index + match[0].length;

    const full = match[0];
    const tag = (match[1] ?? '').toLowerCase();
    const attrs = match[2] ?? '';
    if (!SAFE_TAGS.has(tag)) continue;

    if (full.startsWith('</')) {
      if (tag !== 'br') out += `</${tag}>`;
      continue;
    }
    if (tag === 'br') {
      out += '<br />';
      continue;
    }
    const classMatch = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrs);
    const rawClasses = classMatch?.[1] ?? classMatch?.[2] ?? '';
    const classes = rawClasses
      .split(/\s+/)
      .filter((token) => SAFE_CLASS.test(token))
      .join(' ');
    out += classes ? `<${tag} class="${classes}">` : `<${tag}>`;
  }

  out += escapeText(stripped.slice(cursor));
  return out.trim();
};

const cache = new Map<string, WowheadTooltipData>();
const inflight = new Map<string, Promise<WowheadTooltipData | null>>();

export const cachedTooltip = (entity: Entity): WowheadTooltipData | undefined => cache.get(entityKey(entity));

export const fetchWowheadTooltip = (entity: Entity): Promise<WowheadTooltipData | null> => {
  const key = entityKey(entity);
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(key);
  if (pending) return pending;

  const task = (async (): Promise<WowheadTooltipData | null> => {
    try {
      const res = await fetch(`https://nether.wowhead.com/${WOWHEAD_PATH}/tooltip/${entity.kind}/${entity.id}`);
      if (!res.ok) return null;
      const parsed = RawTooltipSchema.safeParse(await res.json());
      if (!parsed.success) return null;
      const { name, quality, icon, tooltip } = parsed.data;
      const cleanHtml = tooltip ? sanitizeTooltipHtml(tooltip) : undefined;
      const data: WowheadTooltipData = {
        name,
        color: quality !== undefined ? QUALITY_COLORS[quality] : undefined,
        iconUrl: icon ? `https://wow.zamimg.com/images/wow/icons/medium/${icon.toLowerCase()}.jpg` : undefined,
        html: cleanHtml && cleanHtml.length > 0 ? cleanHtml : undefined,
      };
      cache.set(key, data);
      return data;
    } catch {
      return null;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, task);
  return task;
};

export const isTouchInteraction = (pointerType: string): boolean => {
  if (pointerType === 'touch' || pointerType === 'pen') return true;
  if (pointerType === 'mouse') return false;
  return typeof window !== 'undefined' && window.matchMedia('(hover: none), (pointer: coarse)').matches;
};
