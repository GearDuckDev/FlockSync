import { useState } from 'react';
import type { Character } from '@flocksync/shared-types';
import { LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from './AuthContext';
import { useDashboardData } from './hooks/useDashboardData';
import { RosterPage } from './RosterPage';
import { TeamBuilderPage } from './TeamBuilderPage';
import { RecruitmentPage } from './RecruitmentPage';
import { CrafterDirectoryPage } from './CrafterDirectoryPage';
import { GearGoalsPage } from './GearGoalsPage';
import { AttunementsPage } from './AttunementsPage';
import { LootAttendancePage } from './LootAttendancePage';
import { OfficerTasksPage } from './OfficerTasksPage';
import { AdminUsersPage } from './AdminUsersPage';
import { ServerUpdates } from './components/admin/ServerUpdates';
import { ServerUpdateBanner } from './components/ServerUpdateBanner';
import { UsernameModal } from './components/UsernameModal';
import { CreateTaskModal, type TaskDraft } from './components/tasks/CreateTaskModal';
import { ThemeSettingsPage } from './ThemeSettingsPage';
import { DashboardNav, TABS, type Access, type Tab } from './components/DashboardNav';

export const Dashboard = (): React.JSX.Element => {
  const { user, logout } = useAuth();
  const data = useDashboardData();
  const [tab, setTab] = useState<Tab>('roster');
  const [editingUsername, setEditingUsername] = useState(false);
  const canManage = user?.role === 'OFFICER' || user?.role === 'ADMIN';
  const isAdmin = user?.role === 'ADMIN';
  const canSee = (access: Access | undefined): boolean => access === undefined || (access === 'admin' ? isAdmin : canManage);
  const visibleTabs = TABS.filter((t) => canSee(t.access));
  const activeTab = canSee(TABS.find((t) => t.id === tab)?.access) ? tab : 'roster';
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const startTask = (c: Character, title: string): void => setDraft({ title, relatedCharacterGuid: c.guid });

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-3 fold:p-4 lg:space-y-5 lg:p-5">
      <header className="grid grid-cols-1 items-center gap-2.5 lg:grid-cols-[1fr_auto_1fr] lg:gap-3">
        <div className="flex items-baseline justify-between gap-2 lg:block">
          <h1 className="text-2xl font-bold">FlockSync</h1>
          {data.guild && (
            <div className="min-w-0 text-right lg:hidden">
              <div className="truncate text-base font-semibold">{data.guild.name}</div>
              {data.guild.realm && <div className="truncate text-xs text-slate-400">{data.guild.realm}</div>}
            </div>
          )}
        </div>
        <div className="hidden min-w-0 text-center text-xl font-semibold lg:block" title={data.guild?.realm}>
          {data.guild?.name}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm fold:gap-3 lg:justify-self-end">
          <span className="rounded-full bg-indigo-500 px-2 py-0.5 text-xs font-bold text-white">{user?.role}</span>
          <strong className="truncate">{user?.username}</strong>
          <button onClick={() => setEditingUsername(true)} title="Change your username"
            className="ml-auto rounded-md border border-slate-700 px-2.5 py-1.5 hover:bg-slate-800 lg:ml-0 lg:px-2 lg:py-1">Account</button>
          <button onClick={() => void data.reload()} className="flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 hover:bg-slate-800 lg:px-2 lg:py-1">
            <RefreshCw size={14} className={data.loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={logout} className="flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 hover:bg-slate-800 lg:px-2 lg:py-1">
            <LogOut size={14} /> Log out
          </button>
        </div>
      </header>
      <ServerUpdateBanner />
      <DashboardNav tabs={visibleTabs} activeTab={activeTab} onSelect={setTab} />
      {data.error && <div className="rounded-md bg-red-950 px-3 py-2 text-sm text-red-300">{data.error}</div>}
      {activeTab === 'roster' && <RosterPage data={data} canManage={canManage} onCreateTask={startTask} />}
      {activeTab === 'teams' && <TeamBuilderPage data={data} canManage={canManage} />}
      {activeTab === 'recruitment' && <RecruitmentPage data={data} />}
      {activeTab === 'crafters' && <CrafterDirectoryPage data={data} />}
      {activeTab === 'goals' && <GearGoalsPage data={data} />}
      {activeTab === 'attunements' && <AttunementsPage data={data} canManage={canManage} onCreateTask={startTask} />}
      {activeTab === 'ledger' && <LootAttendancePage data={data} />}
      {activeTab === 'theme' && <ThemeSettingsPage />}
      {activeTab === 'tasks' && <OfficerTasksPage data={data} />}
      {activeTab === 'admin' && <div className="space-y-5"><ServerUpdates /><AdminUsersPage /></div>}
      {editingUsername && user && <UsernameModal target={user}
        onClose={() => setEditingUsername(false)} onSaved={() => setEditingUsername(false)} />}
      {draft && <CreateTaskModal draft={draft} roster={data.roster} onError={data.handleError} onClose={() => setDraft(null)} />}
    </div>
  );
};
