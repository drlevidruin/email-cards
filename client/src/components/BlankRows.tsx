import { forwardRef, useImperativeHandle, useState } from 'react';
import { blankLabel } from '../lib/commitments';
import './BlankRows.css';

/** What goes in: each fill-in's words and what was typed for it. `quiet` means the person moved on by themselves, so focus is left where they put it. */
export type Fill = (pairs: [string, string][], quiet?: boolean) => void;

export interface BlankRowsHandle {
  /** Add everything typed in the fields. */
  addTyped: () => void;
}

interface Props {
  blanks: string[];
  /** Replace these blanks in the draft with what was typed. */
  onFill: Fill;
}

/** One row for each blank the draft still holds: its words as a label, a field, and Add. Return, Add, or leaving the field all add what was typed. */
export const BlankRows = forwardRef<BlankRowsHandle, Props>(function BlankRows({ blanks, onFill }, ref) {
  const [values, setValues] = useState<Record<string, string>>({});
  useImperativeHandle(ref, () => ({
    addTyped: () => {
      const pairs = blanks.flatMap((b): [string, string][] => ((values[b] ?? '').trim() ? [[b, values[b].trim()]] : []));
      if (pairs.length === 0) return;
      onFill(pairs, true);
      setValues({});
    },
  }));
  if (blanks.length === 0) return null;
  return (
    <div className="blanks">
      {blanks.map((b) => {
        const value = (values[b] ?? '').trim();
        const add = (quiet?: boolean) => {
          if (!value) return;
          onFill([[b, value]], quiet);
          setValues((v) => {
            const next = { ...v };
            delete next[b];
            return next;
          });
        };
        return (
          <form
            key={b}
            className="blank"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <label className="t-footnote blank__label" htmlFor={`blank-${b}`}>
              {blankLabel(b)}
            </label>
            <div className="blank__line">
              <input
                id={`blank-${b}`}
                className="t-body blank__input"
                value={values[b] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [b]: e.target.value }))}
                onBlur={(e) => {
                  // Leaving by Cancel or Back drops what was typed, the same as Escape. Tab to this row's own Add leaves the adding to that button
                  const to = e.relatedTarget instanceof Element ? e.relatedTarget : null;
                  if (to?.closest('.composer__cancel, .composer__back') || (to && e.currentTarget.form?.contains(to))) return;
                  add(true);
                }}
                enterKeyHint="done"
                autoComplete="off"
              />
              <button
                type="submit"
                className="blank__add t-callout"
                disabled={!value}
                // The press must not take focus from the field, or the blur adds the text and Add's own click never arrives
                onMouseDown={(e) => e.preventDefault()}
              >
                Add
              </button>
            </div>
          </form>
        );
      })}
    </div>
  );
});
