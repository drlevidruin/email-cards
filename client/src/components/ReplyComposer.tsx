import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { DraftItem, DraftTone, EmailThread, QuickActionChip } from '../lib/types';
import { cleanSubject, counterpart, replyActions } from '../lib/stacks';
import { firstName } from '../lib/utils';
import { blanksOf, openBlanks } from '../lib/commitments';
import { clearThreadCache } from '../lib/threadCache';
import { goBack, navigate } from '../router';
import { useStore } from '../store';
import { useInDeck } from './useThreadActions';
import { NOT_SAVED } from '../storeActions';
import { dropMine, myDrafts, saveMine } from '../lib/myDraft';
import { ReplyChoose } from './ReplyChoose';
import { ReplyEdit } from './ReplyEdit';
import './ReplyComposer.css';

function toneFor(kind: string): DraftTone {
  if (kind === 'approve') return 'executive';
  if (kind === 'schedule' || kind === 'nudge') return 'warm';
  return 'direct';
}

interface Props {
  thread: EmailThread;
  qa?: string;
  draftId?: string;
  desktop: boolean;
  fromDeck?: boolean;
  fromRead?: boolean;
  fresh?: boolean;
  /** Opened straight from an answer row on a card: it starts in the editor, and Cancel returns to the deck. */
  direct?: boolean;
  /** Opened from `Write my own` on a card: the editor starts with your unsent draft for this email, or empty. */
  own?: boolean;
}

