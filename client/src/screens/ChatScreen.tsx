import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, ChevronLeft, Mail, MailOpen, MoreHorizontal, Paperclip, SendHorizontal, Users } from 'lucide-react';
import { api } from '../lib/api';
import { goBack, navigate, cameFrom } from '../router';
import { useStore } from '../store';
import { NOT_SAVED } from '../storeActions';
import { bubbleText, buildChats, isUpdateThread, keyOf, openAsk, replyThread, type Chat } from '../lib/chats';
import { groupName, type Person } from '../lib/people';
import { replyPlan, type Recipients } from '../lib/recipients';
import { fullOf, useLoadedCount } from '../lib/useChatThreads';
import { clearThreadCache, loadThread, peekThread } from '../lib/threadCache';
import { cleanSubject, replyActions } from '../lib/stacks';
import { dueText, isHot } from '../lib/time';
import { facts, skim } from '../lib/skim';
import { findQuote } from '../lib/highlight';
import { demoNote, isSampleInbox } from '../lib/sample';
import { dropMine } from '../lib/myDraft';
import { getDraft, setDraft } from '../lib/chatDraft';
import { moveChatPrefs } from '../lib/chatPrefs';
import { linkify } from '../lib/linkify';
import { cleanEmailText } from '../lib/cleanText';
import { firstName } from '../lib/utils';
import type { EmailMessage, EmailThread } from '../lib/types';
import { Avatar, ChatAvatar, hueOf } from '../components/Avatar';
import { PeopleSheet, sameRecipients } from '../components/PeopleSheet';
import { PeopleList } from '../components/PeopleList';
import { BubbleMedia, isPicture } from '../components/BubbleMedia';
import { ImageViewer } from '../components/ImageViewer';
import { usePictureVersion } from '../lib/pictures';
import { isLiveMode } from '../lib/liveMode';
import { AttachStrip } from '../components/AttachStrip';
import { Sheet } from '../components/Sheet';
import './ChatScreen.css';

