import { getInitials } from '../lib/utils';
import './Avatar.css';

export function Avatar({ name }: { name: string }) {
  return (
    <span className="avatar" aria-hidden="true">
      {getInitials(name)}
    </span>
  );
}
