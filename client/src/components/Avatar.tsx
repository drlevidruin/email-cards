import { getInitials } from '../lib/utils';
import './Avatar.css';

export function Avatar({ name, small }: { name: string; small?: boolean }) {
  return (
    <span className={`avatar${small ? ' avatar--small' : ''}`} aria-hidden="true">
      {getInitials(name)}
    </span>
  );
}
