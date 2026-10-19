export interface ClassInfo {
  name: string;
  color: string;
}

export const CLASSES: Record<number, ClassInfo> = {
  1: { name: 'Warrior', color: '#C69B6D' },
  2: { name: 'Paladin', color: '#F48CBA' },
  3: { name: 'Hunter', color: '#AAD372' },
  4: { name: 'Rogue', color: '#FFF468' },
  5: { name: 'Priest', color: '#FFFFFF' },
  6: { name: 'Death Knight', color: '#C41E3A' },
  7: { name: 'Shaman', color: '#0070DD' },
  8: { name: 'Mage', color: '#3FC7EB' },
  9: { name: 'Warlock', color: '#8788EE' },
  10: { name: 'Monk', color: '#00FF98' },
  11: { name: 'Druid', color: '#FF7C0A' },
  12: { name: 'Demon Hunter', color: '#A330C9' },
};

export const classInfo = (id: number): ClassInfo => CLASSES[id] ?? { name: `Class ${id}`, color: '#94a3b8' };

export const SLOT_NAMES: Record<number, string> = {
  1: 'Head', 2: 'Neck', 3: 'Shoulder', 4: 'Shirt', 5: 'Chest', 6: 'Waist', 7: 'Legs', 8: 'Feet',
  9: 'Wrist', 10: 'Hands', 11: 'Finger 1', 12: 'Finger 2', 13: 'Trinket 1', 14: 'Trinket 2',
  15: 'Back', 16: 'Main Hand', 17: 'Off Hand', 18: 'Ranged', 19: 'Tabard',
};

const QUALITY_COLORS: Record<number, string> = {
  0: '#9d9d9d', 1: '#ffffff', 2: '#1eff00', 3: '#0070dd', 4: '#a335ee', 5: '#ff8000', 6: '#e6cc80',
};

export interface ParsedItem {
  name: string;
  color: string;
}

/** Item links look like "|cnIQ3:|Hitem:...|h[Name]|h|r" or "|cffa335ee|Hitem:...|h[Name]|h|r". */
export const parseItemLink = (link: string): ParsedItem => {
  const name = /\[([^\]]+)\]/.exec(link)?.[1] ?? 'Unknown item';
  const hex = /\|cff([0-9a-fA-F]{6})/.exec(link)?.[1];
  if (hex) return { name, color: `#${hex}` };
  const quality = /\|cnIQ(\d)/.exec(link)?.[1];
  return { name, color: QUALITY_COLORS[Number(quality ?? 1)] ?? '#ffffff' };
};
