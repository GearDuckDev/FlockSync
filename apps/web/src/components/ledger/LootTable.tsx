import { useEffect, useState } from 'react';
import type { LootRecord } from '@flocksync/shared-types';
import { parseItemLink } from '../../lib/wow';
import { loadItemTooltips, rescanItemTooltips } from '../../lib/wowhead';
import { WowheadLink } from '../WowheadLink';

const PAGE_SIZE = 25;

export const LootTable = ({ loot }: { loot: LootRecord[] }): React.JSX.Element => {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(loot.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const rows = loot.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  useEffect(() => {
    void loadItemTooltips().then(rescanItemTooltips);
  }, [rows]);

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-left text-xs uppercase text-slate-400">
            <tr>{['When', 'Item', 'Recipient', 'Instance', 'Boss'].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">No loot recorded yet.</td></tr>}
            {rows.map((r) => {
              const parsed = parseItemLink(r.itemLink);
              return (
                <tr key={r.id} className="border-t border-slate-800 hover:bg-slate-900">
                  <td className="px-3 py-2 text-slate-400">{new Date(r.timestamp * 1000).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <WowheadLink entity={{ kind: 'item', id: r.itemId }} name={parsed.name === 'Unknown item' ? undefined : parsed.name} color={parsed.color} />
                  </td>
                  <td className="px-3 py-2 font-medium">{r.recipientName}</td>
                  <td className="px-3 py-2">{r.instanceName}</td>
                  <td className="px-3 py-2 text-slate-400">{r.bossName ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end gap-2 text-sm">
        <button disabled={current === 0} onClick={() => setPage(current - 1)} className="rounded-md border border-slate-700 px-2 py-1 disabled:opacity-40">Prev</button>
        <span className="text-slate-400">Page {current + 1} / {pages}</span>
        <button disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="rounded-md border border-slate-700 px-2 py-1 disabled:opacity-40">Next</button>
      </div>
    </div>
  );
};
