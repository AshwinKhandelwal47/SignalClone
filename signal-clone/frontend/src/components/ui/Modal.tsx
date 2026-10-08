"use client";

import { useEffect } from "react";
import { CloseIcon } from "./Icons";

interface ModalProps {
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}

export function Modal({ title, onClose, children, width = 440 }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-xl bg-left-pane shadow-2xl"
        style={{ maxWidth: width }}
      >
        {title && (
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h2 className="text-[15px] font-semibold">{title}</h2>
            <button onClick={onClose} className="icon-button" aria-label="Close">
              <CloseIcon />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  title: string;
  body: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  destructive,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal onClose={onCancel} width={360}>
      <div className="p-5">
        <h2 className="mb-2 text-[15px] font-semibold">{title}</h2>
        <p className="text-secondary">{body}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className={destructive ? "btn-destructive" : "btn-primary"} onClick={onConfirm} autoFocus>
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
