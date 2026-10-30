import { useState } from 'react';

import type { Activite, Certification, Donnees, Oeuvre } from '@/systeme/types';

const deux = (n: number) => String(n).padStart(2, '0');
const jourHeure = (d: Date) => `${deux(d.getDate())}.${deux(d.getMonth() + 1)}.${d.getFullYear()} ${deux(d.getHours())}:${deux(d.getMinutes())}`;
const jour = (d: Date) => `${deux(d.getDate())}.${deux(d.getMonth() + 1)}.${d.getFullYear()}`;

const TYPES = { anime: 'ANIME', manga: 'MANGA', livre: 'LIVRE' } as const;
const MAX_ACTIVITES = 40;

interface JournalProps {
  donnees: Donnees;
  surActivite: (a: Activite) => Promise<void>;
  surOeuvre: (o: Oeuvre) => Promise<void>;
  surCertification: (c: Certification) => Promise<void>;
}

/** Bouton en deux temps : « Supprimer », puis « Confirmer » pour éviter les erreurs de doigt. */
function Supprimer({ action }: { action: () => Promise<void> }) {
  const [etat, setEtat] = useState<'repos' | 'confirmer' | 'envoi'>('repos');
  return (
    <button
      type="button"
      className={`j-suppr${etat === 'confirmer' ? ' confirmer' : ''}`}
      disabled={etat === 'envoi'}
      onClick={async () => {
        if (etat === 'repos') {
          setEtat('confirmer');
          return;
        }
        setEtat('envoi');
        try {
          await action();
        } finally {
          setEtat('repos');
        }
      }}
      onBlur={() => etat === 'confirmer' && setEtat('repos')}
    >
      {etat === 'repos' ? 'Supprimer' : etat === 'confirmer' ? 'Confirmer' : '…'}
    </button>
  );
}

/** Journal du joueur : corriger une saisie, retirer une œuvre ou une certification. */
export function Journal({ donnees, surActivite, surOeuvre, surCertification }: JournalProps) {
  const activites = [...donnees.activites].sort((a, b) => b.faiteLe.getTime() - a.faiteLe.getTime()).slice(0, MAX_ACTIVITES);
  const oeuvres = [...donnees.oeuvres].sort((a, b) => b.creeLe.getTime() - a.creeLe.getTime());
  const certifications = [...donnees.certifications].sort((a, b) => b.obtenueLe.getTime() - a.obtenueLe.getTime());

  return (
    <div className="journal">
      <p className="j-aide">
        Supprimer une saisie retire aussi l'expérience qui en découlait : bonus de quête, ombre ou rang.
      </p>

      <h3 className="j-titre">ACTIONS RÉCENTES</h3>
      {activites.length ? (
        <ul className="j-liste">
          {activites.map((a) => (
            <li key={a.id} className="j-ligne">
              <span className="j-date num">{jourHeure(a.faiteLe)}</span>
              <span className="j-libelle">{a.libelle}</span>
              <span className="j-xp num">+{a.xp} XP</span>
              {/* Ces gains suivent leur œuvre ou leur certification : on les retire depuis leur section. */}
              {a.categorie === 'oeuvre' || a.categorie === 'certification' ? (
                <span className="j-lie">voir plus bas</span>
              ) : (
                <Supprimer action={() => surActivite(a)} />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="vide">Aucune action pour l'instant.</p>
      )}

      <h3 className="j-titre">ŒUVRES</h3>
      {oeuvres.length ? (
        <ul className="j-liste">
          {oeuvres.map((o) => (
            <li key={o.id} className="j-ligne">
              <span className="j-date">{TYPES[o.type]}</span>
              <span className="j-libelle">{o.titre}</span>
              <span className="j-xp">{o.terminee ? 'Terminée' : `${o.progression}/${o.total}`}</span>
              <Supprimer action={() => surOeuvre(o)} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="vide">Aucune œuvre.</p>
      )}

      <h3 className="j-titre">CERTIFICATIONS</h3>
      {certifications.length ? (
        <ul className="j-liste">
          {certifications.map((c) => (
            <li key={c.id} className="j-ligne">
              <span className="j-date num">{jour(c.obtenueLe)}</span>
              <span className="j-libelle">
                {c.code}
                {c.intitule ? ` · ${c.intitule}` : ''}
              </span>
              <span className="j-xp num">+300 XP</span>
              <Supprimer action={() => surCertification(c)} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="vide">Aucune certification.</p>
      )}
    </div>
  );
}
