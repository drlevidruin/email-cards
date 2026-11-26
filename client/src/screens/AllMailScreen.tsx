import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '../lib/api';
import { counterpart, cleanSubject } from '../lib/stacks';
import { relativeTime } from '../lib/time';
import type { EmailThread } from '../lib/types';
import { useIsDesktop } from '../lib/useIsDesktop';
import { navigate, useRoute } from '../router';
import { useStore } from '../store';
import { ActionBar } from '../components/ActionBar';
import { PageShell } from '../components/PageShell';
import { ThreadView } from '../components/ThreadView';
import { useThreadActions } from '../components/useThreadActions';
import '../components/List.css';
import './AllMailScreen.css';

export function AllMailScreen() {
  const store = useStore();
  const desktop = useIsDesktop();
  const route = useRoute();
  const [query, setQuery] = useState('');
  const [archived, setArchived] = useState(false);
  const [found, setFound] = useState<EmailThread[] | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const { account, data } = store;

  useEffect(() => {
    let live = true;
    const timer = window.setTimeout(() => {
      api
        .getThreads({ q: query.trim() || undefined, accountId: account })
        .then((list) => live && setFound(list))
        .catch(() => live && setFound([]));
    }, query ? 200 : 0);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [query, account]);

  // Rows follow the store, so Done on the open email moves it out of Inbox at once.
  const rows = useMemo(() => {
    if (!found) return null;
    const live = new Map((data?.threads ?? []).map((t) => [t.id, t]));
    return found
      .map((t) => live.get(t.id) ?? t)
      .filter((t) => !!t.isArchived === archived)
      .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
  }, [found, data, archived]);

  const wanted = route.segments[0] === 'all' ? route.segments[1] : undefined;
  const selected = desktop && rows ? rows.find((t) => t.id === wanted) ?? rows[0] : undefined;
  const { act, sheet } = useThreadActions(selected, false);

  useEffect(() => {
    if (desktop && selected && selected.id !== wanted) navigate(`/all/${selected.id}`, { replace: true });
  }, [desktop, selected, wanted]);

  useEffect(() => {
    if (!desktop) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key === '/' && el?.tagName !== 'INPUT' && el?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [desktop]);

  const open = (t: EmailThread) => (desktop ? navigate(`/all/${t.id}`, { replace: true }) : navigate(`/read/${t.id}`));

  const list = (
    <>
      <label className="search">
        <Search size={18} strokeWidth={2} />
        <input
          ref={input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search mail"
          aria-label="Search mail"
          type="search"
          enterKeyHint="search"
        />
      </label>
      <div className="seg" role="group">
        <button className={archived ? '' : 'is-on'} aria-pressed={!archived} onClick={() => setArchived(false)}>
          Inbox
        </button>
        <button className={archived ? 'is-on' : ''} aria-pressed={archived} onClick={() => setArchived(true)}>
          Archived
        </button>
      </div>
      <div className="mail__results">
        {rows && rows.length === 0 && <div className="list-empty">No mail found</div>}
        {rows && rows.length > 0 && (
          <ul className="list">
            {rows.map((t) => (
              <li key={t.id}>
                <button className={`mail__row${selected?.id === t.id ? ' is-open' : ''}`} onClick={() => open(t)}>
                  <span className="mail__line">
                    {t.isUnread && <span className="mail__dot" role="img" aria-label="Unread" />}
                    <span className="mail__from">{counterpart(t).name}</span>
                    <span className="mail__time">{relativeTime(t.lastMessageAt)}</span>
                  </span>
                  <span className="mail__subject">{cleanSubject(t.subject)}</span>
                  <span className="mail__snippet">{t.snippet}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );

  if (!desktop) {
    return (
      <PageShell title="All mail" canvas>
        {list}
      </PageShell>
    );
  }
  return (
    <PageShell title="All mail" canvas fill>
      <div className="mail">
        <div className="mail__left">{list}</div>
        <section className="mail__right">
          {selected && (
            <>
              <div className="mail__thread">
                <ThreadView key={selected.id} threadId={selected.id} />
              </div>
              <div className="mail__bar">
                <ActionBar variant={selected.isStarred ? 'bookmarked' : 'default'} active={null} onAction={act} plainLabels />
              </div>
            </>
          )}
        </section>
      </div>
      {sheet}
    </PageShell>
  );
}
