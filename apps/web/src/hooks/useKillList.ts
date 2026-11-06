import { useCallback, useEffect, useRef, useState } from 'react';
import type { SharedKillEntry } from '@flocksync/shared-types';
import { fetchOwnCharacters } from '../lib/apiCharacterOwnership';
import { changeKillEntry, fetchKillList } from '../lib/apiKillList';

export const useKillList = (token: string | null) => {
  const [entries, setEntries] = useState<SharedKillEntry[]>([]);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const generation = useRef(0);
  const mutating = useRef(false);
  const load = useCallback(async () => {
    if (!token || mutating.current) return;
    const id = ++generation.current;
    setLoading(true);
    setError(null);
    setOwned(new Set());
    try {
      const [list, links] = await Promise.all([fetchKillList(token), fetchOwnCharacters(token)]);
      if (id !== generation.current) return;
      setEntries(list);
      setOwned(new Set(links.map((link) => link.characterGuid)));
    } catch (err) {
      if (id === generation.current) {
        setEntries([]);
        setError(err instanceof Error ? err.message : 'Kill List refresh failed');
      }
    } finally {
      if (id === generation.current) setLoading(false);
    }
  }, [token]);
  useEffect(() => {
    void load();
    const focus = (): void => { void load(); };
    window.addEventListener('focus', focus);
    const timer = window.setInterval(focus, 60_000);
    return () => {
      generation.current++;
      window.removeEventListener('focus', focus);
      window.clearInterval(timer);
    };
  }, [load]);
  const change = async (entry: SharedKillEntry, note?: string): Promise<boolean> => {
    if (!token || mutating.current) return false;
    mutating.current = true;
    const id = ++generation.current;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await changeKillEntry(token, entry, note);
      if (id !== generation.current) return false;
      setEntries((rows) => updated.deleted
        ? rows.filter((row) => row.name !== entry.name || row.realm !== entry.realm)
        : rows.map((row) => row.name === entry.name && row.realm === entry.realm ? updated : row));
      setNotice(updated.deleted ? 'Shared target removed. Collector sync will return the removal to the game.'
        : 'Shared note saved. Collector sync will return the edit to the game.');
      return true;
    } catch (err) {
      if (id === generation.current) {
        setOwned(new Set());
        setError(err instanceof Error ? err.message : 'Kill List change failed');
      }
      return false;
    } finally {
      mutating.current = false;
      if (id === generation.current) setSaving(false);
    }
  };
  return { entries, owned, loading, saving, error, notice, load, change };
};
