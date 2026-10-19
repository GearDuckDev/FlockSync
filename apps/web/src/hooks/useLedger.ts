import { useCallback, useEffect, useState } from 'react';
import type { AttendanceRecord, LootRecord } from '@flocksync/shared-types';
import { useAuth } from '../AuthContext';
import { fetchAttendance, fetchLoot } from '../lib/apiTrackC';

export const useLedger = (onError: (err: unknown) => void) => {
  const { token } = useAuth();
  const [loot, setLoot] = useState<LootRecord[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (): Promise<void> => {
    if (!token) return;
    setLoading(true);
    try {
      const [l, a] = await Promise.all([fetchLoot(token), fetchAttendance(token)]);
      setLoot(l);
      setAttendance(a);
    } catch (err) {
      onError(err);
    } finally {
      setLoading(false);
    }
  }, [token, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  return { loot, attendance, loading };
};
