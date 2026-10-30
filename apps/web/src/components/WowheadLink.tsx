import { useRef, useState } from 'react';
import type { Entity } from '../lib/wowheadNames';
import { itemUrl, spellUrl } from '../lib/wowhead';
import { isTouchInteraction } from '../lib/wowheadTooltip';
import { WowheadTooltipModal } from './WowheadTooltipModal';

interface Props {
  entity: Entity;
  name?: string | undefined;
  color?: string | undefined;
  className?: string | undefined;
}

/** Link decorated by Wowhead's tooltip script on desktop; opens an in-app stat preview on touch. */
export const WowheadLink = ({ entity, name, color, className }: Props): React.JSX.Element => {
  const [open, setOpen] = useState(false);
  const pointerRef = useRef('');
  const href = entity.kind === 'spell' ? spellUrl(entity.id) : itemUrl(entity.id);
  const label = name ?? `${entity.kind === 'spell' ? 'Spell' : 'Item'} #${entity.id}`;

  return (
    <>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        onPointerDown={(e) => {
          pointerRef.current = e.pointerType;
        }}
        onClick={(e) => {
          const pointer = pointerRef.current;
          pointerRef.current = '';
          if (isTouchInteraction(pointer)) {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }
        }}
        className={`font-medium hover:underline ${className ?? ''}`.trim()}
        style={color ? { color } : undefined}
      >
        {label}
      </a>
      {open && (
        <WowheadTooltipModal
          entity={entity}
          href={href}
          fallbackName={label}
          fallbackColor={color}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};
