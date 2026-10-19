import type { OfficerTask, TaskStatus } from '@flocksync/shared-types';

const STATUSES: TaskStatus[] = ['OPEN', 'IN_PROGRESS', 'COMPLETED'];
const LABEL: Record<TaskStatus, string> = { OPEN: 'Open', IN_PROGRESS: 'In progress', COMPLETED: 'Completed' };

interface Props {
  task: OfficerTask;
  characterName: string | undefined;
  onMove: (status: TaskStatus) => void;
  onDelete: () => void;
}

export const TaskCard = ({ task, characterName, onMove, onDelete }: Props): React.JSX.Element => (
  <li className="space-y-2 rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm">
    <div className="font-medium">{task.title}</div>
    {characterName && <div className="text-xs text-indigo-300">Re: {characterName}</div>}
    {task.description && <p className="whitespace-pre-wrap text-xs text-slate-400">{task.description}</p>}
    <div className="flex flex-wrap items-center gap-1">
      {STATUSES.filter((s) => s !== task.status).map((s) => (
        <button key={s} onClick={() => onMove(s)} className="rounded-md border border-slate-700 px-2 py-0.5 text-xs hover:bg-slate-800">
          → {LABEL[s]}
        </button>
      ))}
      <button onClick={onDelete} className="ml-auto rounded-md border border-red-900 px-2 py-0.5 text-xs text-red-300 hover:bg-red-950">Delete</button>
    </div>
  </li>
);

export const TASK_COLUMNS = STATUSES.map((status) => ({ status, label: LABEL[status] }));