const SEND_FAILED = 'That did not send. Try again.';
const ts = (iso: string) => new Date(iso).getTime();
const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((start(now) - start(d)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

type Item =
  | { kind: 'sample'; id: string; text: string }
  | { kind: 'day'; id: string; label: string }
  | { kind: 'subject'; id: string; label: string }
  | { kind: 'msg'; id: string; msg: EmailMessage; thread: EmailThread; held?: boolean };

interface Held {
  id: string;
  text: string;
  at: string;
  threadId: string;
}

function buildItems(threads: EmailThread[], held: Held[], sample: string | null): Item[] {
  const all: { msg: EmailMessage; thread: EmailThread; held?: boolean }[] = [];
  for (const t of threads) for (const m of t.messages ?? []) all.push({ msg: m, thread: t });
  for (const h of held) {
    const thread = threads.find((t) => t.id === h.threadId);
    if (!thread) continue;
    all.push({
      held: true,
      thread,
      msg: { id: h.id, threadId: thread.id, accountId: thread.accountId, fromName: '', fromEmail: thread.accountEmail, toEmails: [], subject: thread.subject, snippet: '', bodyText: h.text, sentAt: h.at, isUnread: false, isOutbound: true, attachments: [] },
    });
  }
  all.sort((a, b) => ts(a.msg.sentAt) - ts(b.msg.sentAt));
  const out: Item[] = sample ? [{ kind: 'sample', id: 'sample', text: sample }] : [];
  let day = '';
  let thread = '';
  for (const e of all) {
    const k = dayKey(e.msg.sentAt);
    if (k !== day) {
      day = k;
      out.push({ kind: 'day', id: `day-${k}`, label: dayLabel(e.msg.sentAt) });
    }
    if (e.thread.id !== thread) {
      thread = e.thread.id;
      out.push({ kind: 'subject', id: `subj-${e.thread.id}`, label: cleanSubject(e.thread.subject) });
    }
    out.push({ kind: 'msg', id: e.msg.id, msg: e.msg, thread: e.thread, held: e.held });
  }
  return out;
}

/** The text with dates, times and amounts, and the asking sentence, set bold. */
function Marked({ text, quote }: { text: string; quote?: string | null }) {
  const ranges = facts(text).map(([a, b]) => [a, b] as [number, number]);
  const q = findQuote(text, quote);
  if (q) ranges.push(q);
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  const bits: ReactNode[] = [];
  let at = 0;
  merged.forEach(([a, b], i) => {
    if (a > at) bits.push(<Fragment key={`t${i}`}>{linkify(text.slice(at, a), `t${i}`)}</Fragment>);
    bits.push(<strong key={`b${i}`} className="bub__bold">{linkify(text.slice(a, b), `b${i}`)}</strong>);
    at = b;
  });
  if (at < text.length) bits.push(<Fragment key="end">{linkify(text.slice(at), 'end')}</Fragment>);
  return <>{bits}</>;
}

function Bubble({ item, first, fresh, who, whoColor, face, mark, whole, setRef, onFold }: { item: Extract<Item, { kind: 'msg' }>; first: boolean; fresh: boolean; who: string | null; whoColor?: string; face?: { name: string; email: string; show: boolean }; mark: string | null; whole: boolean; setRef: (el: HTMLElement | null) => void; onFold: () => void }) {
  const { msg, thread } = item;
  const mine = msg.isOutbound;
  const [all, setAll] = useState(false);
  const [long, setLong] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<number | null>(null);
  usePictureVersion();
  const pictures = msg.attachments.filter(isPicture);
  const cleaned = item.held ? msg.bodyText : whole ? cleanEmailText(msg.bodyText).trim() : bubbleText(msg.bodyText, msg.fromName);
  // An email with no words left shows its subject, unless it carries pictures
  const full = cleaned.trim() || msg.attachments.some(isPicture) ? cleaned : msg.subject || '';
  // Fold by rendered lines: a text more than four lines taller than its 12-line box gets Read more; a shorter overflow is shown whole
  useLayoutEffect(() => {
    const el = body.current;
    if (!el || all) return;
    const tall = el.scrollHeight > 12 * 22 + 88;
    setLong(tall);
    if (tall) onFold();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full, all]);
  return (
    <div ref={setRef} className={`bubrow bubrow--${mine ? 'out' : 'in'}${first ? ' bubrow--first' : ''}${fresh ? ' bubrow--fresh' : ''}${face ? ' bubrow--face' : ''}`}>
      {face?.show && (
        <span className="bubrow__face">
          <Avatar name={face.name.trim().charAt(0)} email={face.email} tone="hue" />
        </span>
      )}
      <div className="bub">
        {who && <div className="bub__who" style={whoColor ? { color: whoColor } : undefined}>{who}</div>}
        <BubbleMedia attachments={msg.attachments} onOpen={setView}>
          {full.trim() && (
            <div ref={body} className={`bub__text${all || !long ? '' : ' bub__text--clamp'}`}>
              <Marked text={full} quote={thread.goalQuote} />
            </div>
          )}
          {long && !all && (
            <button className="bub__more" onClick={() => setAll(true)}>
              Read more
            </button>
          )}
        </BubbleMedia>
        <div className="bub__meta">
          {item.held && <span className="bub__held">Held until after Shabbos</span>}
          {mark && <span className="bub__mark">{mark}</span>}
          <span>{clock(msg.sentAt)}</span>
          {mine && !item.held && <Check size={15} strokeWidth={2} aria-label="Sent" />}
        </div>
      </div>
      {view !== null && <ImageViewer pictures={pictures} index={view} onIndex={setView} onClose={() => setView(null)} />}
    </div>
  );
}

/** The one small note a bubble can carry about who else was on the email. */
function markOf(msg: EmailMessage, thread: EmailThread, chat: Chat, mine: Set<string>, nameOf: (a: string) => string): string | null {
  const low = (l: string[] | undefined) => (l ?? []).map((a) => a.toLowerCase());
  const to = low(msg.toEmails);
  const cc = low(msg.ccEmails);
  if (!msg.isOutbound) {
    if (cc.some((a) => mine.has(a)) && !to.some((a) => mine.has(a))) return "You were cc'd";
    if (!isUpdateThread(thread) && to.length + cc.length > 0 && ![...to, ...cc].some((a) => mine.has(a))) return "You were bcc'd";
    return null;
  }
  if (msg.bccEmails && msg.bccEmails.length > 0) return `Bcc ${msg.bccEmails.map(nameOf).join(', ')}`;
  if (chat.isGroup) {
    const went = new Set([...to, ...cc].filter((a) => !mine.has(a)));
    if (went.size > 0 && chat.people.some((p) => !went.has(p.email.toLowerCase()))) return `Only to ${[...went].map(nameOf).join(', ')}`;
  }
  return null;
}

export function ChatScreen({ chat, desktop }: { chat: Chat; desktop: boolean }) {
  const store = useStore();
  const { data } = store;
  const loaded = useLoadedCount(chat.threads);
  const threads = useMemo(
    () => chat.threads.map(fullOf),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chat.threads, loaded]
  );
  const [held, setHeld] = useState<Held[]>([]);
  const items = useMemo(() => buildItems(threads, held, demoNote()), [threads, held]);
  const sender = chat.isGroup ? undefined : data?.screener.find((s) => s.status === 'pending' && s.email.toLowerCase() === chat.key);
  const ask = openAsk(chat.threads);
  // A company chat answers its newest sender, not every address the company used
  const replyPeople = chat.isCompany ? chat.people.slice(0, 1) : chat.people;
  const target = replyThread(chat, data!) ?? chat.threads[chat.threads.length - 1];
  const mine = useMemo(() => {
    const out = new Set((data?.accounts ?? []).map((a) => a.email.toLowerCase()));
    if (target) out.add(target.accountEmail.toLowerCase());
    return out;
  }, [data?.accounts, target]);
  const everyone = useMemo(() => {
    const seen = new Map<string, Person>();
    for (const p of chat.people) seen.set(p.email.toLowerCase(), p);
    for (const t of data?.threads ?? []) {
      for (const p of t.participants) {
        const e = p.email.toLowerCase();
        if (e && !mine.has(e) && !seen.has(e)) seen.set(e, { name: p.name || p.email, email: p.email });
      }
    }
    return [...seen.values()];
  }, [chat.people, data?.threads, mine]);
  const nameOf = (a: string) => {
    const hit = everyone.find((p) => p.email.toLowerCase() === a.toLowerCase());
    return hit ? firstName(hit.name || hit.email) : a;
  };
  const ready = !!target && !!peekThread(target.id);
  const [, setArrived] = useState(0);
  // The email being answered must be loaded before anything can be sent: a summary has no messages
  useEffect(() => {
    if (!target || peekThread(target.id)) return;
    let live = true;
    void loadThread(target.id).then(
      () => live && setArrived((n) => n + 1),
      () => undefined
    );
    return () => {
      live = false;
    };
  }, [target?.id, ready]);
  const targetFull = target && ready ? fullOf(target) : undefined;
  const plan = useMemo(
    () => replyPlan(targetFull?.messages ?? [], replyPeople.map((p) => p.email), mine, !!targetFull && isUpdateThread(targetFull)),
    [targetFull, replyPeople, mine]
  );
  const [rec, setRec] = useState<Recipients | null>(null);
  // Set by the restore below so the save that runs in the same pass does not wipe the stored people
  const skipSave = useRef(false);
  const restoredFor = useRef<string | undefined>(undefined);
  // The newest message in the thread: a kept choice of people is only good while this is still the newest
  const newestId = useMemo(() => {
    const msgs = targetFull?.messages ?? [];
    return msgs.reduce<EmailMessage | undefined>((a, m) => (!a || ts(m.sentAt) > ts(a.sentAt) ? m : a), undefined)?.id;
  }, [targetFull]);
  useEffect(() => {
    if (!ready) {
      if (restoredFor.current !== target?.id) setRec(null);
      return;
    }
    if (restoredFor.current === target?.id) return;
    restoredFor.current = target?.id;
    const d = getDraft(chat.key);
    const r = d?.rec;
    const okList = (l: unknown) => Array.isArray(l) && l.every((a) => typeof a === 'string' && a.includes('@'));
    const valid =
      !!d && !!r && !!target && d.threadId === target.id && !!newestId && d.lastId === newestId && okList(r.to) && okList(r.cc) && okList(r.bcc) && r.to.length > 0 &&
      ![...r.to, ...r.cc, ...r.bcc].some((a) => mine.has(a.toLowerCase()));
    skipSave.current = true;
    setRec(valid && r ? { to: [...r.to], cc: [...r.cc], bcc: [...r.bcc] } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.id, ready]);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => {
    if (!ready) setPeopleOpen(false);
  }, [ready]);
  const sendTo = rec ?? plan.rec;
  const edited = !!rec && !sameRecipients(rec, plan.rec);
  // Names in the order of the chat's people, then anyone added
  const order = (l: string[]) => {
    const rank = (a: string) => {
      const i = chat.people.findIndex((p) => p.email.toLowerCase() === a.toLowerCase());
      return i < 0 ? chat.people.length : i;
    };
    return [...l].sort((x, y) => rank(x) - rank(y));
  };
  const nameList = (l: string[]) => {
    const n = order(l).map((a) => nameOf(a));
    return n.length <= 1 ? n.join('') : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`;
  };
  const copyList = (l: string[]) => order(l).map((a) => nameOf(a)).join(', ');
  const wentTo = [...sendTo.to, ...sendTo.cc];
  const chatAddrs = chat.people.map((p) => p.email.toLowerCase()).filter((a) => !mine.has(a));
  const narrower = chat.isGroup && wentTo.length < chatAddrs.length && sendTo.bcc.length === 0 && wentTo.every((a) => chatAddrs.includes(a.toLowerCase()));
  // The sender of the newest email that is not mine: the sheet offers Everyone or Only them
  const replyTo = useMemo(() => {
    const msgs = targetFull?.messages ?? [];
    const theirs = msgs.filter((m) => !m.isOutbound && !mine.has(m.fromEmail.toLowerCase()));
    const last = theirs.reduce<EmailMessage | undefined>((a, m) => (!a || ts(m.sentAt) > ts(a.sentAt) ? m : a), undefined);
    if (!last) return undefined;
    const email = last.fromEmail.toLowerCase();
    return { email, firstName: firstName(last.fromName || last.fromEmail) };
  }, [targetFull, mine]);
  const toLine =
    plan.self && !edited
      ? 'To yourself'
      : plan.bccd && !edited
      ? `To ${nameList(sendTo.to)} only \u00B7 You were bcc'd`
      : `To ${nameList(sendTo.to)}${narrower ? ' only' : ''}${sendTo.cc.length ? ` \u00B7 Cc ${copyList(sendTo.cc)}` : ''}${sendTo.bcc.length ? ` \u00B7 Bcc ${copyList(sendTo.bcc)}` : ''}`;
  const headLine = plan.bccd && ready ? 'You got a hidden copy (Bcc)' : chat.isGroup ? chat.people.map((p) => p.email).join(', ') : chat.email;
  const suggestions = (() => {
    const t = ready && data ? replyThread(chat, data) : undefined;
    return t ? replyActions(fullOf(t)).filter((c) => !!c.draftBody) : [];
  })();

  const scroller = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const els = useRef(new Map<string, HTMLElement>());
  const known = useRef<Set<string> | null>(null);
  const [text, setTextState] = useState(() => getDraft(chat.key)?.text ?? '');
  const setText = (t: string) => setTextState(t);
  useEffect(() => {
    // Until the thread is loaded the kept people have not been restored: saving now would wipe them
    if (target && !ready) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    const keep = rec && !sameRecipients(rec, plan.rec) ? rec : undefined;
    setDraft(chat.key, { text, rec: keep, threadId: target?.id, lastId: keep ? newestId : undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, rec, plan, target?.id, ready, newestId]);
  const [sending, setSending] = useState(false);
  const [whole, setWhole] = useState(false);
  const [folds, setFolds] = useState(0);
  const [away, setAway] = useState(false);
  // Sample inbox only: files chosen for the next message
  const [files, setFiles] = useState<File[]>([]);
  const picker = useRef<HTMLInputElement>(null);
  const addFiles = (list: FileList | null) => {
    const chosen = Array.from(list ?? []);
    if (picker.current) picker.current.value = '';
    const room = Math.max(0, 10 - files.length);
    const fit = chosen.filter((f) => f.size <= 10 * 1024 * 1024).slice(0, room);
    if (fit.length < chosen.length) store.showToast('That file is too big to send.');
    if (fit.length > 0) setFiles((l) => [...l, ...fit]);
  };
  // How far the person is from the newest message, as last seen: the list keeps them there when it changes height
  const gap = useRef(0);
  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    gap.current = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAway(gap.current > 400);
  };
  const toNewest = () => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  // Opening a chat marks its unread threads read
  const marked = useRef(new Set<string>());
  useEffect(() => {
    for (const t of chat.threads) {
      if (!t.isUnread || marked.current.has(t.id)) continue;
      marked.current.add(t.id);
      store.patchThread(t.id, { isUnread: false });
      void api.markReadThread(t.id, false).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.threads]);

  // The list changed height (the keyboard, the suggestions, the ask bar, the field growing): stay on the newest message unless the person scrolled up
  useEffect(() => {
    const el = scroller.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(() => {
      if (gap.current <= 120) el.scrollTop = el.scrollHeight;
      gap.current = el.scrollHeight - el.scrollTop - el.clientHeight;
    });
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  // The newest message is in view when a chat opens and when one is added
  const count = items.length;
  const last = useRef(0);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || count === 0) return;
    el.scrollTop = el.scrollHeight;
    last.current = count;
  }, [count, folds]);
  const fresh = known.current ? new Set(items.filter((i) => i.kind === 'msg' && !known.current!.has(i.id)).map((i) => i.id)) : new Set<string>();
  useEffect(() => {
    if (items.some((i) => i.kind === 'msg')) known.current = new Set(items.map((i) => i.id));
  });

  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [text]);

  const goToAsk = () => {
    if (!ask) return;
    const t = threads.find((x) => x.id === ask.id);
    const msgs = [...(t?.messages ?? [])].sort((a, b) => ts(b.sentAt) - ts(a.sentAt)).filter((m) => !m.isOutbound);
    const hit = msgs.find((m) => findQuote(bubbleText(m.bodyText, m.fromName), ask.goalQuote)) ?? msgs[0];
    const el = hit && els.current.get(hit.id);
    el?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  const [checking, setChecking] = useState(false);
  const checkOff = () => {
    if (!ask || checking) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      void store.done(ask, null);
      return;
    }
    setChecking(true);
    window.setTimeout(() => {
      setChecking(false);
      void store.done(ask, null);
    }, 250);
  };

  const back = () => (cameFrom() === '/chats' || cameFrom() === '/chats/archived' ? goBack() : navigate('/chats', { replace: true }));

  const decide = async (d: 'approved' | 'muted') => {
    if (!sender) return;
    await store.decide(sender, 'new-senders', d);
    if (d === 'muted') navigate('/chats', { replace: true });
  };

  const send = async () => {
    const body = text.trim();
    if ((!body && files.length === 0) || sending || !ready || !target || sendTo.to.length === 0) return;
    setSending(true);
    try {
      // Does a chat already have the key this send may move the thread to? Looked at before the send changes anything.
      const willAdd = [...sendTo.to, ...sendTo.cc].filter((a) => !chat.people.some((p) => p.email.toLowerCase() === a.toLowerCase()));
      const newKeyTaken = willAdd.length > 0 && !!data && buildChats(data, peekThread, Date.now()).some((c) => c.key === keyOf([...chat.people, ...willAdd.map((email) => ({ email }))]));
      const subject = /^re:/i.test(target.subject) ? target.subject : `Re: ${cleanSubject(target.subject)}`;
      let d: { id: string };
      let res: { status?: string; heldByShabbos?: boolean };
      try {
        d = await api.createDraft({
          threadId: target.id,
          accountId: target.accountId,
          toEmails: sendTo.to,
          ...(sendTo.cc.length ? { ccEmails: sendTo.cc } : {}),
          ...(sendTo.bcc.length ? { bccEmails: sendTo.bcc } : {}),
          subject,
          bodyText: body,
          ...(files.length ? { attachments: files.map((f, i) => ({ id: `att_up_${Date.now()}_${i}`, filename: f.name, mimeType: f.type || 'application/octet-stream', sizeBytes: f.size, ...(f.type.startsWith('image/') ? { previewUrl: URL.createObjectURL(f) } : {}) })) } : {}),
          createdBy: 'user',
          status: 'pending_approval',
        });
      } catch {
        store.showToast(SEND_FAILED);
        return;
      }
      try {
        res = await api.sendDraft(d.id);
      } catch {
        await api.deleteDraft(d.id).catch(() => undefined);
        store.showToast(SEND_FAILED);
        return;
      }
      // The email is out. Nothing after this point may offer to send it again.
      const went = sendTo;
      const names = nameList([...went.to, ...went.cc]);
      setText('');
      setFiles([]);
      setRec(null);
      const hold = res.status === 'held_shabbos' || !!res.heldByShabbos;
      try {
        store.markReplied(target, names, hold, false);
      } catch {
        /* the toast is not worth a second send */
      }
      if (hold) setHeld((h) => [...h, { id: `held-${d.id}`, text: body, at: new Date().toISOString(), threadId: target.id }]);
      await api.archiveThread(target.id).catch(() => undefined);
      await dropMine(target.id, d.id).catch(() => undefined);
      clearThreadCache();
      await store.refresh().catch(() => undefined);
      // Someone new on To or Cc: the thread now belongs to the group chat that includes them
      const added = [...went.to, ...went.cc].filter((a) => !chat.people.some((p) => p.email.toLowerCase() === a.toLowerCase()));
      // Let the refreshed chats draw first, so the new chat is there when the route changes
      if (added.length > 0) {
        await new Promise((done) => requestAnimationFrame(() => done(null)));
        const newKey = keyOf([...chat.people, ...added.map((email) => ({ email }))]);
        // Nothing else is left under the old key, and the email was really sent (a held one adds nobody yet): its pin and mute move to the new one
        if (!hold && chat.threads.every((t) => t.id === target.id)) moveChatPrefs(chat.key, newKey, newKeyTaken);
        navigate(`/chat/${encodeURIComponent(newKey)}`, { replace: true });
      }
    } finally {
      setSending(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && desktop && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  };

  const pickSuggestion = (body: string) => {
    setText(skim(body));
    field.current?.focus({ preventScroll: true });
  };

  let prev: Item | undefined;
  const rows = items.map((it, idx) => {
    const before = prev;
    prev = it;
    if (it.kind === 'sample') return <div key={it.id} className="chatpill chatpill--note">{it.text}</div>;
    if (it.kind === 'day') return <div key={it.id} className="chatpill">{it.label}</div>;
    if (it.kind === 'subject')
      return (
        <div key={it.id} className="chatpill chatpill--subject">
          <Mail size={13} strokeWidth={2} aria-hidden="true" />
          <span>{it.label}</span>
        </div>
      );
    const same = before?.kind === 'msg' && before.msg.isOutbound === it.msg.isOutbound && before.msg.fromEmail.toLowerCase() === it.msg.fromEmail.toLowerCase();
    const theirs = !it.msg.isOutbound;
    const next = items[idx + 1];
    const lastOfRun = !(next?.kind === 'msg' && next.msg.isOutbound === it.msg.isOutbound && next.msg.fromEmail.toLowerCase() === it.msg.fromEmail.toLowerCase());
    const other = chat.isGroup ? theirs && !same : chat.isCompany ? theirs && (it.msg.fromName || it.msg.fromEmail) !== chat.name : theirs && it.msg.fromEmail.toLowerCase() !== chat.key;
    return (
      <Bubble
        key={it.id}
        item={it}
        first={!same}
        fresh={fresh.has(it.id)}
        who={other ? it.msg.fromName || it.msg.fromEmail : null}
        face={chat.isGroup && theirs ? { name: it.msg.fromName || it.msg.fromEmail, email: it.msg.fromEmail, show: lastOfRun } : undefined}
        whoColor={chat.isGroup ? `color-mix(in srgb, ${hueOf(it.msg.fromEmail)} 72%, #000)` : undefined}
        mark={it.held ? null : markOf(it.msg, it.thread, chat, mine, nameOf)}
        whole={whole}
        onFold={() => setFolds((n) => n + 1)}
        setRef={(el) => (el ? els.current.set(it.id, el) : els.current.delete(it.id))}
      />
    );
  });

  // Live Gmail is read only: no composer at all (no field, Send, To line, Cc/Bcc, paperclip or suggested replies)
  const readOnly = isLiveMode();
  return (
    <div className={`chat${readOnly ? ' chat--readonly' : ''}`}>
      <header className="chat__head">
        {!desktop && (
          <button className="chatapp__icon chat__back" aria-label="Back to emails" onClick={back}>
            <ChevronLeft size={26} strokeWidth={1.75} />
          </button>
        )}
        <ChatAvatar chat={chat} small />
        <button
          className="chat__who"
          aria-label="People on this email"
          onClick={() => {
            if (!ready) return;
            setPeopleOpen(true);
          }}
        >
          <span className="chat__name">{chat.isGroup ? groupName(chat.people) : chat.name}</span>
          <span className="chat__addr">{headLine}</span>
        </button>
        <button className="chatapp__icon" aria-label="More" onClick={() => setMoreOpen(true)}>
          <MoreHorizontal size={22} strokeWidth={1.75} />
        </button>
      </header>
      {sender && (
        <div className="chatbarnew">
          <span>New sender. Allow them in?</span>
          <button className="chatbarnew__block" onClick={() => void decide('muted')}>
            Block
          </button>
          <button className="chatbarnew__allow" onClick={() => void decide('approved')}>
            Allow
          </button>
        </div>
      )}
      {ask && !sender && (
        <div className="chatask">
          <button className={`chatask__check${checking ? ' chatask__check--on' : ''}`} aria-label="Mark as done" onClick={checkOff}>
            <span className="chatask__ring">{checking && <Check size={16} strokeWidth={3} aria-hidden="true" />}</span>
          </button>
          <button className="chatask__text" onClick={goToAsk}>
            <span className="chatask__words">
              <span className="chatask__ask">{ask.distilledAsk}</span>
              {ask.deadlineLabel && <span className={`chatask__due${isHot(ask.deadlineLabel) ? ' chatask__due--hot' : ''}`}>{dueText(ask.deadlineLabel)}</span>}
            </span>
          </button>
        </div>
      )}
      <div className="chat__area">
        <div className="chat__scroll" ref={scroller} onScroll={onScroll}>
          <div className="chat__col">{rows}</div>
        </div>
        {away && (
          <button type="button" className="chat__down" aria-label="Newest message" onClick={toNewest}>
            <span className="chat__downdot">
              <ChevronDown size={22} strokeWidth={2} aria-hidden="true" />
            </span>
          </button>
        )}
      </div>
      {!readOnly && (
      <div className="chatbar">
        {suggestions.length > 0 && !text && (
          <div className="chatbar__sugs" role="group" aria-label="Suggested replies">
            {suggestions.map((c) => (
              <button key={c.id} className="chatbar__sug" onClick={() => pickSuggestion(c.draftBody ?? '')}>
                {c.label}
              </button>
            ))}
          </div>
        )}
        <div className="chatbar__line">
          <button className="chatbar__to" disabled={!ready} onClick={() => setPeopleOpen(true)}>
            <span>{ready ? toLine : ''}</span>
          </button>
          <button className="chatbar__cc" disabled={!ready} onClick={() => setPeopleOpen(true)}>
            Cc/Bcc
          </button>
        </div>
        {isSampleInbox() && <AttachStrip files={files} onRemove={(i) => setFiles((l) => l.filter((_, n) => n !== i))} />}
        <div className="chatbar__row">
          {isSampleInbox() && (
            <>
              <input ref={picker} type="file" multiple hidden onChange={(e) => addFiles(e.target.files)} />
              <button type="button" className="chatbar__attach" aria-label="Attach a picture or file" onClick={() => picker.current?.click()}>
                <Paperclip size={22} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </>
          )}
          <textarea
            ref={field}
            className="chatbar__field"
            rows={1}
            placeholder="Message"
            aria-label="Message"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
          />
          <button className="chatbar__send" aria-label="Send" disabled={(!text.trim() && files.length === 0) || sending || !ready || sendTo.to.length === 0} onClick={() => void send()}>
            <SendHorizontal size={22} strokeWidth={2} />
          </button>
        </div>
      </div>
      )}
      {moreOpen && (
        <Sheet title={chat.isGroup ? groupName(chat.people) : chat.name} onClose={() => setMoreOpen(false)} className="moresheet">
          <button
            className="moresheet__row"
            onClick={() => {
              setWhole((w) => !w);
              setMoreOpen(false);
            }}
          >
            <MailOpen size={22} strokeWidth={1.75} aria-hidden="true" />
            <span>{whole ? 'Show short emails' : 'Show full emails'}</span>
          </button>
          {!readOnly && (
            <button
              className="moresheet__row"
              onClick={() => {
                if (!ready) return;
                setMoreOpen(false);
                setPeopleOpen(true);
              }}
            >
              <Users size={22} strokeWidth={1.75} aria-hidden="true" />
              <span>Who gets your message</span>
            </button>
          )}
        </Sheet>
      )}
      {peopleOpen && ready && readOnly && <PeopleList people={chat.people} onClose={() => setPeopleOpen(false)} />}
      {peopleOpen && ready && !readOnly && <PeopleSheet rec={sendTo} plan={plan.rec} mine={mine} known={everyone} group={chat.isGroup} showSwitch={chat.isGroup && !plan.bccd} everyone={chatAddrs} replyTo={replyTo} onChange={setRec} onClose={() => setPeopleOpen(false)} />}
    </div>
  );
}
