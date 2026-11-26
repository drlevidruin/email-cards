import { BlankText } from '../components/BlankText';
import { blanksOf } from '../lib/commitments';
import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { counterpart } from '../lib/stacks';
import { relativeTime } from '../lib/time';
import type { DraftItem } from '../lib/types';
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
    return thread ? counterpart(thread).name : d.toEmails[0] ?? 'No recipient';
  };

  // Delete, with Undo in the toast: the undo makes the same draft again
  const remove = async (d: DraftItem) => {
    setBusy(d.id);
    try {
      await api.deleteDraft(d.id);
      await store.refresh();
      store.offerUndo('Draft deleted', async () => {
        await api.createDraft({
          threadId: d.threadId ?? null,
          accountId: d.accountId,
          toEmails: d.toEmails,
          ccEmails: d.ccEmails,
          subject: d.subject,
          bodyText: d.bodyText,
          tone: d.tone,
          status: d.status,
          createdBy: d.createdBy,
        });
        await store.refresh();
      });
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
        <ul className="list list--desk drafts">
          {drafts.map((d) => (
            <li key={d.id} className="draft">
              <button className="draft__open" onClick={() => edit(d)}>
                <span className="draft__line">
                  <span className="t-callout draft__to">{who(d)}</span>
                  <span className="t-footnote draft__time">{d.status === 'held_shabbos' ? 'Held until after Shabbos' : relativeTime(d.createdAt)}</span>
                </span>
                <span className="t-subhead draft__subject">{d.subject || 'No subject'}</span>
                <span className="t-footnote draft__body"><BlankText text={d.bodyText} blanks={blanksOf(d.bodyText)} /></span>
              </button>
              <button className="draft__delete" aria-label={`Delete draft to ${who(d)}`} disabled={busy === d.id} onClick={() => void remove(d)}>
                <Trash2 size={18} strokeWidth={1.75} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
