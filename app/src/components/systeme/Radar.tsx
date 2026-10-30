import { useEffect, useRef } from 'react';

import { STATS, type CleStat } from '@/systeme/regles';

const CX = 130;
const CY = 104;
const R = 66;

const point = (i: number, r: number) => {
  const a = -Math.PI / 2 + i * ((2 * Math.PI) / STATS.length);
  return [CX + Math.cos(a) * r, CY + Math.sin(a) * r] as const;
};
const polygone = (valeurs: number[]) => valeurs.map((v, i) => point(i, (R * v) / 100).join(',')).join(' ');

/** Pentagone des caractéristiques ; il se déforme en douceur quand elles montent. */
export function Radar({ stats }: { stats: Record<CleStat, number> }) {
  const polyRef = useRef<SVGPolygonElement>(null);
  const actuelles = useRef<number[]>(STATS.map((s) => stats[s.cle]));

  useEffect(() => {
    const de = actuelles.current.slice();
    const vers = STATS.map((s) => stats[s.cle]);
    const t0 = performance.now();
    let raf = 0;
    const pas = (now: number) => {
      const p = Math.min(1, (now - t0) / 700);
      const e = 1 - Math.pow(1 - p, 3);
      actuelles.current = de.map((v, i) => v + (vers[i] - v) * e);
      polyRef.current?.setAttribute('points', polygone(actuelles.current));
      if (p < 1) raf = requestAnimationFrame(pas);
    };
    raf = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(raf);
  }, [stats]);

  return (
    <svg className="radar" viewBox="0 0 260 196" role="img" aria-label="Caractéristiques du joueur">
      {[0.33, 0.66, 1].map((k) => (
        <polygon key={k} className="r-grille" points={STATS.map((_, i) => point(i, R * k).join(',')).join(' ')} />
      ))}
      {STATS.map((s, i) => {
        const [x, y] = point(i, R);
        return <line key={s.cle} className="r-axe" x1={CX} y1={CY} x2={x} y2={y} />;
      })}
      <polygon ref={polyRef} className="r-poly" points={polygone(actuelles.current)} />
      {STATS.map((s, i) => {
        const [x, y] = point(i, R + 16);
        const ancre = Math.abs(x - CX) < 5 ? 'middle' : x > CX ? 'start' : 'end';
        return (
          <text key={s.cle} className="r-lab" x={x} y={y} textAnchor={ancre}>
            <tspan>{s.court}</tspan>
            <tspan className="r-val" dx={5}>
              {stats[s.cle]}
            </tspan>
          </text>
        );
      })}
    </svg>
  );
}
