import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

import { Fenetre } from '@/components/systeme/Fenetre';
import { pasOeuvre, uniteCourte, uniteLongue, UNITE_QUETE, type Vue } from '@/systeme/regles';
import type { Oeuvre, Quete } from '@/systeme/types';

interface TerminalProps {
  vue: Vue;
  niveau: number;
  rang: string;
  couleurRang: string;
  xpPct: number;
  quetes: Quete[];
  enCours: Oeuvre[];
  surQuete: (q: Quete) => void;
  surOeuvre: (o: Oeuvre) => void;
  ouvrir: (m: 'oeuvre' | 'certif' | 'journal') => void;
}

/**
 * Terminal mobile : la saisie rapide depuis le téléphone, sans scène 3D.
 * Les actions partent dans le journal et l'écran du Système les rejoue.
 */
export function Terminal({ vue, niveau, rang, couleurRang, xpPct, quetes, enCours, surQuete, surOeuvre, ouvrir }: TerminalProps) {
  return (
    <main className="terminal">
      <section className="t-entete">
        <div>
          <div className="lab">JOUEUR</div>
          <div className="val">{vue.nom}</div>
        </div>
        <div className="t-niv">
          <div className="lab">NIVEAU</div>
          <div className="val num">{niveau}</div>
        </div>
        <div className="t-niv">
          <div className="lab">RANG</div>
          <div className="val" style={{ color: couleurRang, textShadow: `0 0 12px ${couleurRang}` }}>
            {rang}
          </div>
        </div>
        <div className="xp-barre t-xp">
          <div className="xp-rempli" style={{ width: `${xpPct.toFixed(1)}%` }} />
        </div>
      </section>

      <Fenetre titre="QUÊTE QUOTIDIENNE" alerte ouverte>
        <div className="t-quetes">
          {quetes.map((q) => {
            const fait = vue.progression[q.categorie];
            const u = UNITE_QUETE[q.categorie];
            return (
              <button
                key={q.id}
                type="button"
                className={`t-tuile${fait >= q.objectif ? ' fini' : ''}`}
                onClick={() => surQuete(q)}
              >
                <span className="t-nom">{q.libelle}</span>
                <span className="t-val num">
                  {fait}/{q.objectif} {uniteLongue(u, q.objectif)}
                </span>
                <span className="t-plus">
                  +{q.pas} {uniteLongue(u, q.pas)}
                </span>
                <i style={{ width: `${Math.min(100, (100 * fait) / q.objectif)}%` }} />
              </button>
            );
          })}
        </div>
      </Fenetre>

      <Fenetre titre="EN COURS" ouverte>
        {enCours.length ? (
          <ul className="liste">
            {enCours.map((o) => (
              <li key={o.id} className="t-oeuvre">
                <div>
                  <div className="o-titre">{o.titre}</div>
                  <div className="o-prog num">
                    {uniteCourte(o.unite)} {o.progression}/{o.total}
                  </div>
                </div>
                <button type="button" className="t-btn" onClick={() => surOeuvre(o)}>
                  +{pasOeuvre(o.unite)} {uniteCourte(o.unite)}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="vide">Aucune œuvre en cours.</p>
        )}
      </Fenetre>

      <div className="t-actions">
        <button type="button" className="ajouter" onClick={() => ouvrir('oeuvre')}>
          + ŒUVRE
        </button>
        <button type="button" className="ajouter" onClick={() => ouvrir('certif')}>
          + CERTIFICATION
        </button>
        <button type="button" className="ajouter t-journal" onClick={() => ouvrir('journal')}>
          JOURNAL · CORRIGER UNE SAISIE
        </button>
      </div>
      <p className="t-pied">Chaque action apparaît en direct sur l'écran du Système.</p>
    </main>
  );
}

/** QR code à scanner avec le téléphone pour ouvrir le terminal. */
export function QrTerminal({ url }: { url: string }) {
  const [image, setImage] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: '#4fd1ff', light: '#02040a' } })
      .then(setImage)
      .catch(() => setImage(null));
  }, [url]);

  return (
    <div className="qr">
      {image && <img src={image} alt="QR code du terminal mobile" width={240} height={240} />}
      <p className="intro-txt" style={{ minHeight: 0 }}>
        Scanne ce code avec ton téléphone pour le connecter au Système.
      </p>
      <p className="qr-url">{url}</p>
    </div>
  );
}
