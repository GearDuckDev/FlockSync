import { useState } from 'react';
import { LogIn, UserPlus } from 'lucide-react';
import { useAuth } from './AuthContext';

type Mode = 'login' | 'register';

const input = 'w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-indigo-400';

export const LoginPage = (): React.JSX.Element => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isRegister = mode === 'register';

  const switchMode = (next: Mode): void => {
    setMode(next);
    setError(null);
    setPassword('');
    setConfirm('');
  };

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (isRegister && password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (isRegister) await register({ email: email.trim(), username: username.trim(), password });
      else await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : isRegister ? 'Registration failed' : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  const tab = (m: Mode, label: string): React.JSX.Element => (
    <button
      type="button"
      onClick={() => switchMode(m)}
      className={`flex-1 rounded-md py-1.5 text-sm font-medium ${mode === m ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <form onSubmit={(e) => void submit(e)} className="w-full max-w-sm space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h1 className="text-2xl font-bold">FlockSync</h1>
        <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-950 p-1">
          {tab('login', 'Sign in')}
          {tab('register', 'Create account')}
        </div>
        <p className="text-sm text-slate-400">
          {isRegister
            ? 'New accounts start as Members with read-only access. An admin can promote you to Officer.'
            : 'Sign in to view the guild roster.'}
        </p>
        <label className="block text-sm text-slate-400">
          Email
          <input className={input} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        {isRegister && (
          <label className="block text-sm text-slate-400">
            Username
            <input className={input} autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={2} maxLength={32} />
          </label>
        )}
        <label className="block text-sm text-slate-400">
          Password
          <input
            className={input}
            type="password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            {...(isRegister ? { minLength: 6, maxLength: 72 } : {})}
          />
        </label>
        {isRegister && (
          <label className="block text-sm text-slate-400">
            Confirm password
            <input className={input} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </label>
        )}
        {error && <div className="rounded-md bg-red-950 px-3 py-2 text-sm text-red-300">{error}</div>}
        <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-md bg-indigo-500 py-2 font-semibold text-white hover:bg-indigo-400 disabled:opacity-60">
          {isRegister ? <UserPlus size={16} /> : <LogIn size={16} />}
          {busy ? (isRegister ? 'Creating account…' : 'Signing in…') : isRegister ? 'Create account' : 'Sign in'}
        </button>
      </form>
    </div>
  );
};
