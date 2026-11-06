import { useCallback, useEffect, useState } from 'react';
import type { CharacterOwnershipCatalog } from '@flocksync/shared-types';
import { useAuth } from './AuthContext';
import { fetchCharacterOwnership, setGroupOwner } from './lib/apiCharacterOwnership';
import { prepareGroupOwnershipChange } from './lib/characterOwnership';
import { CharacterOwnershipPanel } from './components/CharacterOwnershipPanel';
import { CharacterOwnershipAudit } from './components/CharacterOwnershipAudit';

export const CharacterOwnershipPage = (): React.JSX.Element => {
  const { token } = useAuth();
  const [catalog, setCatalog] = useState<CharacterOwnershipCatalog | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fail = (err: unknown): void => setError(err instanceof Error ? err.message : 'Ownership request failed');

  const load = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      setCatalog(await fetchCharacterOwnership(token));
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  const change = async (key: string, userId: string | null): Promise<void> => {
    if (!token || !catalog || busy) return;
    setError(null);
    setNotice(null);
    try {
      const { input, confirmation } = prepareGroupOwnershipChange(catalog, key, userId);
      if (!window.confirm(confirmation)) return;
      setBusy(true);
      setCatalog(await setGroupOwner(token, input));
      setNotice('Friendly-name group ownership saved.');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Character Links</h2>
          <p className="text-sm text-slate-400">
            Officers and admins verify ownership of characters in this server&apos;s synced guild roster.
            Assign a friendly-name group to a website user to link all its current and future synced characters.
            Labels alone are not verified ownership: an officer must assign the group first.
            Main/alt grouping changes can then change inherited access. Renaming a friendly label does not change its owner.
          </p>
        </div>
        <button disabled={busy} onClick={() => void load()}
          className="rounded-md border border-slate-700 px-3 py-2 text-sm disabled:opacity-50">Refresh links</button>
      </div>
      {error && <div role="alert" className="rounded-md bg-red-950 p-3 text-sm text-red-300">{error}</div>}
      {notice && <p role="status" className="text-sm text-green-300">{notice}</p>}
      {busy && <p className="text-sm text-slate-400">Loading or saving character links...</p>}
      {catalog && !catalog.guild && <p>Sync your guild roster through Desktop before linking characters.</p>}
      {catalog?.guild && <>
        <p className="text-sm text-slate-400">{catalog.guild.name} &middot; {catalog.guild.realm}</p>
        <CharacterOwnershipPanel catalog={catalog} busy={busy} onChange={(guid, id) => void change(guid, id)} />
        <CharacterOwnershipAudit entries={catalog.audit} />
      </>}
    </div>
  );
};
