import { useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import './AttachStrip.css';

/** The files chosen for the next message: pictures as small thumbnails, other files as a chip with the name. */
export function AttachStrip({ files, onRemove }: { files: File[]; onRemove: (index: number) => void }) {
  const urls = useMemo(() => files.map((f) => (f.type.startsWith('image/') ? URL.createObjectURL(f) : null)), [files]);
  useEffect(
    () => () => {
      urls.forEach((u) => u && URL.revokeObjectURL(u));
    },
    [urls]
  );
  if (files.length === 0) return null;
  return (
    <div className="astrip" role="group" aria-label="Files to send">
      {files.map((f, i) => (
        <span key={`${f.name}-${i}`} className={`astrip__item${urls[i] ? ' astrip__item--pic' : ''}`}>
          {urls[i] ? <img src={urls[i] ?? undefined} alt="" /> : <span className="astrip__name">{f.name}</span>}
          <button type="button" className="astrip__x" aria-label={`Remove ${f.name}`} onClick={() => onRemove(i)}>
            <span className="astrip__xdot">
              <X size={12} strokeWidth={2.5} aria-hidden="true" />
            </span>
          </button>
        </span>
      ))}
    </div>
  );
}
