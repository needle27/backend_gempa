import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Database, LoaderCircle, Sparkles } from 'lucide-react';
import { IS_PREVIEW_MODE } from '../config/env';
import { getActiveLanguage, useI18n } from '../i18n/LanguageContext';
import { displayValue, fieldLabel, friendlyErrorMessage, statusLabel } from '../utils/presentation';

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow || 'SEISMAP / INDONESIA'}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="page-heading-action">{action}</div>}</div>;
}

export function GlassCard({ children, className = '', title, subtitle, action }: { children?: ReactNode; className?: string; title?: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return <section className={`glass-card ${className}`}><div className="glass-card-inner">{(title || subtitle || action) && <div className="card-heading"><div>{title && (typeof title === 'string' ? <h3>{title}</h3> : title)}{subtitle && (typeof subtitle === 'string' ? <p>{subtitle}</p> : subtitle)}</div>{action}</div>}{children}</div></section>;
}

export function StatCard({ label, value, suffix, icon, trend, tone = 'cyan' }: { label: string; value: string | number; suffix?: string; icon: ReactNode; trend?: string; tone?: 'cyan' | 'violet' | 'teal' | 'amber' }) {
  return <div className={`stat-card stat-${tone}`}><div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><div className="stat-value">{value}{suffix && <small>{suffix}</small>}</div>{trend && <div className="stat-foot">{trend}</div>}</div>;
}

export function StatePanel({
  type,
  title,
  message,
  action,
  progress,
}: {
  type: 'loading' | 'empty' | 'error' | 'info';
  title: string;
  message: string;
  action?: ReactNode;
  progress?: number | null;
}) {
  const { lang, tx } = useI18n();
  const Icon = type === 'loading' ? LoaderCircle : type === 'error' ? AlertCircle : type === 'empty' ? Database : Sparkles;
  const visibleMessage = type === 'error' ? friendlyErrorMessage(message, undefined, undefined, lang) : message;
  const hasProgress = type === 'loading' && typeof progress === 'number' && Number.isFinite(progress);
  const clampedProgress = hasProgress ? Math.max(0, Math.min(100, Math.round(progress))) : 0;

  return (
    <div className={`state-panel state-${type}`}>
      <span className="state-icon">
        {type === 'loading' ? <Icon className="spin" size={20} /> : <Icon size={20} />}
      </span>
      <div className="state-panel-body">
        <strong>{title}</strong>
        <p>{visibleMessage}</p>
        {hasProgress && (
          <div className="state-progress" aria-live="polite">
            <div
              className="state-progress-bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={clampedProgress}
            >
              <span style={{ width: `${clampedProgress}%` }} />
            </div>
            <div className="state-progress-meta">
              <span>{tx('Memproses sebaran titik spasial', 'Processing spatial point distribution')}</span>
              <strong className="tabular-nums">{formatNumber(clampedProgress)}%</strong>
            </div>
          </div>
        )}
        {action && <div className="state-action">{action}</div>}
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const { lang } = useI18n();
  const normalized = status.toUpperCase();
  const tone = ['SUCCESS', 'READY', 'PROCESSED', 'ACTIVE', 'VALID', 'RECOMMENDED'].includes(normalized)
    ? 'success'
    : ['FAILED', 'CANCELLED', 'STOPPED', 'STOP_REQUESTED', 'ERROR', 'INVALID', 'NO_VALID_EXPERIMENT'].includes(normalized)
      ? 'danger'
      : ['RUNNING', 'CLUSTERING'].includes(normalized)
        ? 'running'
        : ['QUEUED', 'PENDING', 'PAUSE_REQUESTED', 'PAUSED'].includes(normalized)
          ? 'warning'
          : 'neutral';
  return <span className={`status-badge status-${tone}`} data-status={normalized}><i />{statusLabel(status, lang)}</span>;
}

export function PreviewBanner() {
  const { t } = useI18n();
  if (!IS_PREVIEW_MODE) return null;
  return <div className="preview-banner"><Sparkles size={14} /><strong>{t.common.previewBannerTitle}</strong><span>{t.common.previewBannerBody}</span></div>;
}

export function SimulationTag() {
  const { t } = useI18n();
  return IS_PREVIEW_MODE ? <span className="simulation-tag"><Sparkles size={11} /> {t.common.previewBadge}</span> : null;
}

export function SourceNote({ children }: { children: ReactNode }) {
  return <div className="source-note"><CheckCircle2 size={14} />{children}</div>;
}

export function PrimaryButton({ children, onClick, disabled, type = 'button', variant = 'primary' }: { children: ReactNode; onClick?: () => void; disabled?: boolean; type?: 'button' | 'submit'; variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  return <button className={`button button-${variant}`} type={type} onClick={onClick} disabled={disabled}>{children}</button>;
}

export function formatNumber(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const locale = getActiveLanguage() === 'en' ? 'en-US' : 'id-ID';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

const HIDDEN_DETAIL_FIELDS = new Set(['password', 'token', 'secret', 'authorization', 'cookie', 'user_agent', 'file_hash_sha256', 'eps_radian', 'error_code', 'request_id']);

function parseNestedRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string' && value.trim().startsWith('{')) {
    try { const parsed: unknown = JSON.parse(value); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>; } catch { /* Keep ordinary text as-is. */ }
  }
  return null;
}

export function RecordDetails({ record, omit = [], depth = 0 }: { record: Record<string, unknown>; omit?: string[]; depth?: number }) {
  const { lang, t, tx } = useI18n();
  const omitted = new Set([...HIDDEN_DETAIL_FIELDS, ...omit]);
  const entries = Object.entries(record).filter(([key, value]) => !omitted.has(key.toLowerCase()) && value !== undefined && value !== null && value !== '');
  if (!entries.length) return <p className="muted-text">{t.common.emptyAdditionalDetails}</p>;
  return <div className={`detail-grid record-detail-grid ${depth ? 'record-detail-nested' : ''}`}>{entries.map(([key, value]) => {
    const nestedRecord = parseNestedRecord(value);
    return <div className="detail-item" key={key}>
      <span>{fieldLabel(key, lang)}</span>
      {nestedRecord && depth < 2
        ? <details className="record-nested-details"><summary>{tx(`Lihat ${Object.keys(nestedRecord).length} rincian`, `View ${Object.keys(nestedRecord).length} details`)}</summary><RecordDetails record={nestedRecord} omit={omit} depth={depth + 1} /></details>
        : <strong>{nestedRecord ? tx('Rincian tambahan tersedia', 'Additional details available') : displayValue(value, key, lang)}</strong>}
    </div>;
  })}</div>;
}
