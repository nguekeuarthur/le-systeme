// Formes des données côté interface. Elles reprennent les entités de
// rayfin/data sans les importer à l'exécution (les décorateurs restent côté CLI).

export type CategorieQuete = 'sport' | 'lecture' | 'anime' | 'manga';
export type CategorieActivite = CategorieQuete | 'oeuvre' | 'certification' | 'quete';
export type Unite = 'minute' | 'page' | 'episode' | 'chapitre' | 'tome' | 'aucune';
export type TypeOeuvre = 'anime' | 'manga' | 'livre';
export type FormatOeuvre = 'papier' | 'en_ligne';
export type UniteOeuvre = 'episode' | 'chapitre' | 'tome' | 'page';

export interface Joueur {
  id: string;
  nom: string;
  creeLe: Date;
}

export interface Quete {
  id: string;
  categorie: CategorieQuete;
  libelle: string;
  objectif: number;
  pas: number;
  ordre: number;
}

export interface Oeuvre {
  id: string;
  type: TypeOeuvre;
  format: FormatOeuvre;
  unite: UniteOeuvre;
  titre: string;
  progression: number;
  total: number;
  terminee: boolean;
  termineeLe?: Date | null;
  creeLe: Date;
}

export interface Certification {
  id: string;
  code: string;
  intitule?: string | null;
  obtenueLe: Date;
}

export interface Activite {
  id: string;
  categorie: CategorieActivite;
  unite: Unite;
  quantite: number;
  xp: number;
  libelle: string;
  faiteLe: Date;
  appareil: string;
}

export interface Donnees {
  joueur: Joueur | null;
  quetes: Quete[];
  oeuvres: Oeuvre[];
  certifications: Certification[];
  activites: Activite[];
}

export type Nouveau<T extends { id: string }> = Omit<T, 'id'>;
