import { getInitials } from '../lib/utils';
import './Avatar.css';

export function Avatar({ name, small, card }: { name: string; small?: boolean; card?: boolean }) {
  return (
    <span className={`avatar${small ? ' avatar--small' : ''}${card ? ' avatar--card' : ''}`} aria-hidden="true">
      {getInitials(name)}
    </span>
  );
}
