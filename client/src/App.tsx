import { useEffect, useState } from 'react';
import { navigate, useRoute } from './router';
import { StoreProvider } from './store';
import { isStackId, type StackId } from './lib/stacks';
import { DesktopShell } from './components/DesktopShell';
import { ShortcutsDialog } from './components/ShortcutsDialog';
import { Toast } from './components/Toast';
import { Welcome } from './components/Welcome';
import { useGlobalKeys } from './components/useGlobalKeys';
import { useIsDesktop } from './lib/useIsDesktop';
import { useWelcome } from './lib/welcome';
import { AllMailScreen } from './screens/AllMailScreen';
import { AskScreen } from './screens/AskScreen';
import { ChatsScreen } from './screens/ChatsScreen';
import { CardsScreen } from './screens/CardsScreen';
import { DraftsScreen } from './screens/DraftsScreen';
import { GoalsScreen } from './screens/GoalsScreen';
import { HowScreen } from './screens/HowScreen';
import { NewEmailScreen } from './screens/NewEmailScreen';
import { ReadScreen } from './screens/ReadScreen';
import { ReplyScreen } from './screens/ReplyScreen';
import { SettingsScreen } from './screens/SettingsScreen';

const PAGES: Record<string, () => JSX.Element> = {
  goals: GoalsScreen,
  drafts: DraftsScreen,
  ask: AskScreen,
  how: HowScreen,
  new: NewEmailScreen,
  settings: SettingsScreen,
};

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s).toLowerCase();
  } catch {
    return s.toLowerCase();
  }
}

function Routes() {
  const { segments, query } = useRoute();
  const [head, arg] = segments;
  const known =
    (head === 'cards' && isStackId(arg)) ||
    ((head === 'reply' || head === 'read') && !!arg) ||
    head === 'all' ||
    head === 'chats' ||
    (head === 'chat' && !!arg) ||
    (!!head && Object.hasOwn(PAGES, head) && !arg);

  useEffect(() => {
    if (!known) navigate('/chats', { replace: true });
  }, [known]);

  if (!known) return null;
  if (head === 'chats' || head === 'chat') return <ChatsScreen activeKey={head === 'chat' ? safeDecode(arg) : undefined} archivedView={head === 'chats' && arg === 'archived'} />;
  // A reader opened from a deck keeps that deck on screen under it
  const under = head === 'cards' ? arg : head === 'read' ? query.get('from') : null;
  const Page = head && head !== 'cards' && head !== 'reply' && head !== 'read' && head !== 'all' ? PAGES[head] : null;
  return (
    <>
      {head === 'read' && under === 'goals' && <GoalsScreen />}
      {isStackId(under ?? undefined) && <CardsScreen stack={under as StackId} covered={head === 'read'} />}
      {head === 'reply' && <ReplyScreen threadId={arg} />}
      {head === 'read' && <ReadScreen threadId={arg} />}
      {head === 'all' && <AllMailScreen />}
      {Page && <Page />}
    </>
  );
}

/** The keys that work on every screen, on a phone with a keyboard as well as a laptop. */
function GlobalKeys() {
  const { segments } = useRoute();
  const [shortcuts, setShortcuts] = useState(false);
  // The composers own the keyboard
  useGlobalKeys({ onShortcuts: () => setShortcuts((s) => !s), off: segments[0] === 'reply' || segments[0] === 'new' || segments[0] === 'chat' || segments[0] === 'chats' });
  return shortcuts ? <ShortcutsDialog onClose={() => setShortcuts(false)} /> : null;
}

function Frame() {
  const desktop = useIsDesktop();
  const { segments } = useRoute();
  // The chat screens carry their own two panes: no rail or side panel around them
  const chat = segments[0] === 'chats' || segments[0] === 'chat';
  return desktop && !chat ? (
    <DesktopShell>
      <Routes />
    </DesktopShell>
  ) : (
    <Routes />
  );
}

/** The app, and over it the welcome. While the welcome is up the app behind it takes no taps, keys or focus. */
function Shell() {
  const { up } = useWelcome();
  return (
    <>
      <div style={{ display: 'contents' }} {...(up ? { inert: '' as unknown as boolean } : {})}>
        <Frame />
        <GlobalKeys />
        <Toast />
      </div>
      <Welcome />
    </>
  );
}

export function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
