import { useEffect, useMemo } from 'react';
import { laterOptions, type LaterOption } from '../lib/time';
import { Sheet } from './Sheet';

interface Props {
  onPick: (option: LaterOption) => void;
  onClose: () => void;
}

export function LaterSheet({ onPick, onClose }: Props) {
  const options = useMemo(() => laterOptions(new Date()), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= options.length) onPick(options[n - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [options, onPick]);

  return (
    <Sheet title="Later" onClose={onClose}>
      {options.map((o) => (
        <button key={o.id} className="sheet__row" onClick={() => onPick(o)}>
          <span className="sheet__row-label">{o.label}</span>
          <span className="sheet__row-value">{o.when}</span>
        </button>
      ))}
    </Sheet>
  );
}
