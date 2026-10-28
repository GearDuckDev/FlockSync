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

type Tab = 'roster' | 'teams' | 'recruitment' | 'crafters' | 'goals' | 'attunements' | 'ledger' | 'tasks' | 'admin' | 'theme';

type Access = 'officer' | 'admin';

const TABS: { id: Tab; label: string; access?: Access }[] = [
  { id: 'roster', label: 'Roster & Gear' },
  { id: 'teams', label: 'Team Builder (10/20/40)' },
  { id: 'recruitment', label: 'Availability & Recruitment' },
  { id: 'crafters', label: 'Crafter Directory' },
  { id: 'goals', label: 'Gear Goals' },
  { id: 'attunements', label: 'Attunements' },
  { id: 'ledger', label: 'Loot & Attendance' },
  { id: 'tasks', label: 'Officer Tasks', access: 'officer' },
  { id: 'admin', label: 'Admin Settings', access: 'admin' },
  { id: 'theme', label: 'Theme Settings' },
];

export const Dashboard = (): React.JSX.Element => {
  const { user, logout } = useAuth();
  const data = useDashboardData();
  const [tab, setTab] = useState<Tab>('roster');
  const [editingUsername, setEditingUsername] = useState(false);
  const canManage = user?.role === 'OFFICER' || user?.role === 'ADMIN';
  const isAdmin = user?.role === 'ADMIN';
  const canSee = (access: Access | undefined): boolean => access === undefined || (access === 'admin' ? isAdmin : canManage);
  const activeTab = canSee(TABS.find((t) => t.id === tab)?.access) ? tab : 'roster';
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const startTask = (c: Character, title: string): void => setDraft({ title, relatedCharacterGuid: c.guid });

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-5">
      <header className="grid grid-cols-1 items-center gap-3 lg:grid-cols-[1fr_auto_1fr]">
        <h1 className="text-2xl font-bold">FlockSync</h1>
        <div className="min-w-0 text-center text-xl font-semibold" title={data.guild?.realm}>
          {data.guild?.name}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm lg:justify-self-end">
          <span className="rounded-full bg-indigo-500 px-2 py-0.5 text-xs font-bold text-white">{user?.role}</span>
          <strong>{user?.username}</strong>
          <button onClick={() => setEditingUsername(true)} title="Change your username"
            className="rounded-md border border-slate-700 px-2 py-1 hover:bg-slate-800">Account</button>
          <button onClick={() => void data.reload()} className="flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 hover:bg-slate-800">
            <RefreshCw size={14} className={data.loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={logout} className="flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 hover:bg-slate-800">
            <LogOut size={14} /> Log out
          </button>
        </div>
      </header>
      <ServerUpdateBanner />
      <nav className="flex flex-wrap gap-1 border-b border-slate-800">
        {TABS.filter((t) => canSee(t.access)).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${activeTab === t.id ? 'border-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            {t.label}
          </button>
        ))}
      </nav>
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
