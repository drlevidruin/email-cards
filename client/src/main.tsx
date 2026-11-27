import './lib/freshSample';
import './lib/demoClock';
import ReactDOM from 'react-dom/client';
import './styles/tokens.css';
import './styles/base.css';
import { App } from './App';
import { loadSnapshot } from './lib/snapshot';

void loadSnapshot().catch(() => null).then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
});
