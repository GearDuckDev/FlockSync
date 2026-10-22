import { LoginPage } from './LoginPage';
import { Dashboard } from './Dashboard';
import { useAuth } from './AuthContext';
import { ThemeProvider } from './ThemeContext';

export const App = (): React.JSX.Element => {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center text-slate-400">Loading…</div>;
  return user ? <ThemeProvider key={user.id}><Dashboard /></ThemeProvider> : <LoginPage />;
};
