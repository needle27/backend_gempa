import { useEffect, useRef, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, LoaderCircle, X } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  loading?: boolean;
  icon?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Ya, Lanjutkan',
  cancelLabel = 'Batal',
  variant = 'primary',
  loading = false,
  icon,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Auto-focus confirm button on open
    const timer = window.setTimeout(() => {
      confirmBtnRef.current?.focus();
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      window.clearTimeout(timer);
    };
  }, [isOpen, loading, onCancel]);

  if (!isOpen) return null;

  const defaultIcon = variant === 'danger' ? <AlertTriangle size={22} /> : <CheckCircle2 size={22} />;

  return (
    <div
      className="confirm-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          onCancel();
        }
      }}
    >
      <div className={`confirm-modal-box confirm-modal-${variant}`} onClick={(e) => e.stopPropagation()}>
        <div className="confirm-modal-header">
          <div className="confirm-modal-icon-wrapper">
            {icon || defaultIcon}
          </div>
          <div className="confirm-modal-heading">
            <h3 id="confirm-modal-title">{title}</h3>
          </div>
          <button
            type="button"
            className="confirm-modal-close"
            onClick={onCancel}
            disabled={loading}
            aria-label="Tutup modal"
          >
            <X size={16} />
          </button>
        </div>

        <div className="confirm-modal-body">
          {typeof message === 'string' ? <p>{message}</p> : message}
        </div>

        <div className="confirm-modal-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            className={`button button-${variant === 'danger' ? 'danger' : 'primary'}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <LoaderCircle className="spin" size={14} /> Memproses…
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
