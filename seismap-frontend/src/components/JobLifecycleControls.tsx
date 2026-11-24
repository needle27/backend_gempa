import { useEffect, useState } from 'react';
import { AlertTriangle, LoaderCircle, Pause, Play, RotateCcw, ShieldCheck, Square } from 'lucide-react';
import { IS_PREVIEW_MODE } from '../config/env';
import { restartJob, updateJobLifecycle, type JobLifecycleAction } from '../api/services';
import { useI18n } from '../i18n/LanguageContext';
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
  const { lang, tx } = useI18n();
  const [busyAction, setBusyAction] = useState<JobLifecycleAction | 'restart' | null>(null);
  const [pendingAction, setPendingAction] = useState<JobLifecycleAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [restartUnavailableFor, setRestartUnavailableFor] = useState<number | null>(null);
  const [showStopModal, setShowStopModal] = useState(false);

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

  const handleAction = async (action: JobLifecycleAction | 'restart') => {
    if (busyAction) return;
    setBusyAction(action);
    setError(null);
    setNotice(null);

    try {
      if (action === 'restart') {
        const result = await restartJob(job.id);
        if (!Number.isInteger(result.id) || result.id <= 0) {
          throw new Error(tx(
            'Backend menerima permintaan mulai ulang, tetapi tidak mengembalikan ID proses baru yang valid. Muat ulang daftar proses sebelum melanjutkan.',
            'Server accepted the restart request, but did not return a valid new job ID. Reload the job list before continuing.',
          ));
        }
        setNotice(tx(
          `Proses baru #${result.id} dibuat dari proses #${job.id}. Riwayat proses sebelumnya tetap tersimpan.`,
          `New job #${result.id} was created from job #${job.id}. Previous job history remains preserved.`,
        ));
        onRestarted?.(result.id);
      } else {
        await updateJobLifecycle(job.id, action);
        setPendingAction(action);
        const messages: Record<JobLifecycleAction, string> = {
          pause: tx('Permintaan jeda diterima. Proses akan berhenti setelah mencapai checkpoint aman.', 'Pause request received. The job will pause cleanly at the next safe checkpoint.'),
          resume: tx('Permintaan melanjutkan proses diterima. Status terbaru sedang diperiksa.', 'Resume request received. Refreshing job status.'),
          stop: tx('Permintaan penghentian diterima. Proses sedang dihentikan secara aman.', 'Stop request received. Terminating the job safely.'),
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
        ? friendlyErrorMessage(apiError.message, apiError.code, apiError.status, lang)
        : reason instanceof Error ? reason.message : tx('Tindakan terhadap proses gagal dilakukan.', 'Failed to update job lifecycle.'));
      if (apiError?.status === 500 || apiError?.code === 'JOB_LIFECYCLE_FAILED') onJobChanged?.();
    } finally {
      setBusyAction(null);
    }
  };

  return <section className="job-lifecycle-panel" aria-live="polite">
    <div className="job-lifecycle-heading">
      <div><strong>{tx('Kendali proses', 'Job Controls')}</strong><small>{tx('Perubahan status diproses oleh sistem.', 'Status transitions are managed by the system.')}</small></div>
      {isPaused && <span className="job-checkpoint-label"><ShieldCheck size={13} /> {tx('Checkpoint aman', 'Safe checkpoint')}</span>}
    </div>

    {isQueuedOrRunning && <div className="job-lifecycle-actions">
      <button className="button button-secondary" type="button" disabled={Boolean(busyAction)} onClick={() => void handleAction('pause')}>
        {busyAction === 'pause' ? <LoaderCircle className="spin" size={14} /> : <Pause size={14} />} {tx('Jeda Proses', 'Pause Job')}
      </button>
      <button className="button button-danger" type="button" disabled={Boolean(busyAction)} onClick={() => setShowStopModal(true)}>
        {busyAction === 'stop' ? <LoaderCircle className="spin" size={14} /> : <Square size={13} />} {tx('Hentikan Proses', 'Stop Job')}
      </button>
    </div>}

    {isPaused && <>
      <div className="job-lifecycle-state job-lifecycle-state-paused"><ShieldCheck size={16} /><div><strong>{tx('Proses dijeda dengan aman', 'Job safely paused')}</strong><span>{tx('Proses dapat dilanjutkan dari checkpoint terakhir.', 'Execution can resume from the last checkpoint.')}</span></div></div>
      {job.paused_at && <p className="job-lifecycle-timestamp">{tx('Dijeda pada', 'Paused at')} {formatDate(job.paused_at)}</p>}
      {job.checkpoint_data && <p className="job-lifecycle-hint">{tx('Data checkpoint tersedia untuk melanjutkan proses.', 'Checkpoint data is available to resume execution.')}</p>}
      <div className="job-lifecycle-actions">
        <button className="button button-primary" type="button" disabled={Boolean(busyAction)} onClick={() => void handleAction('resume')}>
          {busyAction === 'resume' ? <LoaderCircle className="spin" size={14} /> : <Play size={14} />} {tx('Lanjutkan', 'Resume')}
        </button>
        <button className="button button-danger" type="button" disabled={Boolean(busyAction)} onClick={() => setShowStopModal(true)}>
          {busyAction === 'stop' ? <LoaderCircle className="spin" size={14} /> : <Square size={13} />} {tx('Hentikan Proses', 'Stop Job')}
        </button>
      </div>
    </>}

    {isPausing && <div className="job-lifecycle-state job-lifecycle-state-pending"><LoaderCircle className="spin" size={16} /><div><strong>{tx('Sedang menjeda…', 'Pausing…')}</strong><span>{tx('Menunggu proses mencapai checkpoint aman. Status akan berubah menjadi Dijeda.', 'Waiting for a safe checkpoint before entering Paused status.')}</span></div></div>}
    {isStopping && <div className="job-lifecycle-state job-lifecycle-state-pending"><LoaderCircle className="spin" size={16} /><div><strong>{tx('Sedang menghentikan…', 'Stopping…')}</strong><span>{tx('Sistem sedang menyelesaikan penghentian proses. Status akhir diperbarui otomatis.', 'System is terminating the job cleanly. Final status will update automatically.')}</span></div></div>}
    {isResuming && <div className="job-lifecycle-state job-lifecycle-state-pending"><LoaderCircle className="spin" size={16} /><div><strong>{tx('Sedang melanjutkan…', 'Resuming…')}</strong><span>{tx('ID proses tetap sama. Sistem sedang memulihkan dari checkpoint terakhir.', 'Job ID remains unchanged while resuming from the last checkpoint.')}</span></div></div>}

    {canRestartByStatus && restartUnavailableFor !== job.id && <div className="job-lifecycle-actions">
      <button className="button button-secondary" type="button" disabled={Boolean(busyAction)} onClick={() => void handleAction('restart')}>
        {busyAction === 'restart' ? <LoaderCircle className="spin" size={14} /> : <RotateCcw size={14} />} {tx('Mulai Ulang sebagai Proses Baru', 'Restart as New Job')}
      </button>
      <p className="job-lifecycle-hint">{tx('Sistem akan memeriksa apakah konfigurasi awal proses ini masih tersedia.', 'The system checks whether the original job configuration is still available.')}</p>
    </div>}
    {canRestartByStatus && restartUnavailableFor === job.id && <div className="job-lifecycle-state job-lifecycle-state-unavailable"><AlertTriangle size={16} /><div><strong>{tx('Mulai ulang tidak tersedia', 'Restart unavailable')}</strong><span>{tx('Permintaan ditolak untuk proses ini. Proses lama tetap tersimpan dalam riwayat.', 'Restart was rejected for this job. Historical record remains intact.')}</span></div></div>}

    {isPausing && job.job_type === 'FINAL_CLUSTERING' && <p className="job-lifecycle-hint">{tx('Pada DBSCAN Final, jeda menunggu batas tahap yang aman.', 'In Final DBSCAN, pause takes effect at the next safe execution boundary.')}</p>}
    {isPaused && job.job_type === 'FINAL_CLUSTERING' && <p className="job-lifecycle-hint">{tx('Saat dilanjutkan, proses dapat menghitung ulang tahap DBSCAN dari checkpoint aman.', 'When resumed, execution continues safely from the saved checkpoint.')}</p>}
    {(isPausing || isPaused) && job.job_type === 'PARAMETER_SEARCH' && <p className="job-lifecycle-hint">{tx('Saat dilanjutkan, kombinasi parameter yang sudah tersimpan akan dilewati.', 'When resumed, previously completed parameter combinations are skipped.')}</p>}

    {notice && <div className="job-lifecycle-feedback job-lifecycle-feedback-success">{notice}</div>}
    {error && <div className="job-lifecycle-feedback job-lifecycle-feedback-error">{error}</div>}

    <ConfirmModal
      isOpen={showStopModal}
      variant="danger"
      title={tx('Konfirmasi Penghentian Proses', 'Confirm Stop Job')}
      confirmLabel={tx('Ya, Hentikan Proses', 'Yes, Stop Job')}
      cancelLabel={tx('Batal', 'Cancel')}
      loading={busyAction === 'stop'}
      onCancel={() => setShowStopModal(false)}
      onConfirm={() => {
        setShowStopModal(false);
        void handleAction('stop');
      }}
      message={
        <div>
          <p>
            {tx(
              <>Hentikan proses <strong>#{job.id}</strong> ({job.job_type === 'PARAMETER_SEARCH' ? 'Pencarian Parameter' : 'DBSCAN Final'}) secara aman?</>,
              <>Stop job <strong>#{job.id}</strong> ({job.job_type === 'PARAMETER_SEARCH' ? 'Parameter Search' : 'Final DBSCAN'}) safely?</>,
            )}
          </p>
          <p style={{ marginTop: '8px', color: '#ffb3c0', fontSize: '12px' }}>
            {tx('Perhatian: Proses tidak dapat dilanjutkan kembali setelah statusnya menjadi Dihentikan/Dibatalkan.', 'Warning: A stopped or cancelled job cannot be resumed later.')}
          </p>
        </div>
      }
    />
  </section>;
}
