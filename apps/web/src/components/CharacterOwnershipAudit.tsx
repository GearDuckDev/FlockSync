import type { CharacterOwnershipAudit as AuditEntry } from '@flocksync/shared-types';

export const CharacterOwnershipAudit = ({ entries }: { entries: AuditEntry[] }): React.JSX.Element => (
  <section className="space-y-2">
    <h3 className="font-semibold">Recent ownership changes</h3>
    <p className="text-xs text-slate-400">Latest 100 changes. Older records remain in the database.</p>
    {entries.length === 0 && <p className="text-sm text-slate-400">No ownership changes recorded.</p>}
    <ol className="space-y-2">
      {entries.map((entry) => (
        <li key={entry.id} className="rounded-md border border-slate-800 p-3 text-sm">
          <strong>{entry.characterName}</strong>: {entry.previousUsername ?? 'Unlinked'} &rarr; {entry.username ?? 'Unlinked'}
          <div className="text-xs text-slate-400">
            {entry.reason.replaceAll('_', ' ').toLowerCase()} by {entry.actorUsername}
            {' | '}{new Date(entry.changedAt * 1000).toLocaleString()}
          </div>
        </li>
      ))}
    </ol>
  </section>
);
