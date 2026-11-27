import { useEffect, useRef } from 'react';
import { navigate } from '../router';
import { markStart } from '../lib/progress';
import { markWelcomed } from '../lib/onboarding';
import { useIsDesktop } from '../lib/useIsDesktop';
import { setWelcomeLeaving, setWelcomePrimary, useWelcome } from '../lib/welcome';
import { useStore } from '../store';
import { useBrandChrome } from './useBrandChrome';
import { WelcomePicture } from './WelcomePicture';
import './Welcome.css';

const LEAVE_MS = 440;

/** The first screen: one line on what this is, a picture of the four moves, and one button. */
export function Welcome() {
  const { mode, up } = useWelcome();
  const store = useStore();
  const desktop = useIsDesktop();
  const timer = useRef(0);
  useBrandChrome(up);
  // The green the page boots with has done its job once this layer is mounted
  useEffect(() => document.documentElement.classList.remove('boot-welcome'), []);

  const press = () => {
    if (!mode) return;
    window.clearTimeout(timer.current);
    setWelcomeLeaving(true);
    // Land on the chat list, with the deck state still started, under the layer as it lifts
    markWelcomed();
    navigate('/chats', { replace: true });
    store.session('needs-you').todayDone = true;
    markStart('needs-you');
    store.touch();
    timer.current = window.setTimeout(() => setWelcomeLeaving(false), LEAVE_MS + 20);
  };
  const pressRef = useRef(press);
  pressRef.current = press;
  useEffect(() => {
    setWelcomePrimary(() => pressRef.current());
    return () => setWelcomePrimary(null);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (!up) return null;
  const leaving = !mode;
  return (
    <div className={`welcome${leaving ? ' is-leaving' : ''}`} role="dialog" aria-modal="true" aria-label="How Email Cards works">
      <div className="welcome__inner">
        <div className="welcome__text">
          <div className="welcome__brand">
            <img src={`${import.meta.env.BASE_URL}icon-192.png`} width={28} height={28} alt="" />
            <span>Email Cards</span>
          </div>
          <h1 className="voice welcome__title">
            <span className="welcome__line">Clear your inbox,</span> <span className="welcome__line">one email at a time.</span>
          </h1>
          <p className="welcome__lede">
            Each email becomes a card that says what it wants from you.{' '}
            {desktop
              ? 'Answer with a click, save it for later, or clear it with an arrow key.'
              : 'Answer with a tap, save it for later, or swipe it away.'}
          </p>
        </div>
        <div className="welcome__art">
          <WelcomePicture />
        </div>
        <div className="welcome__act">
          <button className="welcome__button" onClick={press}>
            Try the sample inbox
          </button>
          <p className="welcome__note">This demo uses a made-up inbox. It can't see your email, and nothing gets sent.</p>
        </div>
      </div>
    </div>
  );
}
