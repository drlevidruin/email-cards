import { Bookmark } from 'lucide-react';
import './BookmarkButton.css';

interface Props {
  on: boolean;
  onToggle: () => void;
}

export function BookmarkButton({ on, onToggle }: Props) {
  return (
    <button
      className={`bookmark${on ? ' is-on' : ''}`}
      aria-pressed={on}
      aria-label="Bookmark"
      onClick={onToggle}
    >
      <Bookmark size={20} strokeWidth={2} fill={on ? 'currentColor' : 'none'} />
    </button>
  );
}
