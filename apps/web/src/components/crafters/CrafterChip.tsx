import type { Crafter } from '../../lib/crafters';
import { presenceOf, type PresenceTone } from '../../lib/presence';
import { classInfo } from '../../lib/wow';

const TONES: Record<PresenceTone, string> = {
  online: 'bg-emerald-950 text-emerald-300',
  tonight: 'bg-sky-950 text-sky-300',
  maybe: 'bg-amber-950 text-amber-300',
  offline: 'bg-slate-800 text-slate-400',
};

export const CrafterChip = ({ crafter }: { crafter: Crafter }): React.JSX.Element => {
  const { character, skill, maxLevel, accepting } = crafter;
  const info = classInfo(character.classId);
  const presence = presenceOf(character);
  return (
    <li
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2 text-sm ${accepting ? 'border-emerald-500/60 bg-emerald-950/30' : 'border-slate-800 bg-slate-900'}`}
    >
      <span className="font-semibold" style={{ color: info.color }}>{character.name}</span>
      <span className="text-xs text-slate-500">Lv {character.level} {info.name}</span>
      <span className="text-xs text-slate-400">{skill}/{maxLevel}</span>
      {accepting && <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-emerald-950">Accepting requests</span>}
      <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${TONES[presence.tone]}`} title={presence.detail}>
        {presence.label}
      </span>
    </li>
  );
};
