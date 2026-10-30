import type {
  Activite,
  CategorieQuete,
  Donnees,
  Nouveau,
  Quete,
  TypeOeuvre,
  Unite,
  UniteOeuvre,
} from './types';

/* ---------- Barèmes ---------- */

/** E à S, puis M : le rang Monarque, au-dessus de S. */
export const RANGS = ['E', 'D', 'C', 'B', 'A', 'S', 'M'] as const;
export type Rang = (typeof RANGS)[number];
/** La certification qui débloque le rang S. */
export const CERTIF_RANG_S = 'DP-600';
/** La certification qui débloque le rang Monarque (une fois le rang S atteint). */
export const CERTIF_MONARQUE = 'AI-103';
export const nomRang = (r: Rang) => (r === 'M' ? 'MONARQUE' : `RANG ${r}`);

export const XP_PAR_UNITE: Record<Unite, number> = {
  minute: 2,
  page: 2.5,
  episode: 30,
  chapitre: 10,
  tome: 50,
  aucune: 0,
};
export const XP_OEUVRE_TERMINEE = 120;
export const XP_CERTIFICATION = 300;
export const XP_QUETE_ACCOMPLIE = 150;
/** Un tome lu compte pour autant de chapitres dans la quête manga. */
export const CHAPITRES_PAR_TOME = 8;

export const UNITE_QUETE: Record<CategorieQuete, Unite> = {
  sport: 'minute',
  lecture: 'page',
  anime: 'episode',
  manga: 'chapitre',
};

export const QUETES_PAR_DEFAUT: Nouveau<Quete>[] = [
  { categorie: 'sport', libelle: 'Sport', objectif: 30, pas: 10, ordre: 1 },
  { categorie: 'lecture', libelle: 'Lecture', objectif: 20, pas: 5, ordre: 2 },
  { categorie: 'anime', libelle: 'Anime', objectif: 1, pas: 1, ordre: 3 },
  { categorie: 'manga', libelle: 'Manga', objectif: 3, pas: 1, ordre: 4 },
];

export const STATS = [
  { cle: 'force', nom: 'FORCE', court: 'FOR' },
  { cle: 'savoir', nom: 'SAVOIR', court: 'SAV' },
  { cle: 'imagination', nom: 'IMAGINATION', court: 'IMA' },
  { cle: 'maitrise', nom: 'MAÎTRISE', court: 'MAÎ' },
  { cle: 'constance', nom: 'CONSTANCE', court: 'CON' },
] as const;
export type CleStat = (typeof STATS)[number]['cle'];

/* ---------- Libellés ---------- */

const UNITES_COURTES: Record<Unite, string> = {
  minute: 'min',
  page: 'p.',
  episode: 'ép.',
  chapitre: 'ch.',
  tome: 't.',
  aucune: '',
};
export const uniteCourte = (u: Unite) => UNITES_COURTES[u];

export function uniteLongue(u: Unite, n: number): string {
  const pluriel = n > 1;
  switch (u) {
    case 'minute':
      return 'min';
    case 'page':
      return pluriel ? 'pages' : 'page';
    case 'episode':
      return pluriel ? 'épisodes' : 'épisode';
    case 'chapitre':
      return pluriel ? 'chapitres' : 'chapitre';
    case 'tome':
      return pluriel ? 'tomes' : 'tome';
    default:
      return '';
  }
}

export const UNITE_PAR_TYPE: Record<TypeOeuvre, UniteOeuvre> = {
  anime: 'episode',
  manga: 'chapitre',
  livre: 'page',
};
export const CATEGORIE_PAR_TYPE: Record<TypeOeuvre, CategorieQuete> = {
  anime: 'anime',
  manga: 'manga',
  livre: 'lecture',
};
/** Pas du bouton « + » d'une œuvre. */
export const pasOeuvre = (u: UniteOeuvre) => (u === 'page' ? 10 : 1);

/* ---------- Calculs ---------- */

export const xpPour = (unite: Unite, quantite: number) =>
  Math.round(XP_PAR_UNITE[unite] * quantite);

export const xpMax = (niveau: number) => 400 + 10 * niveau;

export function niveauDepuisXp(total: number) {
  let niveau = 1;
  let reste = total;
  while (reste >= xpMax(niveau)) {
    reste -= xpMax(niveau);
    niveau += 1;
  }
  return { niveau, xp: reste, max: xpMax(niveau) };
}

export const memeJour = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const cleJour = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Ce qui compte pour la quête d'une catégorie (les tomes valent des chapitres). */
function apportQuete(a: Activite): number {
  if (a.categorie === 'manga' && a.unite === 'tome') return a.quantite * CHAPITRES_PAR_TOME;
  return a.quantite;
}

export function progressionDuJour(
  activites: Activite[],
  jour: Date = new Date()
): Record<CategorieQuete, number> {
  const p: Record<CategorieQuete, number> = { sport: 0, lecture: 0, anime: 0, manga: 0 };
  for (const a of activites) {
    if (a.categorie in p && memeJour(a.faiteLe, jour)) {
      p[a.categorie as CategorieQuete] += apportQuete(a);
    }
  }
  return p;
}

