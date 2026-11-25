import type { EmailAttachment, EmailThread } from '../../lib/types';

export type PaperTrailCategory =
  | 'All'
  | 'Invoices'
  | 'SaaS & Cloud'
  | 'Travel'
  | 'Purchases'
  | 'Attachments';

export const PAPER_TRAIL_CATEGORIES: PaperTrailCategory[] = [
  'All',
  'Invoices',
  'SaaS & Cloud',
  'Travel',
  'Purchases',
  'Attachments',
];

export interface VaultDocument {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes?: number;
}

export interface PaperTrailRecord {
  thread: EmailThread;
  vendor: string;
  amount: number | null;
  currency: string;
  invoiceNumber: string | null;
  category: Exclude<PaperTrailCategory, 'All' | 'Attachments'>;
  attachments: VaultDocument[];
  isTravel: boolean;
  isInvoiceOrReceipt: boolean;
}

export function formatMoney(amount: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

export function estimateReadingMinutes(thread: EmailThread): number {
  const bodyLength =
    thread.messages?.reduce((acc, m) => acc + (m.bodyText?.length ?? 0), 0) ?? 0;
  const textLen =
    bodyLength > 0
      ? bodyLength
      : thread.snippet.length + thread.aiSummaryBullets.join(' ').length * 4;
  const words = Math.max(180, Math.round(textLen / 5));
  return Math.max(2, Math.min(12, Math.round(words / 180)));
}

export function extractPublicationName(thread: EmailThread): string {
  const first = thread.participants?.[0];
  if (first?.name) {
    return first.name.replace(/<[^>]+>/g, '').trim();
  }
  const fromEmail = first?.email || thread.accountEmail;
  const domain = fromEmail.split('@')[1]?.split('.')[0] ?? 'Dispatch';
  return domain.charAt(0).toUpperCase() + domain.slice(1);
}

export function getEditorialTakeaways(thread: EmailThread): string[] {
  if (thread.aiSummaryBullets && thread.aiSummaryBullets.length > 0) {
    return thread.aiSummaryBullets.slice(0, 3);
  }
  const pieces = thread.snippet
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 18);
  if (pieces.length > 0) return pieces.slice(0, 3);
  return [thread.snippet || 'Curated newsletter edition archived in your Digest feed.'];
}

export function extractThreadAttachments(thread: EmailThread): VaultDocument[] {
  const docs: VaultDocument[] = [];
  const seen = new Set<string>();

  if (thread.messages) {
    for (const msg of thread.messages) {
      for (const att of msg.attachments ?? []) {
        const key = `${att.filename}-${att.sizeBytes}`;
        if (!seen.has(key)) {
          seen.add(key);
          docs.push({
            id: att.id,
            filename: att.filename,
            mimeType: att.mimeType,
            sizeBytes: att.sizeBytes,
          });
        }
      }
    }
  }

  // Surface inferred document chip if thread clearly carries an invoice/PDF/itinerary
  if (docs.length === 0) {
    const haystack = `${thread.subject} ${thread.snippet} ${thread.labels.join(' ')}`.toLowerCase();
    if (thread.receiptInfo?.invoiceNumber) {
      docs.push({
        id: `${thread.id}-inv-pdf`,
        filename: `${thread.receiptInfo.invoiceNumber}.pdf`,
        mimeType: 'application/pdf',
      });
    } else if (/itinerary|boarding|flight|confirmation|e-ticket/.test(haystack)) {
      docs.push({
        id: `${thread.id}-itinerary`,
        filename: 'Travel-Confirmation.pdf',
        mimeType: 'application/pdf',
      });
    } else if (/contract|agreement|pdf|attachment|statement|tax|w-9|nda/.test(haystack)) {
      docs.push({
        id: `${thread.id}-doc`,
        filename: 'Document.pdf',
        mimeType: 'application/pdf',
      });
    }
  }

  return docs;
}

export function isPaperTrailThread(thread: EmailThread): boolean {
  if (thread.isArchived) return false;
  if (thread.bucket === 'paper_trail') return true;
  if (thread.receiptInfo) return true;
  const hasRealAttachment = thread.messages?.some(
    (m) => (m.attachments?.length ?? 0) > 0,
  );
  if (hasRealAttachment) return true;
  const hay = `${thread.subject} ${thread.labels.join(' ')}`.toLowerCase();
  return /\b(receipt|invoice|flight|hotel|itinerary|billing|order #|confirmation)\b/.test(hay);
}

export function classifyPaperTrailCategory(
  thread: EmailThread,
): Exclude<PaperTrailCategory, 'All' | 'Attachments'> {
  const raw = (thread.receiptInfo?.category ?? '').toLowerCase();
  const hay = `${raw} ${thread.subject} ${thread.snippet} ${thread.labels.join(' ')}`.toLowerCase();

  if (
    /travel|flight|airline|delta|united|american airlines|jetblue|hotel|airbnb|uber|lyft|itinerary|booking|train/.test(
      hay,
    )
  ) {
    return 'Travel';
  }
  if (
    /saas|cloud|aws|vercel|figma|linear|notion|github|openai|anthropic|stripe|google cloud|subscription|software|hosting|domain|datadog/.test(
      hay,
    )
  ) {
    return 'SaaS & Cloud';
  }
  if (/invoice|retainer|statement|net 30|wire|billing|tax|legal|accounting/.test(hay)) {
    return 'Invoices';
  }
  return 'Purchases';
}

export function extractDollarFallback(text: string): number | null {
  const match = text.match(/\$\s?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/);
  if (!match) return null;
  const num = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(num) ? num : null;
}

export function buildPaperTrailRecord(thread: EmailThread): PaperTrailRecord {
  const category = classifyPaperTrailCategory(thread);
  const attachments = extractThreadAttachments(thread);
  const vendor =
    thread.receiptInfo?.vendor ||
    thread.participants?.[0]?.name ||
    extractPublicationName(thread);
  const amount =
    typeof thread.receiptInfo?.amount === 'number'
      ? thread.receiptInfo.amount
      : extractDollarFallback(`${thread.subject} ${thread.snippet}`);
  const currency = thread.receiptInfo?.currency || 'USD';
  const invoiceNumber = thread.receiptInfo?.invoiceNumber || null;

  return {
    thread,
    vendor,
    amount,
    currency,
    invoiceNumber,
    category,
    attachments,
    isTravel: category === 'Travel',
    isInvoiceOrReceipt: amount !== null || Boolean(thread.receiptInfo) || category === 'Invoices',
  };
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return 'PDF';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type AttachmentSummary = EmailAttachment;
