import type { ReactNode } from 'react';
import './TopBar.css';

interface Props {
  left?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
}

export function TopBar({ left, right, children }: Props) {
  return (
    <header className="topbar no-select">
      <div className="topbar__side">{left}</div>
      <div className="topbar__center">{children}</div>
      <div className="topbar__side topbar__side--right">{right}</div>
    </header>
  );
}
