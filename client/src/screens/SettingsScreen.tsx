import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import pkg from '../../package.json';
import { api, isStaticDemoMode } from '../lib/api';
import { setStreakOn, useStreakOn } from '../lib/prefs';
import { resetChatPrefs } from '../lib/chatPrefs';
import { resetChatDrafts } from '../lib/chatDraft';
import { forgetSnapshot, isSnapshot, snapshotLabel } from '../lib/snapshot';
import { isLiveMode } from '../lib/liveMode';
import { connectAccount, disconnect, signInAgain, useLiveAccounts } from '../lib/liveAuth';
import { syncNow } from '../lib/liveRun';
import { resetProgress } from '../lib/progress';
import { revokeLivePictures } from '../lib/pictures';
import { navigate } from '../router';
import { useStore } from '../store';
import { NOT_SAVED } from '../storeActions';
import { PageShell } from '../components/PageShell';
import { Sheet } from '../components/Sheet';
import '../components/List.css';
import './SettingsScreen.css';

const ZONES: [string, string][] = [
  ['America/New_York', 'New York'],
  ['America/Chicago', 'Chicago'],
  ['America/Denver', 'Denver'],
  ['America/Los_Angeles', 'Los Angeles'],
  ['Asia/Jerusalem', 'Jerusalem'],
  ['Europe/London', 'London'],
];

export function SettingsScreen() {
  const store = useStore();
  const { data } = store;
  const streak = useStreakOn();
  const [privacy, setPrivacy] = useState(false);
  const liveMode = isLiveMode();
  const liveAccounts = useLiveAccounts();
  if (!data) return <PageShell title="Settings" canvas />;
  const { settings, shabbosStatus } = data;

  const update = async (patch: { shabbosGuardEnabled?: boolean; shabbosTimezone?: string }) => {
    const prev = data;
    store.patchData((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
    try {
      await api.updateSettings(patch);
      await store.refresh();
    } catch {
      store.patchData(() => prev);
      store.showToast(NOT_SAVED);
    }
  };

  const reset = async () => {
    try {
      await api.resetDemo();
      store.resetSessions();
      resetChatPrefs();
      resetChatDrafts();
      // Live mail: the saved mail, settings and progress go; the accounts and sign-ins stay, and the mail is read again
      if (liveMode) {
        resetProgress();
        revokeLivePictures();
      }
      await store.reload();
      store.showToast(liveMode ? 'Reset' : isSnapshot() ? 'Snapshot reset' : 'Sample inbox reset');
      navigate('/chats');
      if (liveMode) void syncNow();
    } catch {
      store.showToast(NOT_SAVED);
    }
  };

  const removeSnapshot = () => {
    forgetSnapshot();
    window.location.hash = '#/';
    window.location.reload();
  };

  return (
    <PageShell title="Settings" canvas>
      <div className="settings">
        <h2 className="list-heading">Accounts</h2>
        {liveMode ? (
          <ul className="list">
            {liveAccounts.map((a) => (
              <li key={a.email} className="list__row settings__row">
                <span className="settings__label settings__grow">{a.email}</span>
                {a.state === 'signin' && (
                  <button className="btn btn--secondary btn--small" onClick={() => signInAgain(a.email)}>
                    Sign in
                  </button>
                )}
              </li>
            ))}
            <li>
              <button className="list__row settings__row" onClick={connectAccount}>
                <span className="settings__label">Add account</span>
              </button>
            </li>
            <li>
              <button className="list__row settings__row" onClick={disconnect}>
                <span className="settings__label">Disconnect</span>
              </button>
            </li>
          </ul>
        ) : (
          <ul className="list">
            {data.accounts.map((a) => (
              <li key={a.id} className="list__row settings__row">
                <span className="settings__dot" style={{ background: a.color }} />
                <span className="settings__label settings__grow">{a.label}</span>
                <span className="settings__value t-subhead">{a.email}</span>
              </li>
            ))}
          </ul>
        )}
        <h2 className="list-heading">Display</h2>
        <ul className="list">
          <li className="list__row settings__row">
            <span className="settings__label" id="streak-label">Show your week</span>
            <button
              className={`switch${streak ? ' is-on' : ''}`}
              role="switch"
              aria-checked={streak}
              aria-labelledby="streak-label"
              onClick={() => setStreakOn(!streak)}
            >
              <span className="switch__knob" />
            </button>
          </li>
        </ul>
        {!liveMode && (
          <>
        <h2 className="list-heading">Shabbos and Yom Tov</h2>
        <ul className="list">
          <li className="list__row settings__row">
            <span className="settings__label" id="hold-label">Hold outgoing mail</span>
            <button
              className={`switch${settings.shabbosGuardEnabled ? ' is-on' : ''}`}
              role="switch"
              aria-checked={settings.shabbosGuardEnabled}
              aria-labelledby="hold-label"
              onClick={() => void update({ shabbosGuardEnabled: !settings.shabbosGuardEnabled })}
            >
              <span className="switch__knob" />
            </button>
          </li>
          <li className="list__row settings__row">
            <label className="settings__label" htmlFor="zone">Time zone</label>
            <select id="zone" className="settings__select" value={settings.shabbosTimezone} onChange={(e) => void update({ shabbosTimezone: e.target.value })}>
              {ZONES.map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </li>
          {shabbosStatus.heldCount > 0 && (
            <li className="list__row settings__row">
              <span className="settings__label">Held now</span>
              <span className="settings__value">{shabbosStatus.heldCount}</span>
            </li>
          )}
        </ul>
          </>
        )}
        {isStaticDemoMode() && !liveMode && (
          <>
            <h2 className="list-heading">Privacy</h2>
            <ul className="list">
              <li>
                <button className="list__row settings__row" onClick={() => setPrivacy(true)}>
                  <span className="settings__label">Your data</span>
                  <ChevronRight size={18} strokeWidth={1.75} className="settings__chev" />
                </button>
              </li>
            </ul>
          </>
        )}
        {liveMode && (
          <>
            <h2 className="list-heading">Saved mail</h2>
            <ul className="list">
              <li className="list__row settings__row">
                <span className="settings__label">On this device</span>
                <button className="btn btn--secondary btn--small" onClick={() => void reset()}>
                  Reset
                </button>
              </li>
            </ul>
          </>
        )}
        {!liveMode && (settings.demoMode || isStaticDemoMode()) && (
          <>
            <h2 className="list-heading">Demo</h2>
            <ul className="list">
              <li className="list__row settings__row">
                <span className="settings__label">{snapshotLabel() ?? 'Demo data'}</span>
                <button className="btn btn--secondary btn--small" onClick={() => void reset()}>
                  Reset
                </button>
              </li>
              {isSnapshot() && (
                <li className="list__row settings__row">
                  <span className="settings__label">Saved on this device</span>
                  <button className="btn btn--secondary btn--small" onClick={removeSnapshot}>
                    Remove
                  </button>
                </li>
              )}
            </ul>
          </>
        )}
        <h2 className="list-heading">About</h2>
        <ul className="list">
          <li className="list__row settings__row">
            <span className="settings__label">Version</span>
            <span className="settings__value">{pkg.version}</span>
          </li>
        </ul>
      </div>
      {isStaticDemoMode() && !liveMode && privacy && (
        <Sheet title="Privacy" onClose={() => setPrivacy(false)} dialog>
          <p className="t-subhead settings__privacy">This demo runs in your browser. Your mail stays on your device and is never used to train models.</p>
        </Sheet>
      )}
    </PageShell>
  );
}
