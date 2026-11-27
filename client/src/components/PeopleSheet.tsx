import { useId, useState } from 'react';
import { X } from 'lucide-react';
import type { Recipients } from '../lib/recipients';
import type { Person } from '../lib/people';
import { Sheet } from './Sheet';
import './PeopleSheet.css';

type Row = 'to' | 'cc' | 'bcc';
const ROWS: { id: Row; label: string; sub?: string; aria: string }[] = [
  { id: 'to', label: 'To', aria: 'Add to To' },
  { id: 'cc', label: 'Cc', sub: 'copy', aria: 'Add a copy (Cc)' },
  { id: 'bcc', label: 'Bcc', sub: 'hidden copy', aria: 'Add a hidden copy (Bcc)' },
];
const LOOKS_LIKE_AN_ADDRESS = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

const same = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',');
export const sameRecipients = (a: Recipients, b: Recipients) => same(a.to, b.to) && same(a.cc, b.cc) && same(a.bcc, b.bcc);

interface Props {
  rec: Recipients;
  /** What the message would be without any edit. */
  plan: Recipients;
  mine: Set<string>;
  /** Everyone the app knows, for the address suggestions and the names on the chips. */
  known: Person[];
  onChange: (rec: Recipients) => void;
  onClose: () => void;
}

export function PeopleSheet({ rec, plan, mine, known, onChange, onClose }: Props) {
  const listId = useId();
  const [draft, setDraft] = useState<Record<Row, string>>({ to: '', cc: '', bcc: '' });
  const [bad, setBad] = useState<Record<Row, boolean>>({ to: false, cc: false, bcc: false });
  const names = new Map(known.map((p) => [p.email.toLowerCase(), p.name || p.email]));
  const nameOf = (a: string) => names.get(a.toLowerCase()) ?? a;

  const remove = (row: Row, addr: string) => {
    if (row === 'to') {
      const to = rec.to.filter((a) => a !== addr);
      if (to.length === 0) {
        if (rec.cc.length === 0) return;
        onChange({ ...rec, to: [rec.cc[0]], cc: rec.cc.slice(1) });
        return;
      }
      onChange({ ...rec, to });
      return;
    }
    onChange({ ...rec, [row]: rec[row].filter((a) => a !== addr) });
  };

  const add = (row: Row, raw: string) => {
    const text = raw.trim().replace(/,$/, '').trim();
    if (!text) {
      setBad((b) => ({ ...b, [row]: false }));
      return;
    }
    if (!LOOKS_LIKE_AN_ADDRESS.test(text)) {
      setBad((b) => ({ ...b, [row]: true }));
      return;
    }
    const addr = text.toLowerCase();
    const present = [...rec.to, ...rec.cc, ...rec.bcc].includes(addr) || mine.has(addr);
    if (!present) onChange({ ...rec, [row]: [...rec[row], addr] });
    setDraft((d) => ({ ...d, [row]: '' }));
    setBad((b) => ({ ...b, [row]: false }));
  };

  const options = known.filter((p) => p.email).slice(0, 200);

  return (
    <Sheet title="Who gets your message" onClose={onClose} className="psheet">
      <div className="psheet__rows">
        {ROWS.map(({ id, label, sub, aria }) => (
          <div key={id} className="psheet__row">
            <span className="psheet__label">
              <span className="psheet__name">{label}</span>
              {sub && <span className="psheet__sub">{sub}</span>}
            </span>
            <div className="psheet__chips">
              {rec[id].map((a) => {
                const locked = id === 'to' && rec.to.length === 1 && rec.cc.length === 0;
                return (
                  <span key={a} className="psheet__chip">
                    <span className="psheet__chipname">{nameOf(a)}</span>
                    {!locked && (
                      <button type="button" className="psheet__x" aria-label={`Remove ${nameOf(a)}`} onClick={() => remove(id, a)}>
                        <X size={14} strokeWidth={2} aria-hidden="true" />
                      </button>
                    )}
                  </span>
                );
              })}
              {(
                <input
                  className={`psheet__input${bad[id] ? ' psheet__input--bad' : ''}`}
                  type="email"
                  inputMode="email"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="Add someone"
                  aria-label={aria}
                  aria-invalid={bad[id]}
                  list={listId}
                  value={draft[id]}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDraft((d) => ({ ...d, [id]: v }));
                    if (bad[id]) setBad((b) => ({ ...b, [id]: false }));
                    if (v.endsWith(',')) add(id, v);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      add(id, draft[id]);
                    }
                  }}
                  onBlur={() => add(id, draft[id])}
                />
              )}
            </div>
          </div>
        ))}
      </div>
      <datalist id={listId}>
        {options.map((p) => (
          <option key={p.email} value={p.email} label={p.name} />
        ))}
      </datalist>
      <p className="psheet__note">
        Nothing is sent until you press Send.
        {rec.bcc.length > 0 && (
          <>
            <br />
            People in Bcc get the message. Nobody else sees they did.
          </>
        )}
      </p>
      <div className="psheet__foot">
        {!sameRecipients(rec, plan) && (
          <button type="button" className="psheet__reset" onClick={() => onChange(plan)}>
            Everyone in this chat
          </button>
        )}
        <button type="button" className="psheet__done" onClick={onClose}>
          OK
        </button>
      </div>
    </Sheet>
  );
}
