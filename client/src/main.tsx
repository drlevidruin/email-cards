import './lib/freshSample';
import './lib/demoClock';
import ReactDOM from 'react-dom/client';
import './styles/tokens.css';
import './styles/base.css';
import './screens/ChatsScreen.css';
import { App } from './App';
import { hasSnapshotKey, loadSnapshot } from './lib/snapshot';

const root = ReactDOM.createRoot(document.getElementById('root')!);
// While the private copy downloads, draw the empty start screen with the real list's classes, so the title
// sits where the real one lands. An address that opens one email gets only the empty background. Never sample mail.
if (import.meta.env.VITE_STATIC_DEMO === 'true' && hasSnapshotKey()) {
  const opensEmail = /^#\/chat\//.test(window.location.hash);
  root.render(
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
}
void loadSnapshot().catch(() => null).then(() => {
  root.render(<App />);
});
