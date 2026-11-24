import { useEffect, useState } from 'react';
import { AlertTriangle, LoaderCircle, Pause, Play, RotateCcw, ShieldCheck, Square } from 'lucide-react';
import { IS_PREVIEW_MODE } from '../config/env';
import { restartJob, updateJobLifecycle, type JobLifecycleAction } from '../api/services';
import { ApiError } from '../types/api';
import type { ProcessingJob } from '../types/domain';
import { formatDate } from './ui';
import { friendlyErrorMessage } from '../utils/presentation';
import { ConfirmModal } from './admin/ConfirmModal';

interface JobLifecycleControlsProps {
  job: ProcessingJob;
  onJobChanged?: () => void;
  onRestarted?: (newJobId: number) => void;
}

export function JobLifecycleControls({ job, onJobChanged, onRestarted }: JobLifecycleControlsProps) {
  const [busyAction, setBusyAction] = useState<JobLifecycleAction | 'restart' | null>(null);
  const [pendingAction, setPendingAction] = useState<JobLifecycleAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [restartUnavailableFor, setRestartUnavailableFor] = useState<number | null>(null);

  useEffect(() => {
    setBusyAction(null);
    setPendingAction(null);
    setError(null);
    setNotice(null);
    setRestartUnavailableFor(null);
  }, [job.id]);

  useEffect(() => {
    if (pendingAction === 'pause' && ['PAUSE_REQUESTED', 'PAUSED', 'SUCCESS', 'FAILED', 'CANCELLED'].includes(job.status)) setPendingAction(null);
    if (pendingAction === 'stop' && ['STOP_REQUESTED', 'SUCCESS', 'FAILED', 'CANCELLED'].includes(job.status)) setPendingAction(null);
    if (pendingAction === 'resume' && job.status !== 'PAUSED') setPendingAction(null);
  }, [job.status, pendingAction]);

  if (IS_PREVIEW_MODE || job.status === 'SUCCESS') return null;

  const displayStatus = pendingAction === 'pause' && ['QUEUED', 'RUNNING'].includes(job.status)
    ? 'PAUSE_REQUESTED'
    : pendingAction === 'stop' && ['QUEUED', 'RUNNING', 'PAUSE_REQUESTED', 'PAUSED'].includes(job.status)
      ? 'STOP_REQUESTED'
      : pendingAction === 'resume' && job.status === 'PAUSED' ? 'RESUMING' : job.status;
  const isQueuedOrRunning = displayStatus === 'QUEUED' || displayStatus === 'RUNNING';
  const isPaused = displayStatus === 'PAUSED';
  const isPausing = displayStatus === 'PAUSE_REQUESTED';
  const isStopping = displayStatus === 'STOP_REQUESTED';
  const isResuming = displayStatus === 'RESUMING';
  const canRestartByStatus = job.status === 'FAILED' || job.status === 'CANCELLED';
  const showPanel = isQueuedOrRunning || isPaused || isPausing || isStopping || canRestartByStatus;
  if (!showPanel) return null;

  const [showStopModal, setShowStopModal] = useState(false);

  const handleAction = async (action: JobLifecycleAction | 'restart') => {
    if (busyAction) return;
    setBusyAction(action);
    setError(null);
    setNotice(null);

    try {
      if (action === 'restart') {
        const result = await restartJob(job.id);
        if (!Number.isInteger(result.id) || result.id <= 0) {
          throw new Error('Backend menerima permintaan mulai ulang, tetapi tidak mengembalikan ID proses baru yang valid. Muat ulang daftar proses sebelum melanjutkan.');
        }
        setNotice(`Proses baru #${result.id} dibuat dari proses #${job.id}. Riwayat proses sebelumnya tetap tersimpan.`);
        onRestarted?.(result.id);
      } else {
        await updateJobLifecycle(job.id, action);
        setPendingAction(action);
        const messages: Record<JobLifecycleAction, string> = {
          pause: 'Permintaan jeda diterima. Proses akan berhenti setelah mencapai checkpoint aman.',
          resume: 'Permintaan melanjutkan proses diterima. Status terbaru sedang diperiksa.',
          stop: 'Permintaan penghentian diterima. Proses sedang dihentikan secara aman.',
        };
        setNotice(messages[action]);
        onJobChanged?.();
      }
    } catch (reason) {
      setPendingAction(null);
      const apiError = reason instanceof ApiError ? reason : null;
      if (action === 'restart' && apiError?.status === 409 && apiError.code === 'JOB_LIFECYCLE_CONFLICT') {
        setRestartUnavailableFor(job.id);
      }
      setError(apiError
        ? friendlyErrorMessage(apiError.message, apiError.code, apiError.status)
        : reason instanceof Error ? reason.message : 'Tindakan terhadap proses gagal dilakukan.');
      if (apiError?.status === 500 || apiError?.code === 'JOB_LIFECYCLE_FAILED') onJobChanged?.();
    } finally {
      setBusyAction(null);
    }
  };

  return <section className="job-lifecycle-panel" aria-live="polite">
    <div className="job-lifecycle-heading">
      <div><strong>Kendali proses</strong><small>Perubahan status diproses oleh backend.</small></div>
      {isPaused && <span className="job-checkpoint-label"><ShieldCheck size={13} /> Checkpoint aman</span>}
    </div>

    {isQueuedOrRunning && <div className="job-lifecycle-actions">
      <button className="button button-secondary" type="button" disabled={Boolean(busyAction)} onClick={() => void handleAction('pause')}>
        {busyAction === 'pause' ? <LoaderCircle className="spin" size={14} /> : <Pause size={14} />} Jeda Proses
      </button>
      <button className="button button-danger" type="button" disabled={Boolean(busyAction)} onClick={() => setShowStopModal(true)}>
        {busyAction === 'stop' ? <LoaderCircle className="spin" size={14} /> : <Square size={13} />} Hentikan Proses
      </button>
    </div>}

    {isPaused && <>
      <div className="job-lifecycle-state job-lifecycle-state-paused"><ShieldCheck size={16} /><div><strong>Proses dijeda dengan aman</strong><span>Proses dapat dilanjutkan dari checkpoint terakhir.</span></div></div>
      {job.paused_at && <p className="job-lifecycle-timestamp">Dijeda pada {formatDate(job.paused_at)}</p>}
      {job.checkpoint_data && <p className="job-lifecycle-hint">Data checkpoint tersedia untuk melanjutkan proses.</p>}
      <div className="job-lifecycle-actions">
        <button className="button button-primary" type="button" disabled={Boolean(busyAction)} onClick={() => void handleAction('resume')}>
          {busyAction === 'resume' ? <LoaderCircle className="spin" size={14} /> : <Play size={14} />} Lanjutkan
        </button>
        <button className="button button-danger" type="button" disabled={Boolean(busyAction)} onClick={() => setShowStopModal(true)}>
          {busyAction === 'stop' ? <LoaderCircle className="spin" size={14} /> : <Square size={13} />} Hentikan Proses
        </button>
      </div>
    </>}

    {isPausing && <div className="job-lifecycle-state job-lifecycle-state-pending"><LoaderCircle className="spin" size={16} /><div><strong>Sedang menjeda…</strong><span>Menunggu worker mencapai checkpoint aman. Proses belum dianggap dijeda sampai status berubah menjadi Dijeda.</span></div></div>}
    {isStopping && <div className="job-lifecycle-state job-lifecycle-state-pending"><LoaderCircle className="spin" size={16} /><div><strong>Sedang menghentikan…</strong><span>Backend sedang menyelesaikan penghentian proses. Status akhir akan diperbarui otomatis.</span></div></div>}
    {isResuming && <div className="job-lifecycle-state job-lifecycle-state-pending"><LoaderCircle className="spin" size={16} /><div><strong>Sedang melanjutkan…</strong><span>Job ID tetap sama. Sistem sedang memeriksa worker dan checkpoint terakhir.</span></div></div>}

    {canRestartByStatus && restartUnavailableFor !== job.id && <div className="job-lifecycle-actions">
      <button className="button button-secondary" type="button" disabled={Boolean(busyAction)} onClick={() => void handleAction('restart')}>
        {busyAction === 'restart' ? <LoaderCircle className="spin" size={14} /> : <RotateCcw size={14} />} Mulai Ulang sebagai Proses Baru
      </button>
      <p className="job-lifecycle-hint">Backend akan memeriksa apakah konfigurasi awal proses ini masih tersedia.</p>
    </div>}
    {canRestartByStatus && restartUnavailableFor === job.id && <div className="job-lifecycle-state job-lifecycle-state-unavailable"><AlertTriangle size={16} /><div><strong>Mulai ulang tidak tersedia</strong><span>Backend menolak permintaan untuk proses ini. Proses lama tetap tersimpan dalam riwayat.</span></div></div>}

    {isPausing && job.job_type === 'FINAL_CLUSTERING' && <p className="job-lifecycle-hint">Pada Final DBSCAN, jeda menunggu batas tahap yang aman. Jika DBSCAN sedang menghitung, permintaan jeda baru diakui setelah perhitungan tersebut selesai; tahap itu dapat dihitung ulang saat dilanjutkan.</p>}
    {isPaused && job.job_type === 'FINAL_CLUSTERING' && <p className="job-lifecycle-hint">Saat dilanjutkan, proses dapat menghitung ulang tahap DBSCAN dari checkpoint aman. Label hasil fit tidak disimpan sebagai file checkpoint.</p>}
    {(isPausing || isPaused) && job.job_type === 'PARAMETER_SEARCH' && <p className="job-lifecycle-hint">Saat dilanjutkan, kombinasi parameter yang sudah tersimpan akan dilewati. Artefak K-Distance dan Elbow dapat dibuat ulang secara aman.</p>}

    {notice && <div className="job-lifecycle-feedback job-lifecycle-feedback-success">{notice}</div>}
    {error && <div className="job-lifecycle-feedback job-lifecycle-feedback-error">{error}</div>}

    <ConfirmModal
      isOpen={showStopModal}
      variant="danger"
      title="Konfirmasi Penghentian Proses"
      confirmLabel="Ya, Hentikan Proses"
      cancelLabel="Batal"
      loading={busyAction === 'stop'}
      onCancel={() => setShowStopModal(false)}
      onConfirm={() => {
        setShowStopModal(false);
        void handleAction('stop');
      }}
      message={
        <div>
          <p>
            Hentikan proses <strong>#{job.id}</strong> ({job.job_type === 'PARAMETER_SEARCH' ? 'Pencarian Parameter' : 'DBSCAN Final'}) secara aman?
          </p>
          <p style={{ marginTop: '8px', color: '#ffb3c0', fontSize: '12px' }}>
            Perhatian: Proses tidak dapat dilanjutkan kembali setelah statusnya menjadi Dihentikan/Dibatalkan.
          </p>
        </div>
      }
    />
  </section>;
}
