import type { EmailThread } from './types';

export type Category = 'people' | 'bills' | 'orders' | 'travel' | 'events' | 'alerts' | 'news';

export const CATEGORY_LABEL: Record<Category, string> = {
  people: 'People',
  bills: 'Bills',
  orders: 'Orders',
  travel: 'Travel',
  events: 'Events',
  alerts: 'Alerts',
  news: 'News',
};

export const CATEGORY_ORDER: Category[] = ['people', 'bills', 'orders', 'travel', 'events', 'alerts', 'news'];

/** Whole words only: a term never matches inside a longer word. A space in a term also matches a hyphen. A term ending in a symbol (like "order #") needs no closing boundary. */
const words = (terms: string[]) =>
  new RegExp(`\\b(?:${terms.map((t) => t.replace(/ /g, '[- ]') + (/\w$/.test(t) ? '\\b' : '')).join('|')})`);

const ALERT = words(['security alert', 'sign in', 'signin', 'new login', 'verification code', 'verify your', 'password', 'suspicious', 'fraud', 'unusual activity', 'account alert', 'two factor']);
const ORDER = words(['your order', 'order number', 'order confirmation', 'order #', 'ordered', 'shipped', 'shipping', 'shipment', 'out for delivery', 'delivered', 'delivery', 'tracking number', 'package', 'packages', 'parcel', 'return label', 'return request', 'refund', 'pickup code', 'ready for pickup', 'arriving']);
const TRAVEL = words(['flight', 'flights', 'itinerary', 'boarding', 'hotel', 'airline', 'airlines', 'airport', 'rental car', 'airbnb']);
const EVENT = words(['invitation', 'invited', 'rsvp', 'calendar', 'webinar', 'event', 'register', 'registration', 'save the date', 'ticket', 'tickets']);
const BILL = words(['invoice', 'bill', 'receipt', 'payment', 'statement', 'subscription', 'renewal', 'charged', 'autopay', 'past due', 'amount due']);

const BULK_NAMES = new Set(['news', 'newsletter', 'newsletters', 'marketing', 'promo', 'promotions', 'offers', 'deals', 'digest', 'rewards', 'members', 'member', 'updates', 'update', 'mailer', 'email', 'mail']);
const BULK_PREFIX = /^(?:noreply|no-reply|no_reply|donotreply|do-not-reply|do_not_reply)/;
const BULK_HOSTS = new Set(['email', 'mail', 'e', 't', 'em', 'm', 'news', 'newsletter', 'info', 'member', 'members', 'marketing', 'notify', 'notifications', 'alerts', 'updates', 'reply', 'send', 'bounce', 'mailer', 'mg']);
const AUTO_NAMES = new Set(['info', 'support', 'help', 'hello', 'hi', 'team', 'billing', 'invoice', 'invoices', 'receipt', 'receipts', 'order', 'orders', 'shipping', 'tracking', 'service', 'customerservice', 'customer-service', 'care', 'account', 'accounts', 'security', 'admin', 'system', 'confirmation', 'contact', 'sales', 'store', 'locker', 'alerts', 'alert', 'notify', 'notification', 'notifications']);

const splitEmail = (email: string | undefined) => {
  if (!email || !email.includes('@')) return null;
  const at = email.lastIndexOf('@');
  return { local: email.slice(0, at).toLowerCase(), domain: email.slice(at + 1).toLowerCase() };
};

/** True for an address a mailing list or marketing system sends from (noreply, news, a mail.shop.com style host). */
export function looksBulk(email: string | undefined): boolean {
  const e = splitEmail(email);
  if (!e) return false;
  if (BULK_PREFIX.test(e.local) || BULK_NAMES.has(e.local)) return true;
  const labels = e.domain.split('.');
  return labels.length >= 3 && BULK_HOSTS.has(labels[0]);
}

/** True for an address a company sends from (bulk, or a role like support@ or billing@), not a person. */
export function looksAutomated(email: string | undefined): boolean {
  const e = splitEmail(email);
  if (!e) return false;
  if (looksBulk(email)) return true;
  const local = e.local.split('+')[0];
  // A role word inside a longer name counts too: amazonlockers@, orderupdates@, autoconfirm@
  return AUTO_NAMES.has(local) || AUTO_STEMS.test(local);
}

const AUTO_STEMS = /noreply|notif|newsletter|mailer|locker|receipt|billing|invoice|shipment|tracking|confirm|alert|digest|reward|marketing|promo|support|service/;

type CategoryThread = Pick<EmailThread, 'subject' | 'snippet' | 'labels' | 'bucket' | 'receiptInfo'>;
export type CategoryContext = { isUpdate: boolean; senderEmail?: string; isGroup?: boolean };

/** The kind of mail a thread is. First match wins: a receipt (orders, then travel, else bills); a newsletter or promotion label (news); a group chat (people); mail that is not automated (people); then, for automated mail, alerts, orders, travel, events, bills, else news if it is an update or bulk sender, else people. */
export function threadCategory(t: CategoryThread, ctx: CategoryContext): Category {
  const labels = t.labels ?? [];
  const text = [t.subject, t.snippet, ...labels].join(' ').toLowerCase();
  if (t.receiptInfo) {
    if (ORDER.test(text)) return 'orders';
    if (/^travel$/i.test(t.receiptInfo.category ?? '') || TRAVEL.test(text)) return 'travel';
    return 'bills';
  }
  if (labels.some((l) => /^(newsletters?|promo|promotions|category_promotions|category_social|category_forums|editorial|digest)$/i.test(l.trim()))) return 'news';
  if (ctx.isGroup) return 'people';
  const automated = ctx.isUpdate || looksAutomated(ctx.senderEmail);
  if (!automated) return 'people';
  if (ALERT.test(text) || labels.some((l) => /^(alert|security)$/i.test(l.trim()))) return 'alerts';
  if (ORDER.test(text)) return 'orders';
  if (TRAVEL.test(text)) return 'travel';
  if (EVENT.test(text)) return 'events';
  if (BILL.test(text)) return 'bills';
  return ctx.isUpdate || looksBulk(ctx.senderEmail) ? 'news' : 'people';
}

/** The category of the chat's newest thread. A chat with no thread yet (a new sender) is people. senderEmail is the chat's one address for a one to one chat. */
export function chatCategory<T extends CategoryThread & { lastMessageAt: string }>(
  threads: T[],
  isUpdate: (t: T) => boolean,
  chat: { senderEmail?: string; isGroup?: boolean } = {},
): Category {
  let newest: T | undefined;
  for (const t of threads) if (!newest || new Date(t.lastMessageAt).getTime() >= new Date(newest.lastMessageAt).getTime()) newest = t;
  return newest ? threadCategory(newest, { isUpdate: isUpdate(newest), ...chat }) : 'people';
}
