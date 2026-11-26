import { Ban, Bookmark, BookmarkMinus, Check, Clock, Newspaper, Reply, type LucideIcon } from 'lucide-react';
import { useIsDesktop } from '../lib/useIsDesktop';
import './ActionBar.css';

export type Dir = 'left' | 'right' | 'up' | 'down';
export type BarVariant = 'default' | 'bookmarked' | 'senders';

interface Item {
  dir: Dir;
  label: string;
  Icon: LucideIcon;
  primary?: boolean;
}

const ARROW: Record<Dir, string> = { left: '← ', down: '↓ ', up: '↑ ', right: '' };

function items(variant: BarVariant): Item[] {
  if (variant === 'senders') {
    return [
      { dir: 'left', label: 'Block', Icon: Ban },
      { dir: 'down', label: 'Newsletters', Icon: Newspaper },
      { dir: 'right', label: 'Allow', Icon: Check, primary: true },
    ];
  }
  return [
    { dir: 'left', label: 'Done', Icon: Check },
    { dir: 'down', label: 'Later', Icon: Clock },
    variant === 'bookmarked'
      ? { dir: 'up', label: 'Unbookmark', Icon: BookmarkMinus }
      : { dir: 'up', label: 'Bookmark', Icon: Bookmark },
    { dir: 'right', label: 'Reply', Icon: Reply, primary: true },
  ];
}

interface Props {
  variant: BarVariant;
  active: Dir | null;
  /** No arrow glyphs, for screens where the arrow keys do nothing. */
  plainLabels?: boolean;
  onAction: (dir: Dir) => void;
}

export function ActionBar({ variant, active, plainLabels, onAction }: Props) {
  const desktop = useIsDesktop();
  return (
    <div className="actionbar no-select">
      {items(variant).map(({ dir, label, Icon, primary }) => {
        const text = desktop && !plainLabels ? (dir === 'right' ? `${label} →` : `${ARROW[dir]}${label}`) : label;
        const cls = ['actionbar__btn', primary && 'actionbar__btn--primary', active === dir && 'is-active']
          .filter(Boolean)
          .join(' ');
        return (
          <button key={dir} className="actionbar__item" onClick={() => onAction(dir)}>
            <span className={cls}>
              <Icon size={22} strokeWidth={2} />
            </span>
            <span className="actionbar__label">{text}</span>
          </button>
        );
      })}
    </div>
  );
}
