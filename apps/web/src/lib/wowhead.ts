const SCRIPT_URL = 'https://wow.zamimg.com/js/tooltips.js';
export const WOWHEAD_PATH = (import.meta.env['VITE_WOWHEAD_PATH'] as string | undefined) ?? 'forever';

interface WowheadPower {
  refreshLinks?: () => void;
}

declare global {
  interface Window {
    whTooltips?: Record<string, boolean>;
    $WowheadPower?: WowheadPower;
  }
}

export const itemUrl = (itemId: number): string => `https://www.wowhead.com/${WOWHEAD_PATH}/item=${itemId}`;
export const spellUrl = (spellId: number): string => `https://www.wowhead.com/${WOWHEAD_PATH}/spell=${spellId}`;

let loader: Promise<void> | null = null;

/** Loads Wowhead's tooltip script once; links are decorated by it (our own styling is kept). */
export const loadItemTooltips = (): Promise<void> => {
  loader ??= new Promise<void>((resolve) => {
    window.whTooltips = { colorLinks: false, iconizeLinks: false, renameLinks: false };
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    // Tooltips are an enhancement; the gear list still works if the script is blocked.
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
  return loader;
};

export const rescanItemTooltips = (): void => {
  window.$WowheadPower?.refreshLinks?.();
};
