import { useCallback, useEffect, useState } from 'react';

export type ResourceState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

export function useResource<T>(loader: () => Promise<T>, dependencies: unknown[] = []): ResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    loader().then((result) => { if (active) setData(result); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Terjadi kesalahan.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // Loader identity is intentionally controlled by caller dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, revision]);

  return { data, loading, error, reload };
}
