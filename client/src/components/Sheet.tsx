import { useRef, type ReactNode } from 'react';
import { useDialog } from './useDialog';
import './Sheet.css';

interface Props {
  title: string;
  onClose: () => void;
  /** Centered dialog on every width. Otherwise a bottom sheet on phones. */
  dialog?: boolean;
  children: ReactNode;
}

export function Sheet({ title, onClose, dialog, children }: Props) {
  const box = useRef<HTMLDivElement>(null);
  useDialog(box, onClose);

  return (
    <div className="scrim" onClick={onClose}>
      <div
        ref={box}
        tabIndex={-1}
        className={`sheet${dialog ? ' sheet--dialog' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet__handle" />
        <h2 className="sheet__title">{title}</h2>
        {children}
      </div>
    </div>
  );
}
