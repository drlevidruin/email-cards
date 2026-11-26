import { api, isStaticDemoMode } from '../lib/api';
import { navigate } from '../router';
import { useStore } from '../store';
import { NOT_SAVED } from '../storeActions';
import { PageShell } from '../components/PageShell';
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
      await store.reload();
      store.showToast('Demo reset');
      navigate('/cards/needs-you');
    } catch {
      store.showToast(NOT_SAVED);
    }
  };

  return (
    <PageShell title="Settings" canvas>
      <div className="settings">
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
        {(settings.demoMode || isStaticDemoMode()) && (
          <>
            <h2 className="list-heading">Demo</h2>
            <ul className="list">
              <li className="list__row settings__row">
                <span className="settings__label">Demo data</span>
                <button className="btn btn--secondary btn--small" onClick={() => void reset()}>
                  Reset
                </button>
              </li>
            </ul>
          </>
        )}
      </div>
    </PageShell>
  );
}
