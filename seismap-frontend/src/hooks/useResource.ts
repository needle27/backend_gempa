import { useCallback, useEffect, useRef, useState } from 'react';
import {
  callWithForceRefresh,
  getCacheScope,
  getMemoryEntryForLoader,
  subscribeCacheChanges,
  trackLoaderDependencies,
  type CacheChangeEvent,
} from '../utils/resourceCache';

export type ResourceState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

export function useResource<T>(loader: () => Promise<T>, dependencies: unknown[] = []): ResourceState<T> {
  const initialEntry = getMemoryEntryForLoader<T>(loader);
  const [data, setData] = useState<T | null>(() => (initialEntry ? initialEntry.data : null));
  const [loading, setLoading] = useState<boolean>(() => initialEntry === null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const trackedKeysRef = useRef<Set<string>>(new Set());
  const lastRevisionRef = useRef(0);

  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    const isManualReload = revision !== lastRevisionRef.current;
    lastRevisionRef.current = revision;

    const memEntry = getMemoryEntryForLoader<T>(loader);
    if (!isManualReload && memEntry) {
      setData(memEntry.data);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);

    const runLoad = () => {
      const tracked = trackLoaderDependencies(() => (
        isManualReload ? callWithForceRefresh(loader) : loader()
      ));
      trackedKeysRef.current = new Set(tracked.storageKeys);
      return tracked.promise;
    };

    runLoad()
      .then((result) => {
        if (active) {
          setData(result);
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Terjadi kesalahan.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const matchesTrackedKey = (event: CacheChangeEvent): boolean => {
      const keys = trackedKeysRef.current;
      if (!keys.size) return false;
      if (event.storageKey) return keys.has(event.storageKey);
      const scope = getCacheScope();
      const prefix = event.keyPrefix
        ? `${scope}:${event.namespace}:${event.keyPrefix}`
        : `${scope}:${event.namespace}:`;
      for (const storageKey of keys) {
        if (storageKey.startsWith(prefix)) return true;
      }
      return false;
    };

    const unsubscribe = subscribeCacheChanges((event) => {
      if (!active || !matchesTrackedKey(event)) return;
      queueMicrotask(() => {
        if (!active) return;
        const tracked = trackLoaderDependencies(() => loader());
        trackedKeysRef.current = new Set(tracked.storageKeys);
        tracked.promise
          .then((fresh) => {
            if (active) {
              setData(fresh);
              setError(null);
            }
          })
          .catch(() => {
            // Pertahankan data tampil saat pembaruan latar belakang gagal sementara.
          });
      });
    });

    return () => {
      active = false;
      unsubscribe();
    };
    // Loader identity is intentionally controlled by caller dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, revision]);

  return { data, loading, error, reload };
}
