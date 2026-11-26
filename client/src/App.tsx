import { useEffect } from 'react';
import { navigate, useRoute } from './router';
import { StoreProvider } from './store';
import { isStackId } from './lib/stacks';
import { Toast } from './components/Toast';
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
  const { segments } = useRoute();
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
  if (head === 'cards' && isStackId(arg)) return <CardsScreen stack={arg} />;
  if (head === 'reply') return <ReplyScreen threadId={arg} />;
  if (head === 'read') return <ReadScreen threadId={arg} />;
  if (head === 'all') return <AllMailScreen />;
  const Page = PAGES[head];
  return <Page />;
}

export function App() {
  return (
    <StoreProvider>
      <Routes />
      <Toast />
    </StoreProvider>
  );
}
