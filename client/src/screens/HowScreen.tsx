import { useEffect } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, type LucideIcon } from 'lucide-react';
import { goBack } from '../router';
import { PLACES } from '../lib/navHints';
import { isSampleInbox } from '../lib/sample';
import { useIsDesktop } from '../lib/useIsDesktop';
import { useBrandChrome } from '../components/useBrandChrome';
import './HowScreen.css';

const MOVES: { word: string; says: string; Icon: LucideIcon }[] = [
  { word: 'Done', says: 'It leaves your inbox and stays in All mail.', Icon: ArrowRight },
  { word: 'Later', says: 'It comes back when you choose.', Icon: ArrowLeft },
  { word: 'To-do', says: 'It waits on your To-do list until you finish it.', Icon: ArrowUp },
  { word: 'Skip', says: 'It goes to the back of the pile. Nothing else changes.', Icon: ArrowDown },
];

/** The help page: what the four moves do, how replies work, and what each place in the menu holds. On the green field, like the welcome. */
export function HowScreen() {
  const desktop = useIsDesktop();
  useBrandChrome(true);
  useEffect(() => {
    // Caught before the sheet's own handler runs: a dialog open over this page takes Escape alone
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[aria-modal="true"]')) goBack();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  const tap = desktop ? 'Click' : 'Tap';
  return (
    <main className="how" aria-label="How it works">
      <div className="how__inner">
        <div className="how__a">
          <h1 className="voice how__title">How it works</h1>
          <p className="how__lede">Every email becomes a card. The big line says what it wants from you.</p>
          <ul className="how__moves">
            {MOVES.map(({ word, says, Icon }) => (
              <li key={word} className="how__move">
                <Icon className="how__arrow" size={20} strokeWidth={1.75} aria-hidden="true" />
                <span className="how__move-text">
                  <span className="voice how__word">{word}</span>
                  <span className="how__says">{says}</span>
                </span>
                {desktop && (
                  <kbd className="how__cap" aria-hidden="true">
                    <Icon size={14} strokeWidth={2} />
                  </kbd>
                )}
              </li>
            ))}
          </ul>
          <div className="how__lines">
            <p>{`${tap} an answer on a card to reply. You see the reply first, and nothing is sent until you press Send.`}</p>
            <p>{`${tap} a card to read the whole email.`}</p>
            <p>Every move can be undone from the notice that follows it.</p>
          </div>
        </div>
        <div className="how__b">
          <h2 className="voice how__h2">Where things are</h2>
          <ul className="how__places">
            {PLACES.map((p) => (
              <li key={p.key}>
                <span className="how__place">{p.label}</span>
                <span className="how__says">{p.line}</span>
              </li>
            ))}
          </ul>
          {isSampleInbox() && <p className="how__sample">This demo uses a made-up inbox. It can't see your email, and nothing gets sent.</p>}
        </div>
        <div className="how__act">
          <button className="how__button" onClick={goBack}>
            Got it
          </button>
        </div>
      </div>
    </main>
  );
}
