import { useCallback, useEffect, useRef, useState } from 'react';
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
  const generation = useRef(0);

  const handleError = useCallback((err: unknown): void => {
    if (err instanceof ApiError && err.status === 401) logout();
    else setError(err instanceof Error ? err.message : 'Request failed');
  }, [logout]);

  const reload = useCallback(async (): Promise<void> => {
    if (!token) return;
    const current = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const [r, t, a, g] = await Promise.all([
        fetchRoster(token), fetchRaids(token), fetchAliases(token), fetchGuild(token)
      ]);
      if (current !== generation.current) return;
      setRoster(r);
      setRaids(t);
      setAliases(a);
      setGuild(g);
    } catch (err) {
      if (current === generation.current) handleError(err);
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [token, handleError]);

  useEffect(() => {
    void reload();
    const refresh = (): void => { void reload(); };
    window.addEventListener('focus', refresh);
    const interval = window.setInterval(refresh, 60_000);
    return () => {
      generation.current++;
      window.removeEventListener('focus', refresh);
      window.clearInterval(interval);
    };
  }, [reload]);

  return {
    guild, roster, setRoster, aliases, setAliases, raids, setRaids,
    loading, error, reload, handleError
  };
};
