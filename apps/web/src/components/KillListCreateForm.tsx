import { useState, type FormEvent } from 'react';
import { KillNoteSchema } from '@flocksync/shared-types';

interface Props {
  disabled: boolean;
  onAdd: (name: string, note: string) => Promise<boolean>;
}

export const KillListCreateForm = ({ disabled, onAdd }: Props): React.JSX.Element => {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const validNote = KillNoteSchema.safeParse(note).success;
  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (disabled || !name.trim() || !validNote) return;
    if (await onAdd(name, note)) {
      setName('');
      setNote('');
    }
  };
  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-3 rounded-lg border border-slate-800 bg-slate-900 p-4">
      <h3 className="font-semibold">Add a shared target</h3>
      <label className="block text-sm">Character name
        <input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)}
          disabled={disabled} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 disabled:opacity-50" />
      </label>
      <label className="block text-sm">Reason (optional; up to 500 characters)
        <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3}
          disabled={disabled} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 disabled:opacity-50" />
      </label>
      <p className={validNote ? 'text-xs text-slate-400' : 'text-xs text-red-300'}>
        {Array.from(note).length}/500 characters. Unsupported controls are not allowed.
      </p>
      <button type="submit" disabled={disabled || !name.trim() || !validNote}
        className="rounded bg-indigo-600 px-3 py-2 text-sm disabled:opacity-50">Add target</button>
    </form>
  );
};
