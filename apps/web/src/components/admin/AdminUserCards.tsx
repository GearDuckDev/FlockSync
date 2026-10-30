import { AuthUserRoleEnum, type AuthUserRole, type ManagedUser } from '@flocksync/shared-types';
import { Crown, Trash2 } from 'lucide-react';
import { InfoTip } from '../InfoTip';

interface Props {
  users: ManagedUser[];
  loading: boolean;
  meId: string | undefined;
  isRootAdmin: boolean;
  busyId: string | null;
  onChangeRole: (user: ManagedUser, role: AuthUserRole) => void;
  onRename: (user: ManagedUser) => void;
  onRemove: (user: ManagedUser) => void;
}

const formatDate = (epoch: number): string => new Date(epoch * 1000).toLocaleDateString();

export const AdminUserCards = ({
  users, loading, meId, isRootAdmin, busyId, onChangeRole, onRename, onRemove,
}: Props): React.JSX.Element => (
  <div className="space-y-2.5 fold:hidden">
    {loading && users.length === 0 && (
      <div className="rounded-lg border border-slate-800 px-3 py-6 text-center text-sm text-slate-500">
        Loading accounts…
      </div>
    )}
    {users.map((u) => {
      const isSelf = u.id === meId;
      const locked = u.isRootAdmin || isSelf;
      const reason = u.isRootAdmin
        ? 'The root admin cannot be demoted or deleted'
        : 'You cannot change your own role or delete your account';
      return (
        <div key={u.id} className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-semibold">
                <span className="truncate">{u.username}</span>
                {u.isRootAdmin && (
                  <InfoTip text="Root admin">
                    <Crown size={13} className="text-amber-400" />
                  </InfoTip>
                )}
                {isSelf && <span className="rounded bg-slate-800 px-1.5 text-[10px] text-slate-400">you</span>}
              </div>
              <div className="truncate text-xs text-slate-400">{u.email}</div>
            </div>
            <span className="shrink-0 text-xs text-slate-500">{formatDate(u.createdAt)}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <select
              value={u.role}
              disabled={locked || busyId === u.id}
              aria-label={`Role for ${u.username}`}
              onChange={(e) => onChangeRole(u, AuthUserRoleEnum.parse(e.target.value))}
              className="rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs disabled:opacity-50"
            >
              {AuthUserRoleEnum.options.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {(isRootAdmin || isSelf) && (
              <button
                type="button"
                disabled={busyId === u.id}
                onClick={() => onRename(u)}
                className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs hover:bg-slate-800"
              >
                Rename
              </button>
            )}
            <button
              type="button"
              disabled={locked || busyId === u.id}
              onClick={() => onRemove(u)}
              className="ml-auto inline-flex items-center gap-1 rounded-md border border-red-900 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-950 disabled:opacity-40"
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
          {locked && <p className="text-[11px] text-slate-500">{reason}.</p>}
        </div>
      );
    })}
  </div>
);
