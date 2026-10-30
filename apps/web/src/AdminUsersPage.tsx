import { useCallback, useEffect, useState } from 'react';
import { AuthUserRoleEnum, type AuthUserRole, type ManagedUser } from '@flocksync/shared-types';
import { Crown, Trash2, UserPlus } from 'lucide-react';
import { useAuth } from './AuthContext';
import { deleteUser, fetchUsers, updateUserRole } from './lib/apiUsers';
import { AddUserModal } from './components/admin/AddUserModal';
import { AdminUserCards } from './components/admin/AdminUserCards';
import { UsernameModal } from './components/UsernameModal';
import { DatabaseAdminPanel } from './components/admin/DatabaseAdminPanel';
import { InfoTip } from './components/InfoTip';

const formatDate = (epoch: number): string => new Date(epoch * 1000).toLocaleDateString();

export const AdminUsersPage = (): React.JSX.Element => {
  const { token, user: me } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState<ManagedUser | null>(null);
  const isRootAdmin = users.some((u) => u.id === me?.id && u.isRootAdmin);

  const fail = (err: unknown): void => setError(err instanceof Error ? err.message : 'Request failed');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setUsers(await fetchUsers(token));
      setError(null);
    } catch (err) {
      fail(err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeRole = async (target: ManagedUser, role: AuthUserRole): Promise<void> => {
    if (!token || role === target.role) return;
    setBusyId(target.id);
    try {
      const updated = await updateUserRole(token, target.id, role);
      setUsers((list) => list.map((u) => (u.id === updated.id ? updated : u)));
      setError(null);
    } catch (err) {
      fail(err);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (target: ManagedUser): Promise<void> => {
    if (!token || !window.confirm(`Permanently delete the account "${target.username}" (${target.email})?`)) return;
    setBusyId(target.id);
    try {
      await deleteUser(token, target.id);
      setUsers((list) => list.filter((u) => u.id !== target.id));
      setError(null);
    } catch (err) {
      fail(err);
    } finally {
      setBusyId(null);
    }
  };

  const counts = AuthUserRoleEnum.options.map((r) => `${users.filter((u) => u.role === r).length} ${r.toLowerCase()}`);

  return (
    <div className="space-y-4">
      <DatabaseAdminPanel />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">User accounts</h2>
          <p className="text-xs text-slate-500">{users.length} accounts · {counts.join(' · ')}</p>
        </div>
        <button onClick={() => setAdding(true)} title="Create an account with a chosen role" className="flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold hover:bg-indigo-500">
          <UserPlus size={14} /> Add new user
        </button>
      </div>
      {error && <div className="rounded-md bg-red-950 px-3 py-2 text-sm text-red-300">{error}</div>}
      <AdminUserCards
        users={users}
        loading={loading}
        meId={me?.id}
        isRootAdmin={isRootAdmin}
        busyId={busyId}
        onChangeRole={(u, role) => void changeRole(u, role)}
        onRename={setRenaming}
        onRemove={(u) => void remove(u)}
      />
      <div className="hidden overflow-x-auto rounded-lg border border-slate-800 fold:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-left text-xs uppercase text-slate-400">
            <tr>
              <th className="px-3 py-2">Username</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && users.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">Loading accounts…</td></tr>
            )}
            {users.map((u) => {
              const isSelf = u.id === me?.id;
              const locked = u.isRootAdmin || isSelf;
              const reason = u.isRootAdmin ? 'The root admin cannot be demoted or deleted' : 'You cannot change your own role or delete your account';
              return (
                <tr key={u.id} className="border-t border-slate-800">
                  <td className="px-3 py-2 font-medium">
                    <span className="flex items-center gap-1.5">
                      {u.username}
                      {u.isRootAdmin && <InfoTip text="Root admin"><Crown size={13} className="text-amber-400" /></InfoTip>}
                      {isSelf && <span className="rounded bg-slate-800 px-1.5 text-[10px] text-slate-400">you</span>}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-300">{u.email}</td>
                  <td className="px-3 py-2">
                    <select
                      value={u.role}
                      disabled={locked || busyId === u.id}
                      title={locked ? reason : 'Promote or demote this account'}
                      onChange={(e) => void changeRole(u, AuthUserRoleEnum.parse(e.target.value))}
                      className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs disabled:opacity-50"
                    >
                      {AuthUserRoleEnum.options.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-slate-400">{formatDate(u.createdAt)}</td>
                  <td className="px-3 py-2 text-right">
                    {(isRootAdmin || isSelf) && (
                      <button disabled={busyId === u.id} onClick={() => setRenaming(u)}
                        title="Change this account's username"
                        className="mr-2 rounded-md border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800">
                        Rename
                      </button>
                    )}
                    <button
                      disabled={locked || busyId === u.id}
                      onClick={() => void remove(u)}
                      title={locked ? reason : 'Permanently delete this account'}
                      className="inline-flex items-center gap-1 rounded-md border border-red-900 px-2 py-1 text-xs text-red-300 hover:bg-red-950 disabled:opacity-40"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {adding && (
        <AddUserModal
          onClose={() => setAdding(false)}
          onCreated={(created) => {
            setUsers((list) => [...list, created]);
            setAdding(false);
          }}
        />
      )}
      {renaming && <UsernameModal target={renaming} onClose={() => setRenaming(null)}
        onSaved={(updated) => {
          setUsers((list) => list.map((u) => u.id === updated.id ? updated : u));
          setRenaming(null);
        }} />}
    </div>
  );
};
