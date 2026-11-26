import { handledToday } from '../lib/progress';
import type { StackId } from '../lib/stacks';
import { CountUp } from './CountUp';
import { Stack } from './Stack';
import './FinishPile.css';

/** The pile you just cleared, as a stack as thick as it was. Its front card shows how many you handled. */
export function FinishPile({ stack, account, celebrate }: { stack: StackId; account: string; celebrate: boolean }) {
  const handled = handledToday(stack, account);
  return (
    <div className={`pile${celebrate ? ' pile--go' : ''}`}>
      <Stack count={handled}>
        <div className="pile__front">
          {handled > 0 && (
            <>
              <span className="t-display t-num pile__n">
                <CountUp to={handled} run={celebrate} />
              </span>
              <span className="t-subhead pile__label">handled</span>
            </>
          )}
        </div>
      </Stack>
    </div>
  );
}
