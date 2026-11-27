import { api } from './api';
import type { DraftItem, EmailThread } from './types';

/** The person's own unsent drafts for one email: any draft of it that holds words they saved, whoever wrote it first. A suggestion nobody saved stays `pending_approval` and is not one. There should be one; older stores may hold more. */
export async function myDrafts(threadId: string): Promise<DraftItem[]> {
  const list = await api.getDrafts();
  return list.filter((d) => d.threadId === threadId && d.status === 'draft');
}

/** Keeps `text` as the one draft of yours for this email: the existing one is changed, or one is made. Returns false when it already held exactly this. */
export async function saveMine(thread: EmailThread, to: string, subject: string, text: string): Promise<boolean> {
  const [mine] = await myDrafts(thread.id);
  if (mine) {
    if (mine.bodyText.trim() === text) return false;
    await api.updateDraft(mine.id, { bodyText: text, status: 'draft' });
    return true;
  }
  await api.createDraft({ threadId: thread.id, accountId: thread.accountId, toEmails: [to], subject, bodyText: text, createdBy: 'user', status: 'draft' });
  return true;
}

/** After a send: no draft of yours for this email stays in Drafts. */
export async function dropMine(threadId: string, exceptId?: string): Promise<void> {
  const list = await myDrafts(threadId);
  await Promise.all(list.filter((d) => d.id !== exceptId).map((d) => api.deleteDraft(d.id).catch(() => undefined)));
}
