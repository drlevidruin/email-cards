import { useEffect, useState } from 'react';
import { navigate, useRoute } from './router';
import { StoreProvider } from './store';
import { isStackId, type StackId } from './lib/stacks';
import { DesktopShell } from './components/DesktopShell';
import { ShortcutsDialog } from './components/ShortcutsDialog';
import { Toast } from './components/Toast';
import { useGlobalKeys } from './components/useGlobalKeys';
import { useIsDesktop } from './lib/useIsDesktop';
import { AllMailScreen } from './screens/AllMailScreen';
import { AskScreen } from './screens/AskScreen';
import { CardsScreen } from './screens/CardsScreen';
import { DraftsScreen } from './screens/DraftsScreen';
import { GoalsScreen } from './screens/GoalsScreen';
import { NewEmailScreen } from './screens/NewEmailScreen';
import { ReadScreen } from './screens/ReadScreen';
import { ReplyScreen } from './screens/ReplyScreen';
import { SettingsScreen } from './screens/SettingsScreen';

const PAGES: Record<string, () => JSX.Element> = {
  goals: GoalsScreen,
  drafts: DraftsScreen,
  ask: AskScreen,
  new: NewEmailScreen,
  settings: SettingsScreen,
};

function Routes() {
  const { segments, query } = useRoute();
  const [head, arg] = segments;
  const known =
    (head === 'cards' && isStackId(arg)) ||
    ((head === 'reply' || head === 'read') && !!arg) ||
    head === 'all' ||
    (!!head && Object.hasOwn(PAGES, head) && !arg);

  useEffect(() => {
    if (!known) navigate('/cards/needs-you', { replace: true });
  }, [known]);

  if (!known) return null;
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
  useGlobalKeys({ onShortcuts: () => setShortcuts((s) => !s), off: segments[0] === 'reply' || segments[0] === 'new' });
  return shortcuts ? <ShortcutsDialog onClose={() => setShortcuts(false)} /> : null;
}

function Frame() {
  const desktop = useIsDesktop();
  return desktop ? (
    <DesktopShell>
      <Routes />
    </DesktopShell>
  ) : (
    <Routes />
  );
}

export function App() {
  return (
    <StoreProvider>
      <Frame />
      <GlobalKeys />
      <Toast />
    </StoreProvider>
  );
}
