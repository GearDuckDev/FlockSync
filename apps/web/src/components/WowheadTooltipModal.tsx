import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, X } from 'lucide-react';
import type { Entity } from '../lib/wowheadNames';
import { cachedTooltip, fetchWowheadTooltip, type WowheadTooltipData } from '../lib/wowheadTooltip';

interface Props {
  entity: Entity;
  href: string;
  fallbackName: string;
  fallbackColor: string | undefined;
  onClose: () => void;
}

export const WowheadTooltipModal = ({ entity, href, fallbackName, fallbackColor, onClose }: Props): React.JSX.Element => {
  const [data, setData] = useState<WowheadTooltipData | null>(() => cachedTooltip(entity) ?? null);
  const [loading, setLoading] = useState(() => cachedTooltip(entity) === undefined);

  useEffect(() => {
    let cancelled = false;
    const hit = cachedTooltip(entity);
    if (hit) {
      setData(hit);
      setLoading(false);
      return;
    }
    setLoading(true);
    void fetchWowheadTooltip(entity).then((res) => {
      if (!cancelled) {
        setData(res);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [entity]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const title = data?.name ?? fallbackName;
  const titleColor = data?.color ?? fallbackColor;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 fold:items-center"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="w-full max-w-sm space-y-3 rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {data?.iconUrl && (
              <img src={data.iconUrl} alt="" className="h-9 w-9 shrink-0 rounded border border-slate-700" />
            )}
            <div className="min-w-0">
              <div className="truncate font-semibold" style={titleColor ? { color: titleColor } : undefined}>
                {title}
              </div>
              <div className="text-xs text-slate-500">
                {entity.kind === 'spell' ? 'Spell' : 'Item'} #{entity.id}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close item details"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <p className="py-2 text-xs text-slate-400">Loading tooltip…</p>
        ) : data?.html ? (
          <div
            className="wh-tooltip-body max-h-[55vh] overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/90 p-3 text-xs leading-relaxed text-slate-200"
            dangerouslySetInnerHTML={{ __html: data.html }}
          />
        ) : (
          <p className="py-1 text-xs text-slate-400">Detailed stats unavailable offline.</p>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-800"
          >
            Close
          </button>
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
          >
            Open on Wowhead <ExternalLink size={13} />
          </a>
        </div>
      </div>
    </div>,
    document.body,
  );
};
