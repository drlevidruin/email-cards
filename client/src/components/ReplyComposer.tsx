import { useEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { api } from '../lib/api';
import type { DraftItem, DraftTone, EmailThread } from '../lib/types';
import { cleanSubject, counterpart, replyActions } from '../lib/stacks';
import { firstName } from '../lib/utils';
import { clearThreadCache } from '../lib/threadCache';
import { goBack, navigate } from '../router';
import { useStore } from '../store';
import { useInDeck } from './useThreadActions';
import { NOT_SAVED } from '../storeActions';
import './ReplyComposer.css';

const OWN = 'own';

function toneFor(kind: string): DraftTone {
  if (kind === 'approve') return 'executive';
  if (kind === 'schedule' || kind === 'nudge') return 'warm';
  return 'direct';
}

export function ReplyComposer({ thread, qa, draftId, desktop, fromDeck, fromRead, fresh }: { thread: EmailThread; qa?: string; draftId?: string; desktop: boolean; fromDeck?: boolean; fromRead?: boolean; fresh?: boolean }) {
  const store = useStore();
  const inDeck = useInDeck(thread);
  const chips = replyActions(thread);
  const to = counterpart(thread);
  const first = firstName(to.name);
  const [sel, setSel] = useState('');
  const [body, setBody] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [ask, setAsk] = useState('');
  const draft = useRef<DraftItem | null>(null);
  const baseline = useRef('');
  const token = useRef(0);
  const bodyRef = useRef('');
  const sent = useRef(false);
  const started = useRef(false);
  // A draft opened from Goals or Drafts belongs to the user: switching replies never deletes it.
  const loaded = useRef(false);
  // The id of a draft resumed from Drafts: sent or replaced, it must not stay behind.
  const resumedId = useRef('');
  bodyRef.current = body;

  const subject = /^re:/i.test(thread.subject) ? thread.subject : `Re: ${cleanSubject(thread.subject)}`;

  const dropDraft = async () => {
    const d = draft.current;
    draft.current = null;
    if (d && !loaded.current) await api.deleteDraft(d.id).catch(() => undefined);
    loaded.current = false;
  };

  const generate = async (req: { instruction?: string; tone?: DraftTone }) => {
    const mine = ++token.current;
    await dropDraft();
    setDrafting(true);
    try {
      const d = await api.draftReply({ threadId: thread.id, ...req });
      if (mine !== token.current) {
        void api.deleteDraft(d.id).catch(() => undefined);
        return;
      }
      draft.current = d;
      baseline.current = d.bodyText;
      setBody(d.bodyText);
    } catch {
      if (mine === token.current) store.showToast(NOT_SAVED);
    } finally {
      if (mine === token.current) setDrafting(false);
    }
  };

  const pick = (id: string) => {
    setSel(id);
    if (id === OWN) {
      token.current += 1;
      void dropDraft();
      baseline.current = '';
      setBody('');
      setDrafting(false);
      return;
    }
    const chip = chips.find((c) => c.id === id);
    if (chip) void generate({ instruction: chip.draftHint, tone: toneFor(chip.kind) });
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (draftId) {
      setSel(OWN);
      setDrafting(true);
      void api
        .getDrafts()
        .then((list) => {
          const d = list.find((x) => x.id === draftId);
          if (!d) return;
          // A nudge draft opened with fresh=1 was never saved by the user, so Cancel deletes it.
          loaded.current = !fresh;
          if (!fresh) resumedId.current = d.id;
          draft.current = d;
          baseline.current = d.bodyText;
          setBody(d.bodyText);
        })
        .catch(() => store.showToast(NOT_SAVED))
        .finally(() => setDrafting(false));
      return;
    }
    pick(chips.find((c) => c.id === qa)?.id ?? chips[0]?.id ?? OWN);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Leaving by any route (Cancel, Escape, the back button) keeps edited text as a draft.
  useEffect(
    () => () => {
      if (sent.current) return;
      token.current += 1;
      const text = bodyRef.current.trim();
      const d = draft.current;
      draft.current = null;
      if (text && text !== baseline.current.trim()) {
        const save = d
          ? api.updateDraft(d.id, { bodyText: text, status: 'draft' })
          : api.createDraft({
              threadId: thread.id,
              accountId: thread.accountId,
              toEmails: [to.email],
              subject,
              bodyText: text,
              createdBy: 'user',
              status: 'draft',
            });
        void save.then(() => store.refresh()).catch(() => undefined);
        store.showToast('Saved to Drafts');
      } else if (d && !loaded.current) {
        void api.deleteDraft(d.id).catch(() => undefined);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const send = async () => {
    const text = body.trim();
    if (!text || drafting || sending) return;
    setSending(true);
    try {
      let d = draft.current;
      if (!d) {
        d = await api.createDraft({
          threadId: thread.id,
          accountId: thread.accountId,
          toEmails: [to.email],
          subject,
          bodyText: text,
          createdBy: 'user',
          status: 'pending_approval',
        });
      } else if (d.bodyText !== text) {
        await api.updateDraft(d.id, { bodyText: text });
      }
      const res = await api.sendDraft(d.id);
      if (!loaded.current) await api.archiveThread(thread.id);
      sent.current = true;
      const fromDrafts = !!resumedId.current;
      if (resumedId.current && resumedId.current !== d.id) await api.deleteDraft(resumedId.current).catch(() => undefined);
      const held = res.status === 'held_shabbos' || !!res.heldByShabbos;
      if (fromDeck && !loaded.current) {
        // The deck flies the card off; the open thread must still reload with the reply in it.
        store.markReplied(thread, first, held, true);
        clearThreadCache();
        goBack();
      } else {
        // Read screen replies in the current deck count toward it, but no card is on screen to fly off.
        store.markReplied(thread, first, held, inDeck, true);
        await store.refresh();
        const toCards = () => navigate(`/cards/${store.lastStack}`, { replace: true });
        if (loaded.current || fromDrafts) goBack();
        else if (fromRead) {
          // Step back over the read screen, then replace it, so Back never returns to an archived email.
          window.addEventListener('popstate', () => toCards(), { once: true });
          window.history.back();
        } else toCards();
      }
    } catch {
      setSending(false);
      store.showToast(NOT_SAVED);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') goBack();
      else if (desktop && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void send();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="composer">
      <header className="composer__head">
        <button className="btn btn--text composer__cancel" onClick={goBack}>
          Cancel
        </button>
        <h1 className="composer__title">Reply to {first}</h1>
        <button className="btn btn--primary composer__send" disabled={!body.trim() || drafting || sending} onClick={() => void send()}>
          Send
        </button>
      </header>
      <p className="composer__from">
        From {thread.accountLabel} to {to.email}
      </p>
      <div className="composer__pills">
        {chips.map((c) => (
          <button key={c.id} className={`pill${sel === c.id ? ' is-on' : ''}`} onClick={() => pick(c.id)}>
            {c.label}
          </button>
        ))}
        <button className={`pill${sel === OWN ? ' is-on' : ''}`} onClick={() => pick(OWN)}>
          Write my own
        </button>
      </div>
      <div className="composer__body">
        {drafting ? (
          <div className="composer__bars">
            <span style={{ width: '70%' }} />
            <span style={{ width: '95%' }} />
            <span style={{ width: '55%' }} />
          </div>
        ) : (
          <textarea className="composer__text" placeholder="Your reply" value={body} onChange={(e) => setBody(e.target.value)} />
        )}
      </div>
      <form
        className="composer__ask"
        onSubmit={(e) => {
          e.preventDefault();
          const t = ask.trim();
          if (!t) return;
          setAsk('');
          setSel('');
          void generate({ instruction: t });
        }}
      >
        <input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Tell Claude what to say" aria-label="Tell Claude what to say" />
        {ask.trim() && (
          <button type="submit" className="composer__ask-go" aria-label="Write reply">
            <ArrowUp size={20} strokeWidth={2} />
          </button>
        )}
      </form>
    </div>
  );
}
