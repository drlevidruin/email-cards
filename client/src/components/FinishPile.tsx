import { Check } from 'lucide-react';
import { cleanSubject, counterpart, type StackId } from '../lib/stacks';
import { recentMoves } from '../lib/progress';
import { useStore } from '../store';
import './FinishPile.css';

interface Mini {
  id: string;
  title: string;
  who: string;
  kind: string;
}

/** The pile you just cleared: up to three mini cards, the last handled on top, and a check on the corner. */
export function FinishPile({ stack, account, celebrate }: { stack: StackId; account: string; celebrate: boolean }) {
  const { data } = useStore();
  const minis: Mini[] = [];
  for (const m of recentMoves(stack, account, 3)) {
    const t = data?.threads.find((x) => x.id === m.id);
    const s = data?.screener.find((x) => x.email === m.id);
    if (t) minis.push({ id: m.id, title: t.distilledAsk || cleanSubject(t.subject), who: counterpart(t).name, kind: m.kind });
    else if (s) minis.push({ id: m.id, title: s.name, who: s.email, kind: m.kind });
  }
  // Back to front: the last handled card is the front one
  const stackOrder = [...minis].reverse();
  const front = stackOrder.length - 1;
  const rot = (i: number) => (i === front ? 0 : i === front - 1 ? 3 : -6);
  const cards: (Mini | null)[] = stackOrder.length > 0 ? stackOrder : [null];
  return (
    <div className={`pile${celebrate ? ' pile--go' : ''}`} aria-hidden="true">
      {cards.map((c, i) => {
        const isFront = i === cards.length - 1;
        return (
          <div key={c?.id ?? 'blank'} className="pile__card" style={{ ['--rot' as string]: `${rot(i)}deg`, ['--i' as string]: i }}>
            {isFront && c && (
              <>
                <span className="t-callout pile__title">{c.title}</span>
                <span className="t-footnote pile__who">{c.who}</span>
                <span className="t-caption pile__kind">{c.kind}</span>
              </>
            )}
            {isFront && (
              <span className="pile__check" style={{ ['--i' as string]: cards.length }}>
                <Check size={16} strokeWidth={2.5} />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
