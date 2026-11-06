import { useCallback, useEffect, useRef, useState } from 'react';
import type { SharedKillEntry, KillObservation } from '@flocksync/shared-types';
import { changeKillEntry, createKillEntry, fetchKillList, fetchKillObservations } from '../lib/apiKillList';

export const useKillList = (token: string | null) => {
  const [entries, setEntries] = useState<SharedKillEntry[]>([]);
  const [observations, setObservations] = useState<KillObservation[]>([]);
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
    try {
      const [list, reports] = await Promise.all([
        fetchKillList(token), fetchKillObservations(token)
      ]);
      if (id !== generation.current) return;
      setEntries(list);
      setObservations(reports);
    } catch (err) {
      if (id === generation.current) {
        setEntries([]);
        setObservations([]);
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
        setError(err instanceof Error ? err.message : 'Kill List change failed');
      }
      return false;
    } finally {
      mutating.current = false;
      if (id === generation.current) setSaving(false);
    }
  };
  const add = async (name: string, note: string): Promise<boolean> => {
    if (!token || mutating.current) return false;
    mutating.current = true;
    const id = ++generation.current;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const created = await createKillEntry(token, name, note);
      if (id !== generation.current) return false;
      setEntries((rows) => [...rows, created]);
      setNotice('Shared target added. Collector sync will return it to the game.');
      return true;
    } catch (err) {
      if (id === generation.current) setError(err instanceof Error ? err.message : 'Kill List add failed');
      return false;
    } finally {
      mutating.current = false;
      if (id === generation.current) setSaving(false);
    }
  };
  return { entries, observations, loading, saving, error, notice, load, change, add };
};
