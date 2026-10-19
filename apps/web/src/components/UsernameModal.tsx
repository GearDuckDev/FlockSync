import { useState } from 'react';
import { UpdateUsernameRequestSchema, type ManagedUser } from '@flocksync/shared-types';
import { useAuth } from '../AuthContext';
import { updateUsername } from '../lib/apiUsers';

interface Props {
  target: { id: string; username: string };
  onSaved: (user: ManagedUser) => void;
  onClose: () => void;
}

export const UsernameModal = ({ target, onSaved, onClose }: Props): React.JSX.Element => {
  const { token, updateLocalUsername } = useAuth();
  const [username, setUsername] = useState(target.username);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    const body = UpdateUsernameRequestSchema.safeParse({ username });
    if (!body.success) {
      setError('Username must be between 2 and 32 characters.');
      return;
    }
    if (!token) {
      setError('Please sign in again to change your username.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await updateUsername(token, target.id, body.data.username);
      updateLocalUsername(updated.id, updated.username);
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change username');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form role="dialog" aria-modal="true" aria-labelledby="username-heading"
        onSubmit={(e) => void submit(e)}
        className="w-full max-w-md space-y-4 rounded-xl border border-slate-700 bg-slate-900 p-5">
        <h2 id="username-heading" className="text-lg font-semibold">Change username</h2>
        <p className="text-sm text-slate-400">Account: {target.username}. Your email, password and permissions will not change.</p>
        <label className="block text-sm text-slate-400">Username
          <input autoFocus required minLength={2} maxLength={32} disabled={busy}
            value={username} onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2" />
        </label>
        {error && <div role="alert" className="rounded-md bg-red-950 px-3 py-2 text-sm text-red-300">{error}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={onClose}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-sm">Cancel</button>
          <button disabled={busy} className="rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
            {busy ? 'Saving...' : 'Save username'}
          </button>
        </div>
      </form>
    </div>
  );
};
