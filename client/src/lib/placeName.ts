import { isStackId, stackLabel } from './stacks';

/** The name of a place, for the back button of the page opened from it. */
export function placeName(path: string | undefined): string {
  const [head, arg] = (path ?? '').split('?')[0].split('/').filter(Boolean);
  if (head === 'cards') return isStackId(arg) ? stackLabel(arg) : 'Back';
  switch (head) {
    case 'chats': case 'chat': return 'Chats';
    case 'goals': return 'To-do';
    case 'drafts': return 'Drafts';
    case 'all': return 'All mail';
    case 'ask': return 'Search';
    case 'settings': return 'Settings';
    case 'new': return 'New email';
    case 'read': return 'Email';
    default: return 'Back';
  }
}
