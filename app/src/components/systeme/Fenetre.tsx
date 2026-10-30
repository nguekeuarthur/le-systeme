import { useEffect, type ReactNode } from 'react';

interface FenetreProps {
  titre: string;
  ouverte: boolean;
  alerte?: boolean;
  children: ReactNode;
}

/** Fenêtre holographique du Système, qui s'ouvre en ligne puis se déplie. */
export function Fenetre({ titre, ouverte, alerte, children }: FenetreProps) {
  return (
    <section className={`win${ouverte ? ' open' : ''}`} aria-label={titre}>
      <div className={`win-titre${alerte ? ' alerte' : ''}`}>
        <span>{titre}</span>
      </div>
      {children}
    </section>
  );
}

interface ModaleProps {
  titre: string;
  onFermer: () => void;
  children: ReactNode;
  large?: boolean;
}

export function Modale({ titre, onFermer, children, large }: ModaleProps) {
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFermer();
    };
    addEventListener('keydown', surTouche);
    return () => removeEventListener('keydown', surTouche);
  }, [onFermer]);

  return (
    <div
      className={`modale${large ? ' large' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={titre}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onFermer();
      }}
    >
      <Fenetre titre={titre} ouverte>
        <button type="button" className="modale-x" onClick={onFermer} aria-label="Fermer">
          ×
        </button>
        {children}
      </Fenetre>
    </div>
  );
}
