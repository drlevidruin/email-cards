import { useState, type ReactNode } from 'react';
import { FileSpreadsheet, FileText, Image as ImageIcon, Paperclip } from 'lucide-react';
import type { EmailAttachment } from '../lib/types';
import { safePreview } from '../lib/safePreview';
import './BubbleMedia.css';

/** An attachment a picture tag can show: its preview must come from a safe place, else it is a file row. */
export const isPicture = (a: EmailAttachment) => a.mimeType.startsWith('image/') && !!safePreview(a.previewUrl);

export function sizeText(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function kindText(a: EmailAttachment): string {
  const ext = /\.([A-Za-z0-9]{1,5})$/.exec(a.filename)?.[1];
  return (ext ?? a.mimeType.split('/')[1] ?? 'File').toUpperCase();
}

function IconFor({ a }: { a: EmailAttachment }) {
  const props = { size: 18, strokeWidth: 1.75, 'aria-hidden': true } as const;
  const m = a.mimeType.toLowerCase();
  if (m === 'application/pdf' || m.startsWith('text/plain') || /\.(pdf|txt)$/i.test(a.filename)) return <FileText {...props} />;
  if (m.startsWith('image/')) return <ImageIcon {...props} />;
  if (m.includes('csv') || m.includes('spreadsheet') || m.includes('excel') || /\.(csv|xlsx?)$/i.test(a.filename)) return <FileSpreadsheet {...props} />;
  return <Paperclip {...props} />;
}

function FileRow({ a }: { a: EmailAttachment }) {
  return (
    <div className="bmedia__file">
      <span className="bmedia__icon">
        <IconFor a={a} />
      </span>
      <span className="bmedia__words">
        <span className="bmedia__name">{a.filename}</span>
        <span className="bmedia__kind">{`${kindText(a)}, ${sizeText(a.sizeBytes)}`}</span>
      </span>
    </div>
  );
}

/** A bubble's attachments: pictures above its text (children), file rows below. */
export function BubbleMedia({ attachments, onOpen, children }: { attachments: EmailAttachment[]; onOpen: (index: number) => void; children?: ReactNode }) {
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const pictures = attachments.filter(isPicture);
  const shown = pictures.filter((a) => !broken.has(a.id));
  const files = attachments.filter((a) => !isPicture(a) || broken.has(a.id));
  const many = shown.length > 1;
  const cells = shown.slice(0, 4);
  const extra = shown.length - 4;
  const grid = `bmedia__pics bmedia__pics--${many ? 'grid' : 'one'}${shown.length === 3 ? ' bmedia__pics--three' : ''}`;
  return (
    <>
      {shown.length > 0 && (
        <div className={grid}>
          {cells.map((a, i) => (
            <button key={a.id} type="button" className="bmedia__pic" aria-label={`Open picture ${a.filename}`} onClick={() => onOpen(pictures.indexOf(a))}>
              <img src={safePreview(a.previewUrl)} alt="" loading="lazy" decoding="async" onError={() => setBroken((b) => new Set(b).add(a.id))} />
              {i === 3 && extra > 0 && <span className="bmedia__more">{`+${extra}`}</span>}
            </button>
          ))}
        </div>
      )}
      {children}
      {files.map((a) => (
        <FileRow key={a.id} a={a} />
      ))}
    </>
  );
}
