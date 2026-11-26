import { useState } from 'react';
import { blankLabel } from '../lib/commitments';
import './BlankRows.css';

interface Props {
  blanks: string[];
  /** Replace this blank in the draft with what was typed. */
  onFill: (blank: string, value: string) => void;
}

/** One row for each blank the draft still holds: its words as a label, a field, and Add. Return adds too. */
export function BlankRows({ blanks, onFill }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  if (blanks.length === 0) return null;
  return (
    <div className="blanks">
      {blanks.map((b) => {
        const value = (values[b] ?? '').trim();
        const add = () => {
          if (!value) return;
          onFill(b, value);
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
                autoComplete="off"
              />
              <button type="submit" className="blank__add t-callout" disabled={!value}>
                Add
              </button>
            </div>
          </form>
        );
      })}
    </div>
  );
}
