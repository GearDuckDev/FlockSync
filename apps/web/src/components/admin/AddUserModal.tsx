import { useState } from 'react';
import { AuthUserRoleEnum, type AuthUserRole, type ManagedUser } from '@flocksync/shared-types';
import { useAuth } from '../../AuthContext';
import { createUser } from '../../lib/apiUsers';

interface Props {
  onCreated: (user: ManagedUser) => void;
  onClose: () => void;
}

const field = 'w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm';

export const AddUserModal = ({ onCreated, onClose }: Props): React.JSX.Element => {
  const { token } = useAuth();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AuthUserRole>('MEMBER');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      onCreated(await createUser(token, { email: email.trim(), username: username.trim(), password, role }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create user');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <form
        onSubmit={(e) => void submit(e)}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-5"
      >
        <h2 className="text-lg font-semibold">Add new user</h2>
        <label className="block text-xs text-slate-400">Email
          <input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        <label className="block text-xs text-slate-400">Username
          <input className={field} value={username} minLength={2} maxLength={32} onChange={(e) => setUsername(e.target.value)} required />
        </label>
        <label className="block text-xs text-slate-400">Initial password
          <input className={field} type="password" autoComplete="new-password" value={password} minLength={6} maxLength={72} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <label className="block text-xs text-slate-400">Role
          <select className={field} value={role} onChange={(e) => setRole(AuthUserRoleEnum.parse(e.target.value))}>
            {AuthUserRoleEnum.options.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        {error && <div className="rounded-md bg-red-950 px-3 py-2 text-sm text-red-300">{error}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800">Cancel</button>
          <button disabled={saving} className="rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? 'Creating…' : 'Create user'}
          </button>
        </div>
      </form>
    </div>
  );
};