export function ReplyComposer({ thread, qa, draftId, desktop, fromDeck, fromRead, fresh, direct, own }: Props) {
  const store = useStore();
  const inDeck = useInDeck(thread);
  const chips = replyActions(thread);
  const to = counterpart(thread);
  const first = firstName(to.name);
  // Choose shows every suggested reply in full; Edit is the one reply you may change and send. A saved draft opens straight in Edit.
  const wanted = chips.find((c) => c.id === qa);
  const [mode, setMode] = useState<'choose' | 'edit'>(draftId || (direct && (own || wanted)) ? 'edit' : 'choose');
  // An answer from a card row is in the editor from the first frame
  const [body, setBody] = useState(direct && wanted?.draftBody ? wanted.draftBody : '');
  // The `[blanks]` the suggestion or agent draft put in, word for word. Only these hold Send back; brackets you type never do.
  const [blanks, setBlanks] = useState<string[]>(() => (direct && wanted?.draftBody ? blanksOf(wanted.draftBody) : []));
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
  // The text of your own unsent draft for this email, as stored. Leaving with exactly this saves nothing.
  const mineText = useRef('');
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
      setBlanks(blanksOf(d.bodyText));
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
      setBlanks(blanksOf(chip.draftBody));
      setMode('edit');
    } else void generate({ instruction: chip.draftHint, tone: toneFor(chip.kind) });
  };

  const startFrom = (text: string) => {
    token.current += 1;
    void dropDraft();
    baseline.current = '';
    setBody(text);
    setBlanks([]);
    setDrafting(false);
    setMode('edit');
  };

  const edit = (text: string) => {
    setBody(text);
    // Only what you typed counts as yours; picking a suggestion never overwrites it
    setYours(text.trim() && text.trim() !== baseline.current.trim() ? text : mineText.current);
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
          if (!fresh) resumedId.current = d.id;
          // Only a draft you wrote is `Your draft`; an agent draft stays the agent's until you change it
          if (!fresh && d.createdBy === 'user') {
            setYours(d.bodyText);
            mineText.current = d.bodyText.trim();
          }
          // An agent draft's blanks hold Send; in your own draft only the blanks a suggestion left count
          const known = new Set(chips.flatMap((c) => blanksOf(c.draftBody ?? '')));
          setBlanks(d.createdBy === 'user' ? blanksOf(d.bodyText).filter((b) => known.has(b)) : blanksOf(d.bodyText));
          draft.current = d;
          baseline.current = d.bodyText;
          setBody(d.bodyText);
        })
        .catch(() => store.showToast(NOT_SAVED))
        .finally(() => setDrafting(false));
      return;
    }
    // Every other route looks for your own unsent draft of this email. A ready answer from a card opens at once and only remembers it.
    const hold = !wanted;
    if (wanted) pick(wanted);
    else setDrafting(true);
    void myDrafts(thread.id)
      .then(([mine]) => {
        mineText.current = mine?.bodyText.trim() ?? '';
        if (mine && !(direct && wanted) && !yoursRef.current) setYours(mine.bodyText.trim());
        if (own && hold) startFrom(mine?.bodyText ?? '');
      })
      .catch(() => store.showToast(NOT_SAVED))
      .finally(() => hold && setDrafting(false));
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
      // A draft opened from Drafts or To-do is changed in place
      const inPlace = draftId ? d?.id ?? resumedId.current : '';
      // Words left exactly as stored are not saved again, and nothing is said
      const changed = text !== mineText.current;
      if (text && inPlace && changed) {
        void api.updateDraft(inPlace, { bodyText: text, status: 'draft' }).then(() => store.refresh()).catch(() => undefined);
        store.showToast('Saved to Drafts');
      } else if (text && !inPlace) {
        // One draft of yours per email: the text goes into the one there is, or becomes it
        void saveMine(thread, to.email, subject, text)
          .then((saved) => {
            if (saved) store.showToast('Saved to Drafts');
            return store.refresh();
          })
          .catch(() => undefined);
      }
      // A draft the agent wrote for this visit is not yours unless you changed it, and then it is now in yours
      if (d && !loaded.current && !(text && inPlace && changed)) void api.deleteDraft(d.id).catch(() => undefined);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const send = async () => {
    const text = body.trim();
    if (!text || drafting || sending || openBlanks(text, blanks) > 0) return;
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
      sent.current = true;
      if (!loaded.current) await api.archiveThread(thread.id);
      const fromDrafts = !!resumedId.current;
      if (resumedId.current && resumedId.current !== d.id) await api.deleteDraft(resumedId.current).catch(() => undefined);
      await dropMine(thread.id, d.id).catch(() => undefined);
      const held = res.status === 'held_shabbos' || !!res.heldByShabbos;
      if (fromDeck && !loaded.current) {
        // The deck flies the card off; the open thread must still reload with the reply in it.
        store.markReplied(thread, first, held, true);
        clearThreadCache();
        goBack();
        // Drafts reads the store: it must not still list a draft that was just removed
        void store.refresh();
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
        if (modeRef.current === 'edit' && !sending) {
          if (direct) goBack();
          else setMode('choose');
        }
        else if (modeRef.current === 'choose') goBack();
      } else if (modeRef.current === 'edit') {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          // With a blank still open, the shortcut takes you to it instead of sending
          const field = document.querySelector<HTMLInputElement>('.blank__input');
          if (field) field.focus();
          else void send();
        }
      } else if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && !drafting) {
        const n = Number(e.key);
        if (n >= 1 && n <= Math.min(3, chips.length)) pick(chips[n - 1]);
        else if (e.key.toLowerCase() === 'w') startFrom(yoursRef.current);
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
        blanks={blanks}
        drafting={drafting}
        sending={sending}
        desktop={desktop}
        onBody={edit}
        cancel={!!direct}
        onBack={() => (direct ? goBack() : setMode('choose'))}
        onSend={() => void send()}
      />
    );
  }
  return (
    <ReplyChoose
      first={first}
      to={to}
      goal={thread.distilledAsk}
      due={thread.deadlineLabel}
      chips={chips}
      yours={yours}
      drafting={drafting}
      onPick={pick}
      onYours={() => startFrom(yoursRef.current)}
      onOwn={() => startFrom(yoursRef.current)}
      onAsk={(instruction) => void generate({ instruction })}
    />
  );
}
