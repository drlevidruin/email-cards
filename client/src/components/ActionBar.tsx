import { Ban, Check, Clock, Newspaper, Reply, type LucideIcon } from 'lucide-react';
import { useIsDesktop } from '../lib/useIsDesktop';
import './ActionBar.css';

/** Swipes. Right is the main move, left is the other one. */
export type Dir = 'left' | 'right' | 'up' | 'down';
/** The bar's three slots, laid out like the swipes. */
export type BarAction = 'left' | 'middle' | 'right';
export type BarVariant = 'default' | 'plain' | 'senders';

interface Item {
  slot: BarAction;
  label: string;
  Icon: LucideIcon;
  primary?: boolean;
}

function items(variant: BarVariant): Item[] {
  if (variant === 'senders') {
    return [
      { slot: 'left', label: 'Block', Icon: Ban },
      { slot: 'middle', label: 'Newsletters', Icon: Newspaper },
      { slot: 'right', label: 'Allow', Icon: Check, primary: true },
    ];
  }
  const out: Item[] = [{ slot: 'left', label: 'Later', Icon: Clock }];
  if (variant === 'default') out.push({ slot: 'middle', label: 'Reply', Icon: Reply });
  out.push({ slot: 'right', label: 'Done', Icon: Check, primary: true });
  return out;
}

interface Props {
  variant: BarVariant;
  active: Dir | null;
  /** No key hints in the labels, for screens where the arrow keys do nothing. */
  plainLabels?: boolean;
  onAction: (slot: BarAction) => void;
}

export function ActionBar({ variant, active, plainLabels, onAction }: Props) {
  const desktop = useIsDesktop();
  const list = items(variant);
  return (
    <div className={`actionbar actionbar--${variant} no-select`}>
      {list.map(({ slot, label, Icon, primary }) => {
        const text = desktop && !plainLabels ? (slot === 'left' ? `← ${label}` : slot === 'right' ? `${label} →` : label) : label;
        const cls = ['actionbar__btn', primary && 'actionbar__btn--primary', active === slot && 'is-active'].filter(Boolean).join(' ');
        return (
          <button key={slot} className={cls} onClick={() => onAction(slot)}>
            <Icon size={20} strokeWidth={2} />
            <span>{text}</span>
          </button>
        );
      })}
    </div>
  );
}
