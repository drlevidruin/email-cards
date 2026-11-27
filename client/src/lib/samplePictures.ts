/** Three pictures for the sample inbox, drawn in code as SVG and handed out as data URLs. Each is 1200 by 750. */

const FONT = "-apple-system, 'Helvetica Neue', Arial, sans-serif";
const url = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const RAYS = ['#FF5A5F', '#FF9F1C', '#FFE14D', '#3DDC97', '#3A86FF', '#9B5DE5'];

const rays = RAYS.map((c, i) => {
  const yc = 270 + i * 76;
  return `<polygon points="665,440 960,${yc - 14} 960,${yc + 14} 665,444" fill="${c}" opacity="0.85"/>`;
}).join('');

const menu = (fill: string, opacity: number) =>
  [1000, 1056, 1112].map((x) => `<rect x="${x}" y="68" width="32" height="6" rx="3" fill="${fill}" opacity="${opacity}"/>`).join('');

const SVG_A = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 750" width="1200" height="750">
<defs>
<filter id="soft" filterUnits="userSpaceOnUse" x="0" y="0" width="1200" height="750"><feGaussianBlur stdDeviation="6"/></filter>
<linearGradient id="beam" x1="270" y1="0" x2="540" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="1"/></linearGradient>
</defs>
<rect width="1200" height="750" fill="#0B0F1A"/>
<text x="56" y="80" font-family="${FONT}" font-size="30" font-weight="600" fill="#FFFFFF">Kestrel</text>
${menu('#8A93A6', 1)}
<text x="600" y="200" font-family="${FONT}" font-size="76" font-weight="700" fill="#FFFFFF" text-anchor="middle">Light, bent</text>
<text x="600" y="284" font-family="${FONT}" font-size="76" font-weight="700" fill="#FFFFFF" text-anchor="middle">on purpose.</text>
<g filter="url(#soft)">${rays}</g>
<polygon points="600,350 490,540 710,540" fill="#FFFFFF" fill-opacity="0.06" stroke="#FFFFFF" stroke-opacity="0.7" stroke-width="2" stroke-linejoin="round"/>
<rect x="270" y="440" width="270" height="3" fill="url(#beam)"/>
<rect x="500" y="610" width="200" height="56" rx="28" fill="#FFFFFF"/>
<text x="600" y="648" font-family="${FONT}" font-size="28" font-weight="600" fill="#0B0F1A" text-anchor="middle">See it live</text>
</svg>`;

const SVG_B = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 750" width="1200" height="750">
<defs>
<filter id="mesh" filterUnits="userSpaceOnUse" x="-300" y="-300" width="1800" height="1350"><feGaussianBlur stdDeviation="90"/></filter>
</defs>
<rect width="1200" height="750" fill="#F6F3EE"/>
<g filter="url(#mesh)" opacity="0.9">
<circle cx="380" cy="220" r="260" fill="#FFC9B5"/>
<circle cx="840" cy="300" r="260" fill="#CDB4F6"/>
<circle cx="600" cy="620" r="260" fill="#B8E8D4"/>
</g>
<text x="56" y="80" font-family="${FONT}" font-size="30" font-weight="600" fill="#14171F">Kestrel</text>
${menu('#14171F', 0.45)}
<text x="600" y="300" font-family="${FONT}" font-size="68" font-weight="700" fill="#14171F" text-anchor="middle">Launch day,</text>
<text x="600" y="380" font-family="${FONT}" font-size="68" font-weight="700" fill="#14171F" text-anchor="middle">without the wait.</text>
<rect x="420" y="425" width="360" height="10" rx="5" fill="#14171F" opacity="0.25"/>
<rect x="500" y="480" width="200" height="56" rx="28" fill="#14171F"/>
<text x="600" y="518" font-family="${FONT}" font-size="28" font-weight="600" fill="#FFFFFF" text-anchor="middle">See it live</text>
</svg>`;

const CUT = '#00A3E0';
const FOLD = '#E5007E';
const mark = (cx: number, cy: number) =>
  `<circle cx="${cx}" cy="${cy}" r="14" fill="none" stroke="#111111" stroke-width="2.5"/><path d="M${cx - 24},${cy} H${cx + 24} M${cx},${cy - 24} V${cy + 24}" stroke="#111111" stroke-width="2.5" fill="none"/>`;

const SVG_DIE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 750" width="1200" height="750">
<rect width="1200" height="750" fill="#FFFFFF"/>
<path d="M200,500 L200,240 L390,240 L390,224 L368,212 L368,162 L390,150 L390,120 L400,120 L414,92 L556,92 L570,120 L580,120 L580,150 L602,162 L602,212 L580,224 L580,240 L960,240 L960,260 L996,276 L996,464 L960,480 L960,500 L580,500 L580,620 L390,620 L390,500 Z" fill="none" stroke="${CUT}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
<path d="M390,240 V500 M580,240 V500 M770,240 V500 M390,240 H580 M390,500 H580 M960,260 V480 M390,120 H580 M390,150 V224 M580,150 V224" fill="none" stroke="${FOLD}" stroke-width="2.5" stroke-dasharray="14 10"/>
${mark(60, 60)}${mark(1140, 60)}${mark(60, 620)}${mark(1140, 620)}
<text x="56" y="706" font-family="${FONT}" font-size="28" fill="#111111" xml:space="preserve">Option B  120 x 80 x 40 mm</text>
<line x1="840" y1="696" x2="890" y2="696" stroke="${CUT}" stroke-width="2.5"/>
<text x="902" y="706" font-family="${FONT}" font-size="28" fill="#111111">Cut</text>
<line x1="990" y1="696" x2="1040" y2="696" stroke="${FOLD}" stroke-width="2.5" stroke-dasharray="14 10"/>
<text x="1052" y="706" font-family="${FONT}" font-size="28" fill="#111111">Fold</text>
</svg>`;

export const BUILD_A = url(SVG_A);
export const BUILD_B = url(SVG_B);
export const DIELINE = url(SVG_DIE);
