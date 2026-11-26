import { useMemo, useState } from 'react';
import { api } from '../lib/api';
import { sentToast } from '../lib/snapshot';
import { counterpart } from '../lib/stacks';
import type { DraftItem } from '../lib/types';
import { firstName } from '../lib/utils';
import { navigate } from '../router';
import { useStore } from '../store';
import { NOT_SAVED } from '../storeActions';
import { PageShell } from '../components/PageShell';
import '../components/List.css';
import './DraftsScreen.css';

export function DraftsScreen() {
  const store = useStore();
  const { data } = store;
  const [busy, setBusy] = useState<string | null>(null);
  const drafts = useMemo(
    () =>
      (data?.drafts ?? [])
        .filter((d) => d.status !== 'sent')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [data]
  );

  const who = (d: DraftItem) => {
    const thread = data?.threads.find((t) => t.id === d.threadId);
    const to = d.toEmails[0] ?? '';
    return thread && to ? firstName(counterpart(thread).name) : to;
  };

  const send = async (d: DraftItem) => {
    setBusy(d.id);
    try {
      const res = await api.sendDraft(d.id);
      store.showToast(sentToast(res.status === 'held_shabbos' || res.heldByShabbos ? 'Held until after Shabbos' : `Sent to ${who(d)}`));
      await store.refresh();
    } catch {
      store.showToast(NOT_SAVED);
    }
    setBusy(null);
  };

  const remove = async (d: DraftItem) => {
    setBusy(d.id);
    try {
      await api.deleteDraft(d.id);
      store.showToast('Draft deleted');
      await store.refresh();
    } catch {
      store.showToast(NOT_SAVED);
    }
    setBusy(null);
  };

  const edit = (d: DraftItem) => navigate(d.threadId ? `/reply/${d.threadId}?draft=${d.id}` : `/new?draft=${d.id}`);

  return (
    <PageShell title="Drafts" canvas>
      {drafts.length === 0 ? (
        <div className="list-empty">No drafts</div>
      ) : (
        <ul className="drafts">
          {drafts.map((d) => (
            <li key={d.id} className="draft">
              <div className="draft__head">
                <span className="draft__to">To {d.toEmails[0] ?? ''}</span>
                {d.status === 'held_shabbos' && <span className="draft__held">Held until after Shabbos</span>}
              </div>
              <h2 className="draft__subject">{d.subject}</h2>
              <p className="draft__body">{d.bodyText}</p>
              <div className="draft__actions">
                <button className="btn btn--primary draft__send" disabled={busy === d.id} onClick={() => void send(d)}>
                  Send
                </button>
                <button className="btn btn--secondary draft__send" disabled={busy === d.id} onClick={() => edit(d)}>
                  Edit
                </button>
                <button className="btn btn--text draft__delete" disabled={busy === d.id} onClick={() => void remove(d)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
