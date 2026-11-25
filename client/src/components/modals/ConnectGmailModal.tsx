import React, { useEffect, useState } from 'react';
import {
  X,
  Mail,
  KeyRound,
  ShieldCheck,
  ExternalLink,
  RefreshCw,
  Trash2,
  Check,
  Loader2,
  AlertCircle,
  Sparkles,
  Pencil,
} from 'lucide-react';
import type { AppSettings, GmailAccount } from '../../lib/types';
import { api, isStaticDemoMode } from '../../lib/api';
import { cn, formatRelativeTime } from '../../lib/utils';

interface ConnectGmailModalProps {
  open: boolean;
  onClose: () => void;
  accounts: GmailAccount[];
  settings: AppSettings | null;
  onAccountsChanged: () => Promise<void>;
  onToast: (message: string, tone?: 'default' | 'success' | 'warning') => void;
}

const JEWEL_COLORS = [
  { name: 'Blue', hex: '#2563EB' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Amber', hex: '#D97706' },
  { name: 'Indigo', hex: '#4F46E5' },
  { name: 'Rose', hex: '#E11D48' },
  { name: 'Teal', hex: '#0D9488' },
];

export const ConnectGmailModal: React.FC<ConnectGmailModalProps> = ({
  open,
  onClose,
  accounts,
  settings,
  onAccountsChanged,
  onToast,
}) => {
  const [tab, setTab] = useState<'imap' | 'oauth'>('imap');

  // IMAP App Password form
  const [email, setEmail] = useState('');
  const [label, setLabel] = useState('');
  const [color, setColor] = useState(JEWEL_COLORS[0].hex);
  const [appPassword, setAppPassword] = useState('');
  const [imapLoading, setImapLoading] = useState(false);
  const [imapError, setImapError] = useState<string | null>(null);

  // OAuth2 form
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [savingOAuth, setSavingOAuth] = useState(false);
  const [oauthStarting, setOauthStarting] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  // Account management state
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editColor, setEditColor] = useState('#2563EB');

  useEffect(() => {
    if (!open) return;
    const onMessage = (event: MessageEvent) => {
      if (
        event.data &&
        typeof event.data === 'object' &&
        event.data.type === 'prism-google-oauth-success'
      ) {
        void onAccountsChanged();
        onToast('Gmail account connected via Google OAuth2', 'success');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [open, onAccountsChanged, onToast]);

  if (!open) return null;

  const handleConnectImap = async (e: React.FormEvent) => {
    e.preventDefault();
    setImapError(null);
    if (!email.trim() || !appPassword.trim()) {
      setImapError('Please enter both your Gmail address and 16-character App Password.');
      return;
    }
    setImapLoading(true);
    try {
      const derivedLabel = label.trim() || email.trim().split('@')[0];
      const res = await api.connectImapAccount({
        email: email.trim(),
        appPassword: appPassword.replace(/\s+/g, ''),
        label: derivedLabel,
        color,
      });
      await onAccountsChanged();
      setEmail('');
      setLabel('');
      setAppPassword('');
      onToast(
        `Connected ${res.account.email}${res.syncedCount ? ` (${res.syncedCount} emails synced)` : ''}`,
        'success'
      );
    } catch (err) {
      setImapError(err instanceof Error ? err.message : 'Failed to connect Gmail via IMAP');
    } finally {
      setImapLoading(false);
    }
  };

  const handleSaveOAuthCreds = async (e: React.FormEvent) => {
    e.preventDefault();
    setOauthError(null);
    if (!clientId.trim() || !clientSecret.trim()) {
      setOauthError('Enter both Google Client ID and Client Secret.');
      return;
    }
    setSavingOAuth(true);
    try {
      await api.updateSettings({
        googleClientId: clientId.trim(),
        googleClientSecret: clientSecret.trim(),
      });
      await onAccountsChanged();
      setClientId('');
      setClientSecret('');
      onToast('Google OAuth2 credentials saved', 'success');
    } catch (err) {
      setOauthError(err instanceof Error ? err.message : 'Could not save Google OAuth2 credentials');
    } finally {
      setSavingOAuth(false);
    }
  };

  const handleLaunchGoogleOAuth = async () => {
    setOauthError(null);
    setOauthStarting(true);
    try {
      const res = await api.getGoogleAuthUrl();
      if (!res.url) {
        setOauthError(res.error || 'Configure Google Client ID and Secret first.');
        return;
      }
      window.open(res.url, 'email-cards-google-oauth', 'width=540,height=680,menubar=no,toolbar=no');
    } catch (err) {
      setOauthError(err instanceof Error ? err.message : 'Could not start Google OAuth flow');
    } finally {
      setOauthStarting(false);
    }
  };

  const handleSyncAccount = async (id: string) => {
    setSyncingId(id);
    try {
      const res = await api.syncAccount(id);
      await onAccountsChanged();
      onToast(
        `Synced account${res.syncedCount !== undefined ? ` (${res.syncedCount} emails)` : ''}`,
        'success'
      );
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Sync failed', 'warning');
    } finally {
      setSyncingId(null);
    }
  };

  const handleDeleteAccount = async (acc: GmailAccount) => {
    try {
      await api.deleteAccount(acc.id);
      await onAccountsChanged();
      onToast(`Disconnected ${acc.email}`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Could not disconnect account', 'warning');
    }
  };

  const handleSaveEdit = async (id: string) => {
    try {
      await api.updateAccount(id, { label: editLabel.trim() || undefined, color: editColor });
      setEditingId(null);
      await onAccountsChanged();
      onToast('Account label and color updated', 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Update failed', 'warning');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/25 backdrop-blur-[3px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[760px] max-h-[90vh] flex flex-col rounded-2xl overflow-hidden bg-white border border-gray-200"
        style={{ boxShadow: 'var(--shadow-modal)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-[19px] sm:text-[20px] font-bold tracking-tight text-gray-900">
              Connect Gmail Accounts
            </h2>
            <p className="text-[12.5px] sm:text-[13px] text-gray-500 mt-0.5">
              Combine personal and work Gmail accounts into one calm card deck.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6">
          {isStaticDemoMode() && (
            <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-[13px] text-blue-900 leading-relaxed">
              <span className="font-semibold">Interactive Phone Demo:</span> all swipe, bookmark,
              snooze, draft, and Claude preview features work right in your browser. Run locally on
              Mac to connect live Gmail accounts and your Claude API key.
            </div>
          )}

          {/* Tabs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-1 rounded-xl bg-gray-100 border border-gray-200">
            <button
              type="button"
              onClick={() => setTab('imap')}
              className={cn(
                'py-2 px-3 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-2 transition-all',
                tab === 'imap'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <KeyRound className="w-3.5 h-3.5 text-blue-600" />
              Quick Connect (App Password, 30 sec)
            </button>
            <button
              type="button"
              onClick={() => setTab('oauth')}
              className={cn(
                'py-2 px-3 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-2 transition-all',
                tab === 'oauth'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Google OAuth2 (Full Gmail API)
            </button>
          </div>

          {tab === 'imap' ? (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
              <form onSubmit={(e) => void handleConnectImap(e)} className="md:col-span-3 space-y-3.5">
                <div>
                  <label className="block text-[12px] font-semibold text-gray-700 mb-1">
                    Gmail Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@gmail.com or workspace@company.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white text-[13.5px] text-gray-900 focus:outline-none focus:border-blue-500 placeholder:text-gray-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-semibold text-gray-700 mb-1">
                      Account Label
                    </label>
                    <input
                      type="text"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder="Work, Personal, Studio"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white text-[13.5px] text-gray-900 focus:outline-none focus:border-blue-500 placeholder:text-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-gray-700 mb-1">
                      Color Tag
                    </label>
                    <div className="flex items-center gap-2 h-[42px]">
                      {JEWEL_COLORS.map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setColor(c.hex)}
                          title={c.name}
                          className={cn(
                            'w-6 h-6 rounded-full transition-transform flex items-center justify-center',
                            color === c.hex
                              ? 'scale-110 ring-2 ring-offset-2 ring-gray-900'
                              : 'opacity-80 hover:opacity-100'
                          )}
                          style={{ backgroundColor: c.hex }}
                        >
                          {color === c.hex && <Check className="w-3.5 h-3.5 text-white" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-gray-700 mb-1">
                    16-Character Google App Password
                  </label>
                  <input
                    type="password"
                    required
                    value={appPassword}
                    onChange={(e) => setAppPassword(e.target.value)}
                    placeholder="xxxx xxxx xxxx xxxx"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white text-[13.5px] font-mono-num text-gray-900 focus:outline-none focus:border-blue-500 placeholder:text-gray-400"
                  />
                </div>

                {imapError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-[12.5px] text-rose-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
                    <span>{imapError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={imapLoading}
                  className="w-full py-2.5 px-4 rounded-xl text-[13.5px] font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {imapLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verifying IMAP & Syncing...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      Connect Gmail Account
                    </>
                  )}
                </button>
              </form>

              <div className="md:col-span-2 p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-3">
                <div className="text-[13px] font-semibold text-gray-900">
                  30-Second App Password Guide
                </div>
                <ol className="space-y-2.5 text-[12.5px] leading-relaxed text-gray-600 list-decimal list-inside">
                  <li>Confirm 2-Step Verification is on for your Google Account.</li>
                  <li>
                    Open{' '}
                    <a
                      href="https://myaccount.google.com/apppasswords"
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline font-medium inline-flex items-center gap-0.5"
                    >
                      Google App Passwords
                      <ExternalLink className="w-3 h-3" />
                    </a>{' '}
                    and create a code named &quot;Email Cards&quot;.
                  </li>
                  <li>Paste the 16-character code here. Stored locally on your Mac only.</li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-semibold text-gray-900">
                      Google Cloud OAuth2 Status
                    </span>
                    <span
                      className={cn(
                        'text-[11px] px-2 py-0.5 rounded-full font-semibold',
                        settings?.googleOAuthConfigured
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      )}
                    >
                      {settings?.googleOAuthConfigured ? 'Configured' : 'Needs Client ID'}
                    </span>
                  </div>
                  <p className="text-[12.5px] text-gray-600 mt-1">
                    {settings?.googleOAuthConfigured
                      ? `Client ID ${settings.googleClientIdMasked || 'saved'}. Click Sign in with Google to connect any Gmail account.`
                      : 'Add your Google OAuth Client ID and Secret once, with redirect URI http://localhost:3456/api/auth/google/callback.'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!settings?.googleOAuthConfigured || oauthStarting}
                  onClick={() => void handleLaunchGoogleOAuth()}
                  className="px-4 py-2.5 rounded-xl text-[13px] font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-45 flex items-center gap-2 flex-shrink-0 shadow-sm transition-colors"
                >
                  {oauthStarting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  Sign in with Google
                </button>
              </div>

              <form onSubmit={(e) => void handleSaveOAuthCreds(e)} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-gray-700 mb-1">
                    Google OAuth Client ID
                  </label>
                  <input
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="xxxxx.apps.googleusercontent.com"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-[13px] font-mono-num text-gray-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-gray-700 mb-1">
                    Google OAuth Client Secret
                  </label>
                  <input
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="GOCSPX-..."
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-[13px] font-mono-num text-gray-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
                {oauthError && (
                  <div className="sm:col-span-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-[12.5px] text-rose-700">
                    {oauthError}
                  </div>
                )}
                <div className="sm:col-span-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingOAuth || !clientId.trim() || !clientSecret.trim()}
                    className="px-4 py-2 rounded-xl text-[13px] font-semibold border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 disabled:opacity-45 transition-colors"
                  >
                    {savingOAuth ? 'Saving...' : 'Save OAuth Credentials'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Connected Accounts List */}
          <div className="space-y-3 pt-4 border-t border-gray-200">
            <div className="text-[11.5px] font-semibold uppercase tracking-wider text-gray-500">
              Connected Accounts ({accounts.length})
            </div>

            <div className="space-y-2">
              {accounts.map((acc) => {
                const isEditing = editingId === acc.id;
                return (
                  <div
                    key={acc.id}
                    className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: isEditing ? editColor : acc.color }}
                      />
                      {isEditing ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            className="px-2.5 py-1 rounded-lg border border-gray-300 bg-white text-[13px] text-gray-900 w-32"
                          />
                          <div className="flex items-center gap-1.5">
                            {JEWEL_COLORS.map((c) => (
                              <button
                                key={c.hex}
                                type="button"
                                onClick={() => setEditColor(c.hex)}
                                className={cn(
                                  'w-4 h-4 rounded-full',
                                  editColor === c.hex ? 'ring-2 ring-offset-1 ring-gray-900' : 'opacity-70'
                                )}
                                style={{ backgroundColor: c.hex }}
                              />
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleSaveEdit(acc.id)}
                            className="px-2.5 py-1 rounded-lg text-[12px] font-semibold bg-blue-600 text-white"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="px-2 py-1 text-[12px] text-gray-500"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13.5px] font-semibold text-gray-900 truncate">
                              {acc.label}
                            </span>
                            <span className="text-[10.5px] font-mono-num uppercase px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600">
                              {acc.provider === 'demo'
                                ? 'Demo'
                                : acc.provider === 'gmail_oauth'
                                  ? 'OAuth2'
                                  : 'IMAP'}
                            </span>
                          </div>
                          <div className="text-[12px] text-gray-500 truncate">
                            {acc.email}
                            {acc.lastSyncedAt ? ` | Synced ${formatRelativeTime(acc.lastSyncedAt)}` : ''}
                          </div>
                        </div>
                      )}
                    </div>

                    {!isEditing && (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(acc.id);
                            setEditLabel(acc.label);
                            setEditColor(acc.color);
                          }}
                          className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-600 transition-colors"
                          title="Edit label and color"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={syncingId === acc.id}
                          onClick={() => void handleSyncAccount(acc.id)}
                          className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-[12px] font-medium text-gray-800 flex items-center gap-1.5 transition-colors"
                        >
                          <RefreshCw className={cn('w-3.5 h-3.5', syncingId === acc.id && 'animate-spin')} />
                          Sync
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteAccount(acc)}
                          className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-gray-500 transition-colors"
                          title="Disconnect account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
