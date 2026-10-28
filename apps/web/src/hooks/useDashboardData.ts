import { useCallback, useEffect, useState } from 'react';
import type { Character, GuildIdentity, PlayerAlias, RaidTeam } from '@flocksync/shared-types';
import { ApiError, fetchAliases, fetchGuild, fetchRaids, fetchRoster } from '../lib/api';
import { useAuth } from '../AuthContext';

export interface DashboardData {
  guild: GuildIdentity | null;
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
  const [guild, setGuild] = useState<GuildIdentity | null>(null);
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
      const [r, t, a, g] = await Promise.all([
        fetchRoster(token), fetchRaids(token), fetchAliases(token), fetchGuild(token)
      ]);
      setRoster(r);
      setRaids(t);
      setAliases(a);
      setGuild(g);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [token, handleError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { guild, roster, setRoster, aliases, setAliases, raids, setRaids, loading, error, reload, handleError };
};
