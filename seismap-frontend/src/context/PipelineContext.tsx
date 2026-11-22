import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

function readSessionNumber(key: string): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.sessionStorage.getItem(key);
    if (!stored) return null;
    const value = Number(stored);
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch { return null; }
}

function persistSessionNumber(key: string, value: number | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, String(value));
  } catch { /* Session storage may be disabled by the browser. */ }
}

interface PipelineContextValue {
  selectedDatasetId: number | null;
  parameterJobId: number | null;
  setSelectedDatasetId: (id: number | null) => void;
  setParameterJobId: (id: number | null) => void;
}
const PipelineContext = createContext<PipelineContextValue | null>(null);

export function PipelineProvider({ children }: { children: ReactNode }) {
  const [selectedDatasetId, setSelectedDatasetIdState] = useState<number | null>(() => readSessionNumber('seismap:selectedDatasetId'));
  const [parameterJobId, setParameterJobIdState] = useState<number | null>(() => readSessionNumber('seismap:parameterJobId'));
  const setSelectedDatasetId = (id: number | null) => {
    if (id !== selectedDatasetId) {
      setParameterJobIdState(null);
      persistSessionNumber('seismap:parameterJobId', null);
    }
    setSelectedDatasetIdState(id);
    persistSessionNumber('seismap:selectedDatasetId', id);
  };
  const setParameterJobId = (id: number | null) => { setParameterJobIdState(id); persistSessionNumber('seismap:parameterJobId', id); };
  const value = useMemo(() => ({ selectedDatasetId, parameterJobId, setSelectedDatasetId, setParameterJobId }), [selectedDatasetId, parameterJobId]);
  return <PipelineContext.Provider value={value}>{children}</PipelineContext.Provider>;
}

export function usePipeline() {
  const value = useContext(PipelineContext);
  if (!value) throw new Error('usePipeline harus digunakan di dalam PipelineProvider.');
  return value;
}