export function queteDuJourRemplie(
  quetes: Quete[],
  activites: Activite[],
  jour: Date = new Date()
): boolean {
  if (!quetes.length) return false;
  const p = progressionDuJour(activites, jour);
  return quetes.every((q) => p[q.categorie] >= q.objectif);
}

export const bonusDejaRecu = (activites: Activite[], jour: Date = new Date()) =>
  activites.some((a) => a.categorie === 'quete' && memeJour(a.faiteLe, jour));

export function rangDepuisCertifs(codes: string[]): Rang {
  const possede = (code: string) => codes.some((c) => c.trim().toUpperCase() === code);
  if (possede(CERTIF_RANG_S)) return possede(CERTIF_MONARQUE) ? 'M' : 'S';
  return RANGS[Math.min(codes.length, 4)];
}

const plafond = (v: number) => Math.max(0, Math.min(100, Math.floor(v)));

export interface Vue {
  nom: string;
  xpTotal: number;
  niveau: number;
  xp: number;
  max: number;
  stats: Record<CleStat, number>;
  rang: Rang;
  titre: string;
  ombres: number;
  progression: Record<CategorieQuete, number>;
  queteRemplie: boolean;
}

export function calculerVue(d: Donnees, jour: Date = new Date()): Vue {
  let xpTotal = 0;
  const totaux: Record<Unite, number> = { minute: 0, page: 0, episode: 0, chapitre: 0, tome: 0, aucune: 0 };
  const joursQuete = new Set<string>();
  for (const a of d.activites) {
    xpTotal += a.xp;
    if (a.categorie === 'quete') joursQuete.add(cleJour(a.faiteLe));
    else if (a.categorie !== 'oeuvre' && a.categorie !== 'certification') totaux[a.unite] += a.quantite;
  }
  const { niveau, xp, max } = niveauDepuisXp(xpTotal);
  const rang = rangDepuisCertifs(d.certifications.map((c) => c.code));
  const ombres = d.oeuvres.filter((o) => o.terminee).length;
  const stats: Record<CleStat, number> = {
    force: plafond(10 + totaux.minute / 60),
    savoir: plafond(10 + totaux.page / 100),
    imagination: plafond(10 + totaux.episode / 10 + totaux.chapitre / 30 + totaux.tome / 3),
    maitrise: plafond(10 + 12 * d.certifications.length),
    constance: plafond(10 + 3 * joursQuete.size),
  };
  let titre = 'Joueur éveillé';
  if (rang === 'M') titre = 'Monarque des données';
  else if (rang === 'S') titre = 'Chasseur de rang S';
  else if (d.certifications.length >= 3) titre = 'Chasseur de certifications';
  else if (ombres >= 10) titre = 'Nécromancien des séries';
  else if (niveau >= 10) titre = 'Chasseur confirmé';
  return {
    nom: d.joueur?.nom ?? 'JOUEUR',
    xpTotal,
    niveau,
    xp,
    max,
    stats,
    rang,
    titre,
    ombres,
    progression: progressionDuJour(d.activites, jour),
    queteRemplie: queteDuJourRemplie(d.quetes, d.activites, jour),
  };
}

/* ---------- Ce qui s'est passé entre deux états ---------- */

export type Evenement =
  | { type: 'objectif'; libelle: string; xp: number; categorie: CategorieQuete; distant: boolean }
  | { type: 'progres'; libelle: string; xp: number; distant: boolean }
  | { type: 'quete'; xp: number }
  | { type: 'ombre'; titre: string }
  | { type: 'certif'; code: string }
  | { type: 'niveau'; de: number; vers: number }
  | { type: 'rang'; de: Rang; vers: Rang };

export function evenementsEntre(
  avant: Vue,
  apres: Vue,
  nouvelles: Activite[],
  quetes: Quete[],
  appareil: string
): Evenement[] {
  const evts: Evenement[] = [];
  const objectifsAnnonces = new Set<CategorieQuete>();
  const tri = [...nouvelles].sort((a, b) => a.faiteLe.getTime() - b.faiteLe.getTime());
  for (const a of tri) {
    const distant = a.appareil !== appareil;
    switch (a.categorie) {
      case 'sport':
      case 'lecture':
      case 'anime':
      case 'manga': {
        const q = quetes.find((x) => x.categorie === a.categorie);
        const vientDeFinir =
          q && avant.progression[a.categorie] < q.objectif && apres.progression[a.categorie] >= q.objectif;
        if (q && vientDeFinir && !objectifsAnnonces.has(a.categorie)) {
          objectifsAnnonces.add(a.categorie);
          evts.push({ type: 'objectif', libelle: q.libelle, xp: a.xp, categorie: a.categorie, distant });
        } else {
          evts.push({ type: 'progres', libelle: a.libelle, xp: a.xp, distant });
        }
        break;
      }
      case 'quete':
        evts.push({ type: 'quete', xp: a.xp });
        break;
      case 'oeuvre':
        evts.push({ type: 'ombre', titre: a.libelle });
        break;
      case 'certification':
        evts.push({ type: 'certif', code: a.libelle });
        break;
    }
  }
  if (apres.niveau > avant.niveau) evts.push({ type: 'niveau', de: avant.niveau, vers: apres.niveau });
  if (apres.rang !== avant.rang) evts.push({ type: 'rang', de: avant.rang, vers: apres.rang });
  return evts;
}
