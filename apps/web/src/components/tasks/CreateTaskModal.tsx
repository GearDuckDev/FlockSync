import { useState } from 'react';
import type { Character } from '@flocksync/shared-types';
import { useAuth } from '../../AuthContext';
import { createTask } from '../../lib/apiTrackC';

export interface TaskDraft {
  title: string;
  relatedCharacterGuid?: string;
}

interface Props {
  draft: TaskDraft;
  roster: Character[];
  onClose: () => void;
  onError: (err: unknown) => void;
}

export const CreateTaskModal = ({ draft, roster, onClose, onError }: Props): React.JSX.Element => {
  const { token } = useAuth();
  const [title, setTitle] = useState(draft.title);
  const [description, setDescription] = useState('');
  const [guid, setGuid] = useState(draft.relatedCharacterGuid ?? '');
  const [saving, setSaving] = useState(false);

  const submit = async (): Promise<void> => {
    if (!token || title.trim() === '') return;
    setSaving(true);
    try {
      await createTask(token, {
        title: title.trim(),
        status: 'OPEN',
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(guid ? { relatedCharacterGuid: guid } : {}),
      });
      onClose();
    } catch (err) {
      onError(err);
      setSaving(false);
    }
  };

  const field = 'w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">Create officer task</h2>
        <label className="block text-xs text-slate-400">Title
          <input className={field} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="block text-xs text-slate-400">Related character
          <select className={field} value={guid} onChange={(e) => setGuid(e.target.value)}>
            <option value="">None</option>
            {[...roster].sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.guid} value={c.guid}>{c.name}</option>)}
          </select>
        </label>
        <label className="block text-xs text-slate-400">Details (optional)
          <textarea className={field} rows={3} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800">Cancel</button>
          <button disabled={saving || title.trim() === ''} onClick={() => void submit()} className="rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
            Create
          </button>
        </div>
      </div>
    </div>
  );
};
