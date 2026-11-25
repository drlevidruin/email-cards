import React, { useEffect, useState } from 'react';
import {
  X,
  Sparkles,
  Shield,
  Database,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import type { AppSettings, ClaudeModelId, GmailAccount, ShabbosStatus } from '../../lib/types';
import { api, isStaticDemoMode } from '../../lib/api';
import { cn, formatClockTime } from '../../lib/utils';

interface SettingsModalProps {
  open: boolean;
  initialTab?: 'claude' | 'shabbos' | 'demo';
  onClose: () => void;
  settings: AppSettings | null;
  shabbosStatus: ShabbosStatus | null;
  accounts: GmailAccount[];
  onSettingsUpdated: () => Promise<void>;
  onToast: (message: string, tone?: 'default' | 'success' | 'warning') => void;
}

const CLAUDE_MODELS: { id: ClaudeModelId; label: string; desc: string }[] = [
  {
    id: 'claude-sonnet-4-20250514',
    label: 'Claude Sonnet 4',
    desc: 'Balanced reasoning, natural reply drafting, and fast triage',
  },
  {
    id: 'claude-opus-4-20250514',
    label: 'Claude Opus 4',
    desc: 'Deepest synthesis for long threads and multi-account questions',
  },
  {
    id: 'claude-3-5-haiku-20241022',
    label: 'Claude 3.5 Haiku',
    desc: 'Instant summaries, card distillation, and quick search',
  },
];

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Asia/Jerusalem',
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  initialTab = 'claude',
  onClose,
  settings,
  shabbosStatus,
  accounts,
  onSettingsUpdated,
  onToast,
}) => {
  const [tab, setTab] = useState<'claude' | 'shabbos' | 'demo'>(initialTab);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState<string>(settings?.claudeModel || 'claude-sonnet-4-20250514');
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [savingClaude, setSavingClaude] = useState(false);

  const [shabbosEnabled, setShabbosEnabled] = useState(Boolean(settings?.shabbosGuardEnabled));
  const [timezone, setTimezone] = useState(settings?.shabbosTimezone || 'America/New_York');
  const [savingShabbos, setSavingShabbos] = useState(false);

  const [busyData, setBusyData] = useState(false);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (settings) {
      setModel(settings.claudeModel || 'claude-sonnet-4-20250514');
      setShabbosEnabled(settings.shabbosGuardEnabled);
      setTimezone(settings.shabbosTimezone || 'America/New_York');
    }
  }, [settings]);

  if (!open) return null;

  const handleTestKey = async () => {
    if (!apiKey.trim()) {
      setTestResult({ ok: false, message: 'Paste an Anthropic API key above to test.' });
      return;
    }
    setTestingKey(true);
    setTestResult(null);
    try {
      const res = await api.testClaudeKey({ apiKey: apiKey.trim(), model });
      setTestResult({ ok: res.ok, message: res.message });
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Connection test failed',
      });
    } finally {
      setTestingKey(false);
    }
  };

  const handleSaveClaude = async () => {
    setSavingClaude(true);
    try {
      await api.updateSettings({
        ...(apiKey.trim() ? { anthropicApiKey: apiKey.trim() } : {}),
        claudeModel: model,
      });
      setApiKey('');
      await onSettingsUpdated();
      onToast('Claude AI settings saved', 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to save Claude settings', 'warning');
    } finally {
      setSavingClaude(false);
    }
  };

  const handleSaveShabbos = async () => {
    setSavingShabbos(true);
    try {
      await api.updateSettings({
        shabbosGuardEnabled: shabbosEnabled,
        shabbosTimezone: timezone,
      });
      await onSettingsUpdated();
      onToast('Shabbos & Yom Tov Guard updated', 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to save guard settings', 'warning');
    } finally {
      setSavingShabbos(false);
    }
  };

  const handleToggleDemo = async () => {
    setBusyData(true);
    try {
      await api.toggleDemo(!settings?.demoMode);
      await onSettingsUpdated();
      onToast(settings?.demoMode ? 'Switched to Live-Only mode' : 'Demo emails enabled', 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Could not toggle demo mode', 'warning');
    } finally {
      setBusyData(false);
    }
  };

  const handleResetDemo = async () => {
    setBusyData(true);
    try {
      await api.resetDemo();
      await onSettingsUpdated();
      onToast('Demo deck restored to a fresh state', 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Could not reset demo data', 'warning');
    } finally {
      setBusyData(false);
    }
  };

  const handleClearDemoAccounts = async () => {
    const demoAccounts = accounts.filter((a) => a.isDemo);
    if (demoAccounts.length === 0) {
      onToast('No demo accounts to hide');
      return;
    }
    setBusyData(true);
    try {
      await api.toggleDemo(false);
      await onSettingsUpdated();
      onToast('Demo accounts hidden for live-only inbox', 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to clear demo accounts', 'warning');
    } finally {
      setBusyData(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/25 backdrop-blur-[3px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[660px] max-h-[90vh] flex flex-col rounded-2xl overflow-hidden bg-white border border-gray-200"
        style={{ boxShadow: 'var(--shadow-modal)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-[19px] sm:text-[20px] font-bold tracking-tight text-gray-900">
            Email Cards Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-4 sm:px-6 pt-3 pb-2.5 border-b border-gray-200 bg-gray-50 flex items-center gap-1.5 sm:gap-2 overflow-x-auto">
          {[
            { id: 'claude' as const, label: 'Claude AI', icon: Sparkles },
            { id: 'shabbos' as const, label: 'Shabbos Guard', icon: Shield },
            { id: 'demo' as const, label: 'Demo & Data', icon: Database },
          ].map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  'px-3 sm:px-3.5 py-1.5 rounded-lg text-[12.5px] sm:text-[13px] font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap flex-shrink-0',
                  active
                    ? 'bg-white text-gray-900 border border-gray-200 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {isStaticDemoMode() && (
            <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-[13px] text-blue-900 leading-relaxed">
              <span className="font-semibold">Interactive Phone Demo:</span> all swipe, bookmark,
              snooze, draft, and Claude preview features work right in your browser. Run locally on
              Mac to connect live Gmail accounts and your Claude API key.
            </div>
          )}
          {tab === 'claude' && (
            <>
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[13.5px] font-semibold text-gray-900">
                    Anthropic API Status
                  </div>
                  <div className="text-[12.5px] text-gray-600 mt-0.5">
                    {settings?.anthropicApiKeyConfigured
                      ? `Live Claude key configured (${settings.anthropicApiKeyMasked || 'sk-ant-...'}).`
                      : 'Running in instant Local Mode. Paste your Anthropic API key to unlock live Claude drafting and search.'}
                  </div>
                </div>
                <span
                  className={cn(
                    'text-[11.5px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0',
                    settings?.anthropicApiKeyConfigured
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-blue-100 text-blue-800'
                  )}
                >
                  {settings?.anthropicApiKeyConfigured ? 'Live Claude' : 'Local Mode'}
                </span>
              </div>

              <div className="space-y-2">
                <label className="block text-[12.5px] font-semibold text-gray-700">
                  Anthropic API Key
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={
                      settings?.anthropicApiKeyConfigured
                        ? 'Enter new sk-ant-api03-... to replace saved key'
                        : 'sk-ant-api03-...'
                    }
                    className="flex-1 px-3.5 py-2 rounded-xl border border-gray-300 bg-white text-[13px] font-mono-num text-gray-900 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    disabled={testingKey}
                    onClick={() => void handleTestKey()}
                    className="px-3.5 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-[12.5px] font-semibold text-gray-800 flex items-center gap-1.5 flex-shrink-0"
                  >
                    {testingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Test Key
                  </button>
                </div>

                {testResult && (
                  <div
                    className={cn(
                      'p-3 rounded-xl border text-[12.5px] flex items-center gap-2',
                      testResult.ok
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border-rose-200 text-rose-700'
                    )}
                  >
                    {testResult.ok ? (
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                    )}
                    <span>{testResult.message}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-[12.5px] font-semibold text-gray-700">
                  Preferred Claude Model
                </label>
                <div className="space-y-2">
                  {CLAUDE_MODELS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setModel(m.id)}
                      className={cn(
                        'w-full p-3.5 rounded-xl border text-left transition-all flex items-center justify-between gap-3',
                        model === m.id
                          ? 'bg-blue-50/70 border-blue-400 ring-1 ring-blue-200'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      )}
                    >
                      <div>
                        <div className="text-[13.5px] font-semibold text-gray-900">{m.label}</div>
                        <div className="text-[12px] text-gray-600">{m.desc}</div>
                      </div>
                      <span className="font-mono-num text-[11px] text-gray-500 flex-shrink-0">
                        {m.id}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  disabled={savingClaude}
                  onClick={() => void handleSaveClaude()}
                  className="px-4 py-2.5 rounded-xl text-[13px] font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-2 disabled:opacity-50"
                >
                  {savingClaude && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Claude Settings
                </button>
              </div>
            </>
          )}

          {tab === 'shabbos' && (
            <>
              <div
                className={cn(
                  'p-4 rounded-2xl border space-y-3',
                  shabbosStatus?.isCurrentlyRestricted
                    ? 'bg-amber-50 border-amber-300'
                    : 'bg-gray-50 border-gray-200'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-600" />
                    <span className="text-[14px] font-semibold text-gray-900">
                      Outbound Shabbos & Yom Tov Guard
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShabbosEnabled(!shabbosEnabled)}
                    className={cn(
                      'w-10 h-[22px] rounded-full transition-colors relative flex items-center px-0.5',
                      shabbosEnabled ? 'bg-emerald-600' : 'bg-gray-300'
                    )}
                  >
                    <span
                      className={cn(
                        'w-4 h-4 rounded-full bg-white transition-transform shadow-sm',
                        shabbosEnabled ? 'translate-x-[20px]' : 'translate-x-0'
                      )}
                    />
                  </button>
                </div>
                <p className="text-[13px] leading-relaxed text-gray-600">
                  Automatically holds outbound emails and scheduled sends from Friday candle-lighting
                  through Saturday night Havdalah and major Yom Tov days, releasing cleanly afterward.
                </p>

                {shabbosStatus && (
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                        Current Status
                      </div>
                      <div
                        className={cn(
                          'text-[13px] font-semibold mt-0.5',
                          shabbosStatus.isCurrentlyRestricted ? 'text-amber-700' : 'text-emerald-700'
                        )}
                      >
                        {shabbosStatus.isCurrentlyRestricted
                          ? `Holding Outbound (${shabbosStatus.reason || 'Restricted Window'})`
                          : 'Clear to Send'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                        Next Hold Window
                      </div>
                      <div className="text-[12.5px] font-mono-num text-gray-800 mt-0.5">
                        {formatClockTime(shabbosStatus.nextWindowStart)} to{' '}
                        {formatClockTime(shabbosStatus.nextWindowEnd)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[12.5px] font-semibold text-gray-700 mb-1.5">
                  Local Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white text-[13.5px] text-gray-900 focus:outline-none focus:border-blue-500"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  disabled={savingShabbos}
                  onClick={() => void handleSaveShabbos()}
                  className="px-4 py-2.5 rounded-xl text-[13px] font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-2 disabled:opacity-50"
                >
                  {savingShabbos && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Guard Settings
                </button>
              </div>
            </>
          )}

          {tab === 'demo' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[14px] font-semibold text-gray-900">
                    Multi-Account Demo Deck
                  </div>
                  <div className="text-[12.5px] text-gray-600 mt-0.5">
                    Includes 3 sample Gmail accounts (Studio, Personal, Ventures) with priority cards,
                    first-time senders, receipts, and commitments.
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busyData}
                  onClick={() => void handleToggleDemo()}
                  className="px-3.5 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-[12.5px] font-semibold text-gray-800 flex-shrink-0"
                >
                  {settings?.demoMode ? 'Disable Demo Mode' : 'Enable Demo Mode'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={busyData}
                  onClick={() => void handleResetDemo()}
                  className="p-4 rounded-2xl bg-white border border-gray-200 text-left hover:bg-gray-50 transition-colors space-y-1 shadow-sm"
                >
                  <div className="flex items-center gap-2 text-[13.5px] font-semibold text-gray-900">
                    <RotateCcw className="w-4 h-4 text-blue-600" />
                    Reset Demo Cards
                  </div>
                  <div className="text-[12px] text-gray-500">
                    Restores all sample cards, screener senders, and promises to a clean deck.
                  </div>
                </button>

                <button
                  type="button"
                  disabled={busyData}
                  onClick={() => void handleClearDemoAccounts()}
                  className="p-4 rounded-2xl bg-white border border-gray-200 text-left hover:bg-rose-50/60 hover:border-rose-200 transition-colors space-y-1 shadow-sm"
                >
                  <div className="flex items-center gap-2 text-[13.5px] font-semibold text-rose-600">
                    <Trash2 className="w-4 h-4" />
                    Use Live Accounts Only
                  </div>
                  <div className="text-[12px] text-gray-500">
                    Hides sample accounts so Email Cards shows only your real connected Gmail inboxes.
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
