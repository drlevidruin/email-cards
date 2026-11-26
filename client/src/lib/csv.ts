import type { EmailThread } from './types';

// A cell that starts with = + - or @ would run as a formula in a spreadsheet, so it gets an apostrophe first (plain numbers stay numbers)
const cell = (v: string | number) => {
  let s = String(v);
  if (/^[=+\-@]/.test(s) && !/^[+-]?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const pad = (n: number) => String(n).padStart(2, '0');
const localDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * The receipts in a pile as CSV, built here in the browser: Date, Account, Vendor, Amount, Currency, Subject.
 * Oldest first, with a byte order mark so Excel reads it as UTF-8. Named for the month when every row is in one month,
 * otherwise for the range.
 */
export function receiptsCsv(threads: EmailThread[]): { name: string; text: string } {
  const rows = threads.filter((t) => t.receiptInfo).sort((a, b) => Date.parse(a.lastMessageAt) - Date.parse(b.lastMessageAt));
  const lines = [['Date', 'Account', 'Vendor', 'Amount', 'Currency', 'Subject']];
  for (const t of rows) {
    const r = t.receiptInfo!;
    lines.push([localDate(t.lastMessageAt), t.accountLabel, r.vendor, r.amount.toFixed(2), r.currency, t.subject]);
  }
  const first = rows.length ? localDate(rows[0].lastMessageAt) : localDate(new Date().toISOString());
  const last = rows.length ? localDate(rows[rows.length - 1].lastMessageAt) : first;
  const name = first.slice(0, 7) === last.slice(0, 7) ? `receipts-${first.slice(0, 7)}.csv` : `receipts-${first}-to-${last}.csv`;
  return { name, text: '\uFEFF' + lines.map((l) => l.map(cell).join(',')).join('\r\n') + '\r\n' };
}

/** Hands a text file to the browser as a download. */
export function downloadText(name: string, text: string, type = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
