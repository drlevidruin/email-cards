import { Fragment } from 'react';
import { blankWords } from '../lib/commitments';
import './BlankText.css';

/** A draft as text, each open blank shown as its own words on an accent tint instead of in brackets. Only the blanks given are styled. */
export function BlankText({ text, blanks }: { text: string; blanks: string[] }) {
  const open = [...new Set(blanks)].filter((b) => text.includes(b));
  if (open.length === 0) return <>{text}</>;
  const re = new RegExp(`(${open.map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`);
  return (
    <>
      {text.split(re).map((part, i) =>
        open.includes(part) ? (
          <span key={i} className="blanktoken">
            {blankWords(part)}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  );
}
