import { useCallback, useEffect, useState } from 'react';
import type { Character, PlayerAlias, RaidTeam } from '@flocksync/shared-types';
import { ApiError, fetchAliases, fetchRaids, fetchRoster } from '../lib/api';
import { useAuth } from '../AuthContext';

export interface DashboardData {
  roster: Character[];
  setRoster: React.Dispatch<React.SetStateAction<Character[]>>;
  aliases: PlayerAlias[];
  setAliases: React.Dispatch<React.SetStateAction<PlayerAlias[]>>;
  raids: RaidTeam[];
  setRaids: React.Dispatch<React.SetStateAction<RaidTeam[]>>;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  handleError: (err: unknown) => void;
}

export const useDashboardData = (): DashboardData => {
  const { token, logout } = useAuth();
  const [roster, setRoster] = useState<Character[]>([]);
  const [raids, setRaids] = useState<RaidTeam[]>([]);
  const [aliases, setAliases] = useState<PlayerAlias[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleError = useCallback((err: unknown): void => {
    if (err instanceof ApiError && err.status === 401) logout();
    else setError(err instanceof Error ? err.message : 'Request failed');
  }, [logout]);

  const reload = useCallback(async (): Promise<void> => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [r, t, a] = await Promise.all([fetchRoster(token), fetchRaids(token), fetchAliases(token)]);
      setRoster(r);
      setRaids(t);
      setAliases(a);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [token, handleError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { roster, setRoster, aliases, setAliases, raids, setRaids, loading, error, reload, handleError };
};
