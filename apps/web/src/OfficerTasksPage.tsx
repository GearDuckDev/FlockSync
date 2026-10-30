import { useCallback, useEffect, useState } from 'react';
import type { OfficerTask, TaskStatus } from '@flocksync/shared-types';
import { useAuth } from './AuthContext';
import type { DashboardData } from './hooks/useDashboardData';
import { deleteTask, fetchTasks, updateTask } from './lib/apiTrackC';
import { TASK_COLUMNS, TaskCard } from './components/tasks/TaskCard';
import { CreateTaskModal } from './components/tasks/CreateTaskModal';

export const OfficerTasksPage = ({ data }: { data: DashboardData }): React.JSX.Element => {
  const { token } = useAuth();
  const { roster, handleError } = data;
  const [tasks, setTasks] = useState<OfficerTask[]>([]);
  const [creating, setCreating] = useState(false);
  const [version, setVersion] = useState(0);

  const load = useCallback(async (): Promise<void> => {
    if (!token) return;
    try {
      setTasks(await fetchTasks(token));
    } catch (err) {
      handleError(err);
    }
  }, [token, handleError]);

  useEffect(() => {
    void load();
  }, [load, version]);

  const move = async (task: OfficerTask, status: TaskStatus): Promise<void> => {
    if (!token) return;
    try {
      const updated = await updateTask(token, task.id, {
        title: task.title,
        status,
        ...(task.description ? { description: task.description } : {}),
        ...(task.assignedOfficerId ? { assignedOfficerId: task.assignedOfficerId } : {}),
        ...(task.relatedCharacterGuid ? { relatedCharacterGuid: task.relatedCharacterGuid } : {}),
      });
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      handleError(err);
    }
  };

  const remove = async (task: OfficerTask): Promise<void> => {
    if (!token) return;
    try {
      await deleteTask(token, task.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    } catch (err) {
      handleError(err);
    }
  };

  const nameOf = (guid: string | undefined): string | undefined => roster.find((c) => c.guid === guid)?.name;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-400">Officer-only to-dos, optionally linked to a character.</p>
        <button onClick={() => setCreating(true)} className="rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-semibold text-white">Create task</button>
      </div>
      <div className="grid gap-4 fold:grid-cols-3">
        {TASK_COLUMNS.map(({ status, label }) => {
          const items = tasks.filter((t) => t.status === status);
          return (
            <section key={status} className="space-y-2 rounded-xl border border-slate-800 p-3">
              <h2 className="text-sm font-semibold">{label} <span className="text-slate-500">({items.length})</span></h2>
              <ul className="space-y-2">
                {items.map((t) => (
                  <TaskCard key={t.id} task={t} characterName={nameOf(t.relatedCharacterGuid)} onMove={(s) => void move(t, s)} onDelete={() => void remove(t)} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      {creating && (
        <CreateTaskModal
          draft={{ title: '' }}
          roster={roster}
          onError={handleError}
          onClose={() => {
            setCreating(false);
            setVersion((v) => v + 1);
          }}
        />
      )}
    </div>
  );
};
