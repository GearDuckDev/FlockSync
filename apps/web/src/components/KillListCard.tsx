import { useState } from 'react';
import { KillNoteSchema, type KillObservation, type SharedKillEntry } from '@flocksync/shared-types';
import { KillObservationHistory } from './KillObservationHistory';

interface Props {
  entry: SharedKillEntry;
  observations: KillObservation[];
  editable: boolean;
  disabled: boolean;
  change: (entry: SharedKillEntry, note?: string) => Promise<boolean>;
}

export const KillListCard = ({ entry, observations, editable, disabled, change }: Props): React.JSX.Element => {
  const [draft, setDraft] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState(entry);
  const stale = draft !== null && editingEntry.updatedAt !== entry.updatedAt;
  const valid = draft !== null && KillNoteSchema.safeParse(draft).success;
  const save = async (): Promise<void> => {
    if (draft === null || !valid || stale || disabled || !editable) return;
    if (await change(editingEntry, draft)) setDraft(null);
  };
  const remove = async (): Promise<void> => {
    if (disabled || !editable || !window.confirm(
      `Remove "${entry.name}" (${entry.realm}) from the shared guild Kill List? Personal entries will not be removed.`
    )) return;
    await change(entry);
  };
  return (
    <article className="space-y-3 rounded-lg border border-slate-800 bg-slate-900 p-4">
      <div>
        <h3 className="font-semibold">{entry.name} <span className="text-sm text-slate-400">{entry.realm}</span></h3>
        <p className="text-xs text-slate-400">Added by {entry.author} &middot; Updated {new Date(entry.updatedAt * 1000).toLocaleString()}</p>
      </div>
      <p className="whitespace-pre-wrap break-words text-sm">{entry.note || 'No reason provided.'}</p>
      <KillObservationHistory entry={entry} observations={observations} />
      {draft !== null && <div className="space-y-2">
        <label className="block text-sm">Reason for {entry.name}
          <textarea value={draft} disabled={disabled || !editable}
            onChange={(event) => setDraft(event.target.value)} rows={5}
            className="mt-1 w-full rounded-md border border-slate-600 bg-slate-950 p-2 disabled:opacity-50" />
        </label>
        <p className={valid ? 'text-xs text-slate-400' : 'text-xs text-red-300'}>
          {Array.from(draft).length}/500 characters. Unsupported controls are not allowed.
        </p>
        {stale && <p role="alert" className="text-sm text-amber-300">This entry changed. Cancel and reopen the editor to use the latest version.</p>}
        {!editable && <p className="text-sm text-amber-300">Editing permission is unavailable. Refresh links or ask an officer.</p>}
        <button disabled={disabled || !editable || !valid || stale} onClick={() => void save()}
          className="rounded bg-indigo-600 px-3 py-2 text-sm disabled:opacity-50">Save note</button>
        <button disabled={disabled} onClick={() => setDraft(null)} className="ml-2 px-3 py-2 text-sm">Cancel</button>
      </div>}
      {editable && draft === null && <div className="flex gap-2">
        <button disabled={disabled} onClick={() => { setEditingEntry(entry); setDraft(entry.note); }}
          className="rounded border border-slate-600 px-3 py-2 text-sm disabled:opacity-50">Edit note</button>
        <button disabled={disabled} onClick={() => void remove()}
          className="rounded border border-red-900 px-3 py-2 text-sm text-red-300 disabled:opacity-50">Remove</button>
      </div>}
    </article>
  );
};
