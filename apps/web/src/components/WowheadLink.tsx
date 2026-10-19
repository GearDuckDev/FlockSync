import type { Entity } from '../lib/wowheadNames';
import { itemUrl, spellUrl } from '../lib/wowhead';

interface Props {
  entity: Entity;
  name?: string | undefined;
  color?: string | undefined;
}

/** Link decorated by Wowhead's tooltip script (see loadItemTooltips). */
export const WowheadLink = ({ entity, name, color }: Props): React.JSX.Element => (
  <a
    href={entity.kind === 'spell' ? spellUrl(entity.id) : itemUrl(entity.id)}
    target="_blank"
    rel="noreferrer"
    className="font-medium hover:underline"
    style={color ? { color } : undefined}
  >
    {name ?? `${entity.kind === 'spell' ? 'Spell' : 'Item'} #${entity.id}`}
  </a>
);
