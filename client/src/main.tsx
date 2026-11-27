import './lib/freshSample';
import './lib/demoClock';
import ReactDOM from 'react-dom/client';
import './styles/tokens.css';
import './styles/base.css';
import './screens/ChatsScreen.css';
import { App } from './App';
import { hasSnapshotKey, loadSnapshot } from './lib/snapshot';
import { isLiveMode, takeLiveFlag } from './lib/liveMode';
import { renewIfNeeded, takeSignInReturn, watchRenewal } from './lib/liveAuth';
import { startLiveSync } from './lib/liveRun';

// Live mode first: #live turns it on and is replaced at once, before anything reads the address
takeLiveFlag();

const root = ReactDOM.createRoot(document.getElementById('root')!);
const emptyTitle = (opensEmail: boolean) => (
  <div className="chatapp chatapp--list" aria-busy="true">
    {!opensEmail && (
      <section className="chatlist">
        <header className="chatlist__head">
          <h1 className="chatlist__title">Emails</h1>
        </header>
      </section>
    )}
  </div>
);

async function startLive(): Promise<void> {
  // The empty list title meanwhile, never the sample and never the saved copy
  root.render(emptyTitle(/^#\/chat\//.test(window.location.hash)));
  // A sign-in return is read before the router and before the saved copy's key
  await takeSignInReturn().catch(() => undefined);
  // A silent renewal leaves the page for Google, so there is nothing more to do here
  if (renewIfNeeded()) return;
  watchRenewal();
  root.render(<App />);
  startLiveSync();
}

if (isLiveMode()) {
  void startLive();
} else {
  // While the private copy downloads, draw the empty start screen with the real list's classes, so the title
  // sits where the real one lands. An address that opens one email gets only the empty background. Never sample mail.
  if (import.meta.env.VITE_STATIC_DEMO === 'true' && hasSnapshotKey()) {
    root.render(emptyTitle(/^#\/chat\//.test(window.location.hash)));
  }
  void loadSnapshot().catch(() => null).then(() => {
    root.render(<App />);
  });
}
