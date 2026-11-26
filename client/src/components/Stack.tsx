import type { CSSProperties, ReactNode } from 'react';
import './Stack.css';

/** How many edges show behind the front card: 1 card none, 2 to 3 one, 4 to 7 two, 8 or more three. */
export function edgesFor(count: number): number {
  return count >= 8 ? 3 : count >= 4 ? 2 : count >= 2 ? 1 : 0;
}

interface Props {
  /** How many cards the pile holds. */
  count: number;
  /** The front card is a button when it is pressed, otherwise a plain box. */
  onClick?: () => void;
  disabled?: boolean;
  label?: string;
  className?: string;
  children: ReactNode;
}

/**
 * A pile drawn as a stack: the front card, with edges behind it as thick as the pile.
 * Each edge has the same shape, 5px lower and 6px narrower on each side than the one in front of it.
 * The shadow is on the last one only.
 */
export function Stack({ count, onClick, disabled, label, className, children }: Props) {
  const edges = edgesFor(count);
  const front = `stack__front${edges > 0 ? ' stack__front--flat' : ''}`;
  return (
    <div className={`stack${className ? ` ${className}` : ''}`} style={{ ['--edges' as string]: edges } as CSSProperties}>
      {Array.from({ length: edges }, (_, i) => {
        const k = edges - i;
        return <span key={k} className={`stack__edge${k === edges ? ' stack__edge--last' : ''}`} style={{ ['--k' as string]: k } as CSSProperties} aria-hidden="true" />;
      })}
      {onClick ? (
        <button className={front} onClick={onClick} disabled={disabled} aria-label={label}>
          {children}
        </button>
      ) : (
        <div className={front}>{children}</div>
      )}
    </div>
  );
}
