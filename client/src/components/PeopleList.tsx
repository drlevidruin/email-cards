import type { Person } from '../lib/people';
import { Sheet } from './Sheet';
import './PeopleSheet.css';

interface Props {
  people: Person[];
  onClose: () => void;
}

/** Live mode: who is on the email, names and addresses only. Nothing here can be changed. */
export function PeopleList({ people, onClose }: Props) {
  return (
    <Sheet title="People" onClose={onClose} className="psheet">
      <ul className="plist">
        {people.map((p) => (
          <li key={p.email} className="plist__row">
            <span className="plist__name">{p.name || p.email}</span>
            {p.name && <span className="plist__addr">{p.email}</span>}
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
