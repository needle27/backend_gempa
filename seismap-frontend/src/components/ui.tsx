import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Database, LoaderCircle, Sparkles } from 'lucide-react';
import { IS_PREVIEW_MODE } from '../config/env';
import { displayValue, fieldLabel, friendlyErrorMessage, statusLabel } from '../utils/presentation';

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow || 'SEISMAP / INDONESIA'}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="page-heading-action">{action}</div>}</div>;
}

export function GlassCard({ children, className = '', title, subtitle, action }: { children: ReactNode; className?: string; title?: string; subtitle?: string; action?: ReactNode }) {
  return <section className={`glass-card ${className}`}><div className="glass-card-inner">{(title || subtitle || action) && <div className="card-heading"><div>{title && <h3>{title}</h3>}{subtitle && <p>{subtitle}</p>}</div>{action}</div>}{children}</div></section>;
}

export function StatCard({ label, value, suffix, icon, trend, tone = 'cyan' }: { label: string; value: string | number; suffix?: string; icon: ReactNode; trend?: string; tone?: 'cyan' | 'violet' | 'teal' | 'amber' }) {
  return <div className={`stat-card stat-${tone}`}><div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><div className="stat-value">{value}{suffix && <small>{suffix}</small>}</div>{trend && <div className="stat-foot">{trend}</div>}</div>;
}

export function StatePanel({ type, title, message, action }: { type: 'loading' | 'empty' | 'error' | 'info'; title: string; message: string; action?: ReactNode }) {
  const Icon = type === 'loading' ? LoaderCircle : type === 'error' ? AlertCircle : type === 'empty' ? Database : Sparkles;
  const visibleMessage = type === 'error' ? friendlyErrorMessage(message) : message;
  return <div className={`state-panel state-${type}`}><span className="state-icon">{type === 'loading' ? <Icon className="spin" size={20} /> : <Icon size={20} />}</span><div><strong>{title}</strong><p>{visibleMessage}</p>{action && <div className="state-action">{action}</div>}</div></div>;
}

export function StatusBadge({ status }: { status: string }) {
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
  return <span className={`status-badge status-${tone}`} data-status={normalized}><i />{statusLabel(status)}</span>;
}

export function PreviewBanner() {
  if (!IS_PREVIEW_MODE) return null;
  return <div className="preview-banner"><Sparkles size={14} /><strong>Mode Pratinjau</strong><span>Seluruh data yang tampil merupakan simulasi. Perubahan data dinonaktifkan.</span></div>;
}

export function SimulationTag() {
  return IS_PREVIEW_MODE ? <span className="simulation-tag"><Sparkles size={11} /> Data Simulasi</span> : null;
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
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
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
  const omitted = new Set([...HIDDEN_DETAIL_FIELDS, ...omit]);
  const entries = Object.entries(record).filter(([key, value]) => !omitted.has(key.toLowerCase()) && value !== undefined && value !== null && value !== '');
  if (!entries.length) return <p className="muted-text">Tidak ada rincian tambahan yang tersedia.</p>;
  return <div className={`detail-grid record-detail-grid ${depth ? 'record-detail-nested' : ''}`}>{entries.map(([key, value]) => {
    const nestedRecord = parseNestedRecord(value);
    return <div className="detail-item" key={key}>
      <span>{fieldLabel(key)}</span>
      {nestedRecord && depth < 2
        ? <details className="record-nested-details"><summary>Lihat {Object.keys(nestedRecord).length} rincian</summary><RecordDetails record={nestedRecord} omit={omit} depth={depth + 1} /></details>
        : <strong>{nestedRecord ? 'Rincian tambahan tersedia' : displayValue(value, key)}</strong>}
    </div>;
  })}</div>;
}

