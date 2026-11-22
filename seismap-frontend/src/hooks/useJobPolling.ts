import { useEffect, useRef, useState } from 'react';
import { getJob } from '../api/services';
import type { ProcessingJob } from '../types/domain';

const POLLING_STATUSES = new Set(['QUEUED', 'RUNNING', 'PAUSE_REQUESTED', 'STOP_REQUESTED']);
const POLLING_INTERVAL_MS = 3000;

export function useJobPolling(jobId: number | null) {
  const [job, setJob] = useState<ProcessingJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const forcePollRemaining = useRef(0);

  useEffect(() => {
    setJob(null);
    setError(null);
    forcePollRemaining.current = 0;
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;
    let active = true;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const isVisible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';
    const schedule = (delay: number) => {
      if (active && isVisible()) timer = window.setTimeout(poll, delay);
    };

    const poll = async () => {
      if (!active || !isVisible() || inFlight) return;
      inFlight = true;
      try {
        const result = await getJob(jobId);
        if (!active) return;
        setJob(result);
        setError(null);
        if (result.status === 'PAUSED' && forcePollRemaining.current > 0) {
          forcePollRemaining.current -= 1;
          schedule(POLLING_INTERVAL_MS);
        } else if (POLLING_STATUSES.has(result.status)) {
          forcePollRemaining.current = 0;
          schedule(POLLING_INTERVAL_MS);
        } else {
          forcePollRemaining.current = 0;
        }
      } catch (reason) {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : 'Tidak dapat memuat status proses.');
      } finally {
        inFlight = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (timer) window.clearTimeout(timer);
        timer = undefined;
      } else {
        if (timer) window.clearTimeout(timer);
        timer = undefined;
        void poll();
      }
    };

    setError(null);
    if (isVisible()) void poll();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [jobId, retryKey]);

  return {
    job,
    error,
    reload: () => {
      forcePollRemaining.current = 20;
      setRetryKey((value) => value + 1);
    },
  };
}
