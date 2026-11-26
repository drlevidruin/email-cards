import { Sheet } from './Sheet';
import './ShortcutsDialog.css';

const ROWS: [string, string][] = [
  ['Done', '←'],
  ['Later', '↓'],
  ['Bookmark', '↑'],
  ['Reply', '→ or Enter'],
  ['Built-in reply', '1 2 3'],
  ['Undo', 'Z'],
  ['Menu', 'M'],
  ['Shortcuts', '?'],
  ['Close', 'Esc'],
];

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="Shortcuts" onClose={onClose} dialog>
      <ul>
        {ROWS.map(([action, key]) => (
          <li key={action} className="shortcuts__row">
            <span>{action}</span>
            <span className="shortcuts__key">{key}</span>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
