import type { Depot } from './depot';
import type { Activite, Certification, Donnees, Nouveau, Oeuvre, Quete } from './types';

const CLE = 'le-systeme.donnees.v1';

const vide = (): Donnees => ({
  joueur: null,
  quetes: [],
  oeuvres: [],
  certifications: [],
  activites: [],
});

// Les dates sont stockées en texte ISO : on les reconvertit à la lecture.
const CHAMPS_DATE = new Set(['creeLe', 'termineeLe', 'obtenueLe', 'faiteLe']);
const reviver = (cle: string, valeur: unknown) =>
  CHAMPS_DATE.has(cle) && typeof valeur === 'string' ? new Date(valeur) : valeur;

/** Données gardées dans le navigateur, quand aucune Fabric App n'est configurée. */
export class DepotLocal implements Depot {
  readonly mode = 'hors-ligne' as const;

  private lire(): Donnees {
    try {
      const brut = localStorage.getItem(CLE);
      return brut ? { ...vide(), ...JSON.parse(brut, reviver) } : vide();
    } catch {
      return vide();
    }
  }

  private ecrire(d: Donnees) {
    localStorage.setItem(CLE, JSON.stringify(d));
  }

  private modifier<T>(fn: (d: Donnees) => T): T {
    const d = this.lire();
    const r = fn(d);
    this.ecrire(d);
    return r;
  }

  async charger() {
    return this.lire();
  }

  async creerJoueur(nom: string) {
    this.modifier((d) => {
      d.joueur = { id: crypto.randomUUID(), nom, creeLe: new Date() };
    });
  }

  async creerQuete(q: Nouveau<Quete>) {
    this.modifier((d) => {
      d.quetes.push({ ...q, id: crypto.randomUUID() });
    });
  }

  async ajouterActivite(a: Nouveau<Activite>) {
    const activite = { ...a, id: crypto.randomUUID() };
    this.modifier((d) => d.activites.push(activite));
    return activite;
  }

  async ajouterOeuvre(o: Nouveau<Oeuvre>) {
    const oeuvre = { ...o, id: crypto.randomUUID() };
    this.modifier((d) => d.oeuvres.push(oeuvre));
    return oeuvre;
  }

  async majOeuvre(id: string, changements: Partial<Nouveau<Oeuvre>>) {
    this.modifier((d) => {
      const o = d.oeuvres.find((x) => x.id === id);
      if (o) Object.assign(o, changements);
    });
  }

  async ajouterCertification(c: Nouveau<Certification>) {
    const certif = { ...c, id: crypto.randomUUID() };
    this.modifier((d) => d.certifications.push(certif));
    return certif;
  }

  async supprimerActivite(id: string) {
    this.modifier((d) => {
      d.activites = d.activites.filter((a) => a.id !== id);
    });
  }

  async supprimerOeuvre(id: string) {
    this.modifier((d) => {
      d.oeuvres = d.oeuvres.filter((o) => o.id !== id);
    });
  }

  async supprimerCertification(id: string) {
    this.modifier((d) => {
      d.certifications = d.certifications.filter((c) => c.id !== id);
    });
  }

  async activitesDepuis(depuis: Date) {
    return this.lire().activites.filter((a) => a.faiteLe.getTime() > depuis.getTime());
  }
}
