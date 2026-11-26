import { useEffect, useId, useRef, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, LoaderCircle, X } from 'lucide-react';
import { useI18n } from '../../i18n/LanguageContext';

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
  confirmLabel,
  cancelLabel,
  variant = 'primary',
  loading = false,
  icon,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { t } = useI18n();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pressedOutsideRef = useRef(false);
  const resolvedConfirmLabel = confirmLabel ?? t.common.confirmDefault;
  const resolvedCancelLabel = cancelLabel ?? t.common.cancelDefault;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      if (!loading) {
        onCancel();
      }
    };

    dialog.addEventListener('cancel', handleCancel);
    return () => {
      dialog.removeEventListener('cancel', handleCancel);
    };
  }, [loading, onCancel]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !isOpen) return;
    if ('closedBy' in HTMLDialogElement.prototype) return;

    const isOutside = (e: PointerEvent) => {
      const rect = dialog.getBoundingClientRect();
      return (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      );
    };

    const handlePointerDown = (e: PointerEvent) => {
      pressedOutsideRef.current = isOutside(e);
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (pressedOutsideRef.current && isOutside(e) && !loading) {
        onCancel();
      }
      pressedOutsideRef.current = false;
    };

    dialog.addEventListener('pointerdown', handlePointerDown);
    dialog.addEventListener('pointerup', handlePointerUp);
    return () => {
      dialog.removeEventListener('pointerdown', handlePointerDown);
      dialog.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isOpen, loading, onCancel]);

  const defaultIcon = variant === 'danger' ? <AlertTriangle size={22} /> : <CheckCircle2 size={22} />;

  return (
    <dialog
      ref={dialogRef}
      className={`confirm-modal-dialog confirm-modal-${variant}`}
      aria-labelledby={titleId}
      {...({ closedby: loading ? 'none' : 'any' } as Record<string, string>)}
    >
      {isOpen ? (
        <div className="confirm-modal-box">
          <div className="confirm-modal-header">
            <div className="confirm-modal-icon-wrapper">
              {icon || defaultIcon}
            </div>
            <div className="confirm-modal-heading">
              <h1 id={titleId}>{title}</h1>
            </div>
            <button
              type="button"
              className="confirm-modal-close"
              onClick={onCancel}
              disabled={loading}
              aria-label={t.common.closeModalAria}
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
              autoFocus={variant === 'danger'}
            >
              {resolvedCancelLabel}
            </button>
            <button
              type="button"
              className={`button button-${variant === 'danger' ? 'danger' : 'primary'}`}
              onClick={onConfirm}
              disabled={loading}
              autoFocus={variant !== 'danger'}
            >
              {loading ? (
                <>
                  <LoaderCircle className="spin" size={14} /> {t.common.processing}
                </>
              ) : (
                resolvedConfirmLabel
              )}
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
