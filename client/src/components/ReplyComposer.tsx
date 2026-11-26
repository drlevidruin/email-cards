import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { DraftItem, DraftTone, EmailThread, QuickActionChip } from '../lib/types';
import { cleanSubject, counterpart, replyActions } from '../lib/stacks';
import { firstName } from '../lib/utils';
import { clearThreadCache } from '../lib/threadCache';
import { goBack, navigate } from '../router';
import { useStore } from '../store';
import { useInDeck } from './useThreadActions';
import { NOT_SAVED } from '../storeActions';
import { ReplyChoose } from './ReplyChoose';
import { ReplyEdit } from './ReplyEdit';
import './ReplyComposer.css';

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
  // Choose shows every suggested reply in full; Edit is the one reply you may change and send. A saved draft opens straight in Edit.
  const [mode, setMode] = useState<'choose' | 'edit'>(draftId ? 'edit' : 'choose');
  const [body, setBody] = useState('');
  // What you changed by hand: shown on Choose as `Your draft`, and saved to Drafts if you leave.
  const [yours, setYours] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const draft = useRef<DraftItem | null>(null);
  const baseline = useRef('');
  const token = useRef(0);
  const yoursRef = useRef('');
  const sent = useRef(false);
  const started = useRef(false);
  // A draft opened from To-do or Drafts belongs to the user: switching replies never deletes it.
  const loaded = useRef(false);
  // The id of a draft resumed from Drafts: sent or replaced, it must not stay behind.
  const resumedId = useRef('');
  yoursRef.current = yours;

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
      setMode('edit');
    } catch {
      if (mine === token.current) store.showToast(NOT_SAVED);
    } finally {
      if (mine === token.current) setDrafting(false);
    }
  };

  const pick = (chip: QuickActionChip) => {
    token.current += 1;
    void dropDraft();
    if (chip.draftBody) {
      baseline.current = chip.draftBody;
      setBody(chip.draftBody);
      setMode('edit');
    } else void generate({ instruction: chip.draftHint, tone: toneFor(chip.kind) });
  };

  const startFrom = (text: string) => {
    token.current += 1;
    void dropDraft();
    baseline.current = '';
    setBody(text);
    setDrafting(false);
    setMode('edit');
  };

  const edit = (text: string) => {
    setBody(text);
    // Only what you typed counts as yours; picking a suggestion never overwrites it
    setYours(text.trim() && text.trim() !== baseline.current.trim() ? text : '');
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (draftId) {
      setDrafting(true);
      void api
        .getDrafts()
        .then((list) => {
          const d = list.find((x) => x.id === draftId);
          if (!d) return;
          // A nudge draft opened with fresh=1 was never saved by the user, so Cancel deletes it.
          loaded.current = !fresh;
          if (!fresh) {
            resumedId.current = d.id;
            // A resumed draft is yours: Choose offers it as `Your draft`
            setYours(d.bodyText);
          }
          draft.current = d;
          baseline.current = d.bodyText;
          setBody(d.bodyText);
        })
        .catch(() => store.showToast(NOT_SAVED))
        .finally(() => setDrafting(false));
      return;
    }
    const wanted = chips.find((c) => c.id === qa);
    if (wanted) pick(wanted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Leaving by any route (Cancel, Escape, the back button) keeps edited text as a draft.
  useEffect(
    () => () => {
      if (sent.current) return;
      token.current += 1;
      const text = yoursRef.current.trim();
      const d = draft.current;
      draft.current = null;
      if (text) {
        const id = d?.id ?? (resumedId.current || undefined);
        const save = id
          ? api.updateDraft(id, { bodyText: text, status: 'draft' })
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

  const modeRef = useRef(mode);
  modeRef.current = mode;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && !!e.target.closest('input, textarea');
      if (e.key === 'Escape') {
        if (modeRef.current === 'edit' && !sending) setMode('choose');
        else if (modeRef.current === 'choose') goBack();
      } else if (modeRef.current === 'edit') {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          void send();
        }
      } else if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && !drafting) {
        const n = Number(e.key);
        if (n >= 1 && n <= Math.min(3, chips.length)) pick(chips[n - 1]);
        else if (e.key.toLowerCase() === 'w') startFrom('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (mode === 'edit') {
    return (
      <ReplyEdit
        first={first}
        to={to}
        subject={subject}
        body={body}
        drafting={drafting}
        sending={sending}
        desktop={desktop}
        onBody={edit}
        onBack={() => setMode('choose')}
        onSend={() => void send()}
      />
    );
  }
  return (
    <ReplyChoose
      first={first}
      to={to}
      goal={thread.distilledAsk}
      chips={chips}
      yours={yours}
      drafting={drafting}
      onPick={pick}
      onYours={() => startFrom(yoursRef.current)}
      onOwn={() => startFrom('')}
      onAsk={(instruction) => void generate({ instruction })}
    />
  );
}
