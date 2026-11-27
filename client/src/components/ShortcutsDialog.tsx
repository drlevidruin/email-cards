import { useRef } from 'react';
import { useDialog } from './useDialog';
import './ShortcutsDialog.css';

type Group = { title: string; rows: [string, string[]][] };

const LEFT: Group[] = [
  {
    title: 'Cards',
    rows: [
      ['Done', ['E', '→']],
      ['Later', ['H', '←']],
      ['To-do', ['T', '↑']],
      ['Skip', ['J', '↓']],
      ['Open email', ['Enter']],
      ['Open an answer', ['1', '2']],
      ['Write my own', ['R']],
      ['Undo', ['Z']],
      ['Allow sender', ['A']],
      ['Block sender', ['B']],
      ['Send to Newsletters', ['N']],
    ],
  },
];
const RIGHT: Group[] = [
  {
    title: 'Reply',
    rows: [
      ['Pick a reply', ['1', '2', '3']],
      ['Write my own', ['W']],
      ['Send', ['⌘', 'Enter']],
      ['Back', ['Esc']],
    ],
  },
  {
    title: 'Go to',
    rows: [
      ['Search', ['/']],
      ['New email', ['C']],
      ['To-do', ['G', 'T']],
      ['Chats', ['G', 'I']],
      ['Drafts', ['G', 'D']],
      ['This sheet', ['?']],
    ],
  },
];

function Column({ groups }: { groups: Group[] }) {
  return (
    <div className="shortcuts__col">
      {groups.map((g) => (
        <section key={g.title}>
          <h3 className="t-footnote shortcuts__group">{g.title}</h3>
          <ul>
            {g.rows.map(([action, keys]) => (
              <li key={action} className="shortcuts__row">
                <span className="t-subhead shortcuts__action">{action}</span>
                <span className="shortcuts__keys">
                  {keys.map((k) => (
                    <kbd key={k} className="keycap">{k}</kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  useDialog(box, onClose);
  return (
    <div className="shortcuts-scrim" onClick={onClose}>
      <div ref={box} tabIndex={-1} className="shortcuts" role="dialog" aria-modal="true" aria-label="Shortcuts" onClick={(e) => e.stopPropagation()}>
        <h2 className="t-title-2 shortcuts__title">Shortcuts</h2>
        <div className="shortcuts__cols">
          <Column groups={LEFT} />
          <Column groups={RIGHT} />
        </div>
      </div>
    </div>
  );
}
