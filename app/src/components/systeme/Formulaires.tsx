import { useState, type FormEvent } from 'react';

import type { FormulaireOeuvre } from '@/systeme/actions';
import { UNITE_PAR_TYPE } from '@/systeme/regles';
import type { FormatOeuvre, TypeOeuvre, UniteOeuvre } from '@/systeme/types';

interface ChoixProps<T extends string> {
  options: { valeur: T; libelle: string }[];
  valeur: T;
  onChange: (v: T) => void;
}

function Choix<T extends string>({ options, valeur, onChange }: ChoixProps<T>) {
  return (
    <div className="choix">
      {options.map((o) => (
        <button key={o.valeur} type="button" aria-pressed={valeur === o.valeur} onClick={() => onChange(o.valeur)}>
          {o.libelle}
        </button>
      ))}
    </div>
  );
}

const LIBELLE_UNITE: Record<UniteOeuvre, string> = {
  episode: 'Épisodes',
  chapitre: 'Chapitres',
  tome: 'Tomes',
  page: 'Pages',
};

export function FormOeuvre({ onValider }: { onValider: (f: FormulaireOeuvre) => Promise<void> }) {
  const [type, setType] = useState<TypeOeuvre>('manga');
  const [format, setFormat] = useState<FormatOeuvre>('en_ligne');
  const [unite, setUnite] = useState<UniteOeuvre>('chapitre');
  const [titre, setTitre] = useState('');
  const [progression, setProgression] = useState('0');
  const [total, setTotal] = useState('');
  const [terminee, setTerminee] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  const changerType = (t: TypeOeuvre) => {
    setType(t);
    setUnite(UNITE_PAR_TYPE[t]);
  };

  const valider = async (e: FormEvent) => {
    e.preventDefault();
    const tot = Number(total);
    if (!titre.trim() || !Number.isFinite(tot) || tot < 1) return;
    setEnvoi(true);
    try {
      await onValider({
        type,
        format,
        unite,
        titre,
        total: tot,
        progression: terminee ? tot : Number(progression) || 0,
      });
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <form className="form" onSubmit={valider}>
      <Choix<TypeOeuvre>
        options={[
          { valeur: 'anime', libelle: 'ANIME' },
          { valeur: 'manga', libelle: 'MANGA' },
          { valeur: 'livre', libelle: 'LIVRE' },
        ]}
        valeur={type}
        onChange={changerType}
      />
      <label className="champ">
        <span>TITRE</span>
        <input value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={120} required autoFocus />
      </label>
      {type !== 'anime' && (
        <Choix<FormatOeuvre>
          options={[
            { valeur: 'en_ligne', libelle: 'EN LIGNE' },
            { valeur: 'papier', libelle: 'PAPIER' },
          ]}
          valeur={format}
          onChange={setFormat}
        />
      )}
      {type === 'manga' && (
        <Choix<UniteOeuvre>
          options={[
            { valeur: 'chapitre', libelle: 'EN CHAPITRES' },
            { valeur: 'tome', libelle: 'EN TOMES' },
          ]}
          valeur={unite}
          onChange={setUnite}
        />
      )}
      <div className="deux">
        <label className="champ">
          <span>{LIBELLE_UNITE[unite].toUpperCase()} LUS / VUS</span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={terminee ? total : progression}
            disabled={terminee}
            onChange={(e) => setProgression(e.target.value)}
          />
        </label>
        <label className="champ">
          <span>OBJECTIF</span>
          <input type="number" min={1} inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value)} required />
        </label>
      </div>
      <label className="case">
        <input type="checkbox" checked={terminee} onChange={(e) => setTerminee(e.target.checked)} />
        Déjà terminée : elle rejoint directement l'armée des ombres
      </label>
      <button type="submit" className="btn-sys" disabled={envoi}>
        {envoi ? 'ENREGISTREMENT…' : 'AJOUTER'}
      </button>
    </form>
  );
}

const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function FormCertif({
  onValider,
}: {
  onValider: (code: string, intitule: string, obtenueLe: Date) => Promise<void>;
}) {
  const [code, setCode] = useState('');
  const [intitule, setIntitule] = useState('');
  const [date, setDate] = useState(aujourdhui());
  const [envoi, setEnvoi] = useState(false);

  const valider = async (e: FormEvent) => {
    e.preventDefault();
    if (code.trim().length < 2) return;
    setEnvoi(true);
    try {
      await onValider(code, intitule, new Date(`${date}T12:00:00`));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <form className="form" onSubmit={valider}>
      <div className="deux">
        <label className="champ">
          <span>CODE</span>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="DP-700" maxLength={20} required autoFocus />
        </label>
        <label className="champ">
          <span>OBTENUE LE</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
      </div>
      <label className="champ">
        <span>INTITULÉ (FACULTATIF)</span>
        <input value={intitule} onChange={(e) => setIntitule(e.target.value)} maxLength={120} />
      </label>
      <button type="submit" className="btn-sys" disabled={envoi}>
        {envoi ? 'ENREGISTREMENT…' : 'VALIDER'}
      </button>
    </form>
  );
}

export function FormNom({ onValider }: { onValider: (nom: string) => Promise<void> }) {
  const [nom, setNom] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const valider = async (e: FormEvent) => {
    e.preventDefault();
    if (!nom.trim()) return;
    setEnvoi(true);
    try {
      await onValider(nom);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <form className="form" onSubmit={valider}>
      <p className="intro-txt" style={{ minHeight: 0, textAlign: 'center' }}>
        Quel est ton nom, Joueur ?
      </p>
      <label className="champ">
        <span>NOM DU JOUEUR</span>
        <input value={nom} onChange={(e) => setNom(e.target.value)} maxLength={40} required autoFocus />
      </label>
      <button type="submit" className="btn-sys" disabled={envoi}>
        {envoi ? 'ÉVEIL EN COURS…' : 'ÉVEILLER'}
      </button>
    </form>
  );
}
