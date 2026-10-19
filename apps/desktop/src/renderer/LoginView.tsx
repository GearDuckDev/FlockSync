import { useState } from 'react';
import type { AuthUser } from '@flocksync/shared-types';

interface Props {
  initialUrl: string;
  onLoggedIn: (user: AuthUser, apiBaseUrl: string) => void;
}

export const LoginView = ({ initialUrl, onLoggedIn }: Props): React.JSX.Element => {
  const [apiBaseUrl, setApiBaseUrl] = useState(initialUrl);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await window.flocksync.login(apiBaseUrl, email, password);
    setBusy(false);
    if (res.ok) onLoggedIn(res.user, apiBaseUrl);
    else setError(res.error);
  };

  return (
    <div className="center">
      <form className="card login" onSubmit={(e) => void submit(e)}>
        <h1>FlockSync</h1>
        <p className="muted">Enter your guild's FlockSync server URL to sign in and sync your data.</p>
        <label>
          API Server URL
          <input
            type="url"
            value={apiBaseUrl}
            onChange={(e) => setApiBaseUrl(e.target.value)}
            placeholder="https://flocksync.yourguild.org"
            required
          />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <div className="error">{error}</div>}
        <button type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
};
