import { useEffect } from 'react';

let holders = 0;
let restore: (() => void) | null = null;

/** Turns the browser's top bar and the overscroll area green while `on` (on a phone, the page's body too, which is what Safari on iOS 26 reads for its bars), and puts them back when the last green screen has gone. */
export function useBrandChrome(on: boolean) {
  useEffect(() => {
    if (!on) return;
    if (holders === 0) {
      const brand = getComputedStyle(document.documentElement).getPropertyValue('--brand-deep').trim() || '#0A5A44';
      let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      const made = !meta;
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'theme-color';
        document.head.appendChild(meta);
      }
      const was = meta.content;
      const html = document.documentElement;
      meta.content = brand;
      html.style.background = brand;
      // Only a phone-width window is green all over; on a laptop the middle column alone is
      const body = document.body;
      const bodyWas = body.style.background;
      const query = window.matchMedia('(max-width: 1023px)');
      const paint = () => {
        body.style.background = query.matches ? brand : bodyWas;
      };
      paint();
      // The window can change width while a green screen is up
      query.addEventListener('change', paint);
      const m = meta;
      restore = () => {
        query.removeEventListener('change', paint);
        html.style.background = '';
        body.style.background = bodyWas;
        if (made) m.remove();
        else m.content = was;
      };
    }
    holders += 1;
    return () => {
      holders -= 1;
      if (holders === 0) {
        restore?.();
        restore = null;
      }
    };
  }, [on]);
}
