import type { Activite, Certification, Donnees, Nouveau, Oeuvre, Quete } from './types';

export type ModeDonnees = 'fabric' | 'hors-ligne';

/**
 * Accès aux données du joueur. Deux implémentations :
 * - DepotRayfin : base SQL de la Fabric App, via le client Rayfin ;
 * - DepotLocal  : stockage du navigateur, quand aucun backend n'est configuré.
 */
export interface Depot {
  readonly mode: ModeDonnees;
  charger(): Promise<Donnees>;
  creerJoueur(nom: string): Promise<void>;
  creerQuete(q: Nouveau<Quete>): Promise<void>;
  ajouterActivite(a: Nouveau<Activite>): Promise<Activite>;
  ajouterOeuvre(o: Nouveau<Oeuvre>): Promise<Oeuvre>;
  majOeuvre(id: string, changements: Partial<Nouveau<Oeuvre>>): Promise<void>;
  ajouterCertification(c: Nouveau<Certification>): Promise<Certification>;
  supprimerActivite(id: string): Promise<void>;
  supprimerOeuvre(id: string): Promise<void>;
  supprimerCertification(id: string): Promise<void>;
  /** Activités enregistrées après `depuis`, tous appareils confondus. */
  activitesDepuis(depuis: Date): Promise<Activite[]>;
}

const CLE_APPAREIL = 'le-systeme.appareil';

/**
 * Identifiant de cet onglet, pour reconnaître les actions venues d'ailleurs.
 * Gardé par onglet : deux fenêtres côte à côte se comportent comme deux appareils.
 */
export function idAppareil(): string {
  try {
    let id = sessionStorage.getItem(CLE_APPAREIL);
    if (!id) {
      id = crypto.randomUUID().slice(0, 12);
      sessionStorage.setItem(CLE_APPAREIL, id);
    }
    return id;
  } catch {
    return 'appareil-inconnu';
  }
}
