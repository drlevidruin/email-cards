import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '../lib/api';
import { counterpart, cleanSubject } from '../lib/stacks';
import { relativeTime } from '../lib/time';
import type { EmailThread } from '../lib/types';
import { navigate } from '../router';
import { useStore } from '../store';
import { Avatar } from '../components/Avatar';
import { PageShell } from '../components/PageShell';
import '../components/List.css';
import './AllMailScreen.css';

const DAY = 86400000;

/** `Today`, `Yesterday`, then the date. */
function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((start(now) - start(d)) / DAY);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).replace(/^\w+, /, '');
}

export function AllMailScreen() {
  const store = useStore();
  const [query, setQuery] = useState('');
  const [archived, setArchived] = useState(false);
  const [found, setFound] = useState<EmailThread[] | null>(null);
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
  const groups = useMemo(() => {
    if (!found) return null;
    const live = new Map((data?.threads ?? []).map((t) => [t.id, t]));
    const rows = found
      .map((t) => live.get(t.id) ?? t)
      .filter((t) => !!t.isArchived === archived)
      .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
    const out: { label: string; rows: EmailThread[] }[] = [];
    for (const t of rows) {
      const label = dayLabel(t.lastMessageAt);
      const last = out[out.length - 1];
      if (last && last.label === label) last.rows.push(t);
      else out.push({ label, rows: [t] });
    }
    return out;
  }, [found, data, archived]);

  return (
    <PageShell title="All mail" canvas>
      <label className="search">
        <Search size={18} strokeWidth={1.75} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search mail" aria-label="Search mail" type="search" enterKeyHint="search" />
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
        {groups && groups.length === 0 && <div className="list-empty">No mail found</div>}
        {groups?.map((g) => (
          <section key={g.label}>
            <h2 className="list-heading">{g.label}</h2>
            <ul className="list mail__list">
              {g.rows.map((t) => (
                <li key={t.id}>
                  <button className={`mail__row${t.isUnread ? ' is-unread' : ''}`} onClick={() => navigate(`/read/${t.id}`)}>
                    <Avatar name={counterpart(t).name} email={counterpart(t).email} card />
                    <span className="mail__main">
                      <span className="mail__line">
                        <span className="t-callout mail__from">{counterpart(t).name}</span>
                        <span className="t-footnote mail__time">{relativeTime(t.lastMessageAt)}</span>
                      </span>
                      <span className="t-subhead mail__subject">{cleanSubject(t.subject)}</span>
                      <span className="t-footnote mail__snippet">{t.snippet}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </PageShell>
  );
}
