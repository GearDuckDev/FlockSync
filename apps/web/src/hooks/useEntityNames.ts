import { useEffect, useMemo, useState } from 'react';
import { cachedName, entityKey, resolveNames, type Entity } from '../lib/wowheadNames';

/** Resolves Wowhead names for the given entities in the background and re-renders as they arrive. */
export const useEntityNames = (entities: Entity[]): ((e: Entity) => string | undefined) => {
  const [version, setVersion] = useState(0);
  const signature = useMemo(() => entities.map(entityKey).join(','), [entities]);

  useEffect(() => {
    let cancelled = false;
    void resolveNames(entities, () => {
      if (!cancelled) setVersion((v) => v + 1);
    });
    return () => {
      cancelled = true;
    };
    // The signature captures the entity list; the array identity changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  // version is intentionally part of the closure so consumers re-render on new names.
  return useMemo(() => (e: Entity) => cachedName(e), [version]);
};
