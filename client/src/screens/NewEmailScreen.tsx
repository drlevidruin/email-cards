import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { sentToast } from '../lib/snapshot';
import { firstName } from '../lib/utils';
import { goBack, useRoute } from '../router';
import { useStore } from '../store';
import { NOT_SAVED } from '../storeActions';
import { PageShell } from '../components/PageShell';
import '../components/ReplyComposer.css';
import './NewEmailScreen.css';

const parse = (to: string) => to.split(',').map((s) => s.trim()).filter(Boolean);
const valid = (to: string) => parse(to).every((a) => a.includes('@'));

export function NewEmailScreen() {
  const store = useStore();
  const draftId = useRoute().query.get('draft') ?? undefined;
  const accounts = store.data?.accounts ?? [];
  const [from, setFrom] = useState(() => (store.account !== 'all' ? store.account : accounts[0]?.id ?? ''));
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [checked, setChecked] = useState(false);
  const [sending, setSending] = useState(false);
  const saved = useRef<{ id: string; text: string } | null>(null);
  const sent = useRef(false);
  const now = useRef({ from, to, subject, body });
  now.current = { from, to, subject, body };
  const signature = (f: string, t: string, s: string, b: string) => JSON.stringify([f, t.trim(), s.trim(), b.trim()]);

  useEffect(() => {
    if (!from && accounts[0]) setFrom(accounts[0].id);
  }, [from, accounts]);

  useEffect(() => {
    if (!draftId) return;
    void api.getDrafts().then((list) => {
      const d = list.find((x) => x.id === draftId);
      if (!d) return;
      setFrom(d.accountId);
      setTo(d.toEmails.join(', '));
      setSubject(d.subject);
      setBody(d.bodyText);
      saved.current = { id: d.id, text: signature(d.accountId, d.toEmails.join(', '), d.subject, d.bodyText) };
    });
  }, [draftId]);

  // Leaving with anything typed keeps it as a draft.
  useEffect(
    () => () => {
      if (sent.current) return;
      const c = now.current;
      if (!c.to.trim() && !c.subject.trim() && !c.body.trim()) return;
      const known = saved.current;
      if (known && known.text === signature(c.from, c.to, c.subject, c.body)) return;
      const fields = { accountId: c.from, toEmails: parse(c.to), subject: c.subject.trim(), bodyText: c.body.trim(), status: 'draft' as const };
      const save = known
        ? api.updateDraft(known.id, fields)
        : api.createDraft({ ...fields, threadId: null, createdBy: 'user' });
      void save.then(() => store.refresh()).catch(() => undefined);
      store.showToast('Saved to Drafts');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const canSend = !!to.trim() && !!body.trim() && !sending;
  const bad = checked && !!to.trim() && !valid(to);

  const send = async () => {
    setChecked(true);
    if (!canSend || !valid(to)) return;
    setSending(true);
    try {
      const fields = { accountId: from, toEmails: parse(to), subject: subject.trim(), bodyText: body.trim() };
      const known = saved.current;
      const d = known
        ? await api.updateDraft(known.id, fields)
        : await api.createDraft({ ...fields, threadId: null, status: 'draft', createdBy: 'user' });
      const res = await api.sendDraft(d.id);
      sent.current = true;
      void store.refresh();
      store.showToast(sentToast(res.status === 'held_shabbos' || res.heldByShabbos ? 'Held until after Shabbos' : `Sent to ${firstName(parse(to)[0])}`));
      goBack();
    } catch {
      setSending(false);
      store.showToast(NOT_SAVED);
    }
  };

  return (
    <PageShell bare fill>
      <div className="new">
        <header className="composer__head new__head">
          <button className="composer__cancel t-subhead" onClick={goBack}>
            Cancel
          </button>
          <h1 className="t-headline composer__title">New email</h1>
          <button className="composer__send" disabled={!canSend} onClick={() => void send()}>
            <span className="composer__send-pill t-callout">Send</span>
          </button>
        </header>
        <div className="new__rows">
          {accounts.length > 1 && (
            <label className="new__row t-subhead">
              <span className="new__label">From</span>
              <select className="new__control" value={from} onChange={(e) => setFrom(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label} ({a.email})
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className={`new__row t-subhead${bad ? ' is-bad' : ''}`}>
            <span className="new__label">To</span>
            <input
              className="new__control"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              onBlur={() => to.trim() && setChecked(true)}
              type="text"
              inputMode="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
            />
          </label>
          <label className="new__row t-subhead">
            <span className="new__label">Subject</span>
            <input className="new__control" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
        </div>
        <textarea className="t-body new__body" aria-label="Message" placeholder="Write your email" value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
    </PageShell>
  );
}
