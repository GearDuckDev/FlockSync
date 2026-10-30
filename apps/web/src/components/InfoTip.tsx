import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isTouchInteraction } from '../lib/wowheadTooltip';

interface Props {
  text: string | undefined;
  className?: string | undefined;
  children: React.ReactNode;
}

interface AnchorPos {
  top: number;
  above: boolean;
  align: 'left' | 'center' | 'right';
  x: number;
}

/** Preserves native hover tooltips on desktop and adds tap-to-reveal popovers on touch screens. */
export const InfoTip = ({ text, className, children }: Props): React.JSX.Element => {
  const [pos, setPos] = useState<AnchorPos | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const pointerRef = useRef('');

  const close = useCallback(() => setPos(null), []);

  useEffect(() => {
    if (!pos) return;
    const onPointerDown = (e: PointerEvent): void => {
      if (ref.current && e.target instanceof Node && ref.current.contains(e.target)) return;
      close();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [pos, close]);

  if (!text) return <>{children}</>;

  return (
    <>
      <span
        ref={ref}
        title={text}
        className={className}
        onPointerDown={(e) => {
          pointerRef.current = e.pointerType;
        }}
        onClick={(e) => {
          const pointer = pointerRef.current;
          pointerRef.current = '';
          if (!isTouchInteraction(pointer)) return;
          e.preventDefault();
          e.stopPropagation();
          if (pos) {
            setPos(null);
            return;
          }
          const rect = ref.current?.getBoundingClientRect();
          if (!rect) return;
          const vw = window.innerWidth;
          const centerX = rect.left + rect.width / 2;
          const above = rect.top > 88;
          const top = above ? rect.top - 8 : rect.bottom + 8;
          if (centerX < vw * 0.35) {
            setPos({ top, above, align: 'left', x: Math.max(12, rect.left) });
          } else if (centerX > vw * 0.65) {
            setPos({ top, above, align: 'right', x: Math.max(12, vw - rect.right) });
          } else {
            setPos({ top, above, align: 'center', x: centerX });
          }
        }}
      >
        {children}
      </span>
      {pos &&
        createPortal(
          <div
            role="tooltip"
            style={{
              top: `${pos.top}px`,
              ...(pos.align === 'right' ? { right: `${pos.x}px` } : { left: `${pos.x}px` }),
              transform: `${pos.align === 'center' ? 'translateX(-50%) ' : ''}${pos.above ? 'translateY(-100%)' : 'translateY(0)'}`,
            }}
            className="pointer-events-none fixed z-50 w-max max-w-[min(18rem,calc(100vw-1.5rem))] rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 shadow-xl"
          >
            {text}
          </div>,
          document.body,
        )}
    </>
  );
};
