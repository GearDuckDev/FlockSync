import { useCallback, useEffect, useRef, useState } from 'react';
import type { Character, CharacterOwnership, GuildIdentity, PlayerAlias, RaidTeam } from '@flocksync/shared-types';
import { ApiError, fetchAliases, fetchGuild, fetchRaids, fetchRoster } from '../lib/api';
import { useAuth } from '../AuthContext';
import { fetchOwnCharacters } from '../lib/apiCharacterOwnership';
import { visibleMemberGroups } from '../lib/memberGroups';

export interface DashboardData {
  guild: GuildIdentity | null;
  roster: Character[];
  setRoster: React.Dispatch<React.SetStateAction<Character[]>>;
  aliases: PlayerAlias[];
  setAliases: React.Dispatch<React.SetStateAction<PlayerAlias[]>>;
  raids: RaidTeam[];
  setRaids: React.Dispatch<React.SetStateAction<RaidTeam[]>>;
  linkedCharacters: CharacterOwnership[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  handleError: (err: unknown) => void;
}

export const useDashboardData = (): DashboardData => {
  const { token, user, logout } = useAuth();
  const canManage = user?.role === 'OFFICER' || user?.role === 'ADMIN';
  const [roster, setRoster] = useState<Character[]>([]);
  const [guild, setGuild] = useState<GuildIdentity | null>(null);
  const [raids, setRaids] = useState<RaidTeam[]>([]);
  const [aliases, setAliases] = useState<PlayerAlias[]>([]);
  const [linkedCharacters, setLinkedCharacters] = useState<CharacterOwnership[]>([]);
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
    setLinkedCharacters([]);
    setError(null);
    try {
      const [r, t, a, g, links] = await Promise.all([
        fetchRoster(token), fetchRaids(token), fetchAliases(token), fetchGuild(token), fetchOwnCharacters(token)
      ]);
      if (current !== generation.current) return;
      setRoster(r);
      setRaids(t);
      setAliases(a);
      setGuild(g);
      setLinkedCharacters(links);
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

  const visibleRaids = visibleMemberGroups(raids, loading ? [] : linkedCharacters, canManage);
  return {
    guild, roster, setRoster, aliases, setAliases, raids: visibleRaids, setRaids,
    linkedCharacters, loading, error, reload, handleError
  };
};
