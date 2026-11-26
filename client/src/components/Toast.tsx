import { useStore } from '../store';
import { useRoute } from '../router';
import './Toast.css';

export function Toast() {
  const { toast, undo } = useStore();
  const route = useRoute();
  if (!toast) return null;
  const head = route.segments[0];
  const withBar = head === 'cards' || head === 'read';
  // Screens with a bottom input would have the toast cover it or sit behind the keyboard.
  const onTop = head === 'ask' || head === 'new' || head === 'reply';
  return (
    <div className={`toast-wrap${withBar ? ' toast-wrap--bar' : ''}${onTop ? ' toast-wrap--top' : ''}`}>
      <div className="toast" role="status" key={toast.id}>
        <span className="toast__text">{toast.text}</span>
        {toast.undoable && (
          <button className="toast__undo" onClick={() => void undo()}>
            Undo
          </button>
        )}
      </div>
    </div>
  );
}
