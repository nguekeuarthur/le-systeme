import type { RayfinClient } from '@microsoft/rayfin-client';

import type { SystemeSchema } from '../../rayfin/data/schema';

import type { Depot } from './depot';
import type { Activite, Certification, Donnees, Joueur, Nouveau, Oeuvre, Quete } from './types';

const CHAMPS_ACTIVITE = ['id', 'categorie', 'unite', 'quantite', 'xp', 'libelle', 'faiteLe', 'appareil'] as const;
const CHAMPS_OEUVRE = [
  'id',
  'type',
  'format',
  'unite',
  'titre',
  'progression',
  'total',
  'terminee',
  'termineeLe',
  'creeLe',
] as const;

const enDate = (v: unknown) => (v instanceof Date ? v : new Date(String(v)));
const enDateOuNull = (v: unknown) => (v == null ? null : enDate(v));

/** Forme renvoyée par `executePaginated()`. */
interface Page<T> {
  items: T[];
  hasNextPage: boolean;
  endCursor?: string;
}

/** Lit toutes les pages d'une requête (le client ne renvoie qu'une page à la fois). */
async function toutesLesPages<T>(page: (curseur?: string) => Promise<Page<T>>): Promise<T[]> {
  const tout: T[] = [];
  let curseur: string | undefined;
  for (;;) {
    const p = await page(curseur);
    tout.push(...p.items);
    if (!p.hasNextPage || !p.endCursor) return tout;
    curseur = p.endCursor;
  }
}

/** Données dans la base SQL de la Fabric App, filtrées par joueur côté serveur. */
export class DepotRayfin implements Depot {
  readonly mode = 'fabric' as const;

  constructor(private readonly client: RayfinClient<SystemeSchema>) {}

  private get data() {
    return this.client.data;
  }

  private userId(): string {
    const session = this.client.auth.getSession();
    if (!session.isAuthenticated || !session.user) throw new Error('Joueur non connecté.');
    return session.user.id;
  }

  async charger(): Promise<Donnees> {
    const [joueurs, quetes, oeuvres, certifications, activites] = await Promise.all([
      this.data.Joueur.select(['id', 'nom', 'creeLe']).execute(),
      this.data.Quete.select(['id', 'categorie', 'libelle', 'objectif', 'pas', 'ordre'])
        .orderBy({ ordre: 'asc' })
        .execute(),
      toutesLesPages((c) => {
        const q = this.data.Oeuvre.select([...CHAMPS_OEUVRE]).orderBy({ creeLe: 'asc' }).first(500);
        return (c ? q.after(c) : q).executePaginated();
      }),
      toutesLesPages((c) => {
        const q = this.data.Certification.select(['id', 'code', 'intitule', 'obtenueLe'])
          .orderBy({ obtenueLe: 'asc' })
          .first(500);
        return (c ? q.after(c) : q).executePaginated();
      }),
      toutesLesPages((c) => {
        const q = this.data.Activite.select([...CHAMPS_ACTIVITE]).orderBy({ faiteLe: 'asc' }).first(1000);
        return (c ? q.after(c) : q).executePaginated();
      }),
    ]);
    const j = joueurs[0] as Joueur | undefined;
    return {
      joueur: j ? { ...j, creeLe: enDate(j.creeLe) } : null,
      quetes: quetes as Quete[],
      oeuvres: (oeuvres as Oeuvre[]).map((o) => ({
        ...o,
        creeLe: enDate(o.creeLe),
        termineeLe: enDateOuNull(o.termineeLe),
      })),
      certifications: (certifications as Certification[]).map((c) => ({ ...c, obtenueLe: enDate(c.obtenueLe) })),
      activites: (activites as Activite[]).map((a) => ({ ...a, faiteLe: enDate(a.faiteLe) })),
    };
  }

  async creerJoueur(nom: string) {
    await this.data.Joueur.create({ nom, creeLe: new Date(), user_id: this.userId() });
  }

  async creerQuete(q: Nouveau<Quete>) {
    await this.data.Quete.create({ ...q, user_id: this.userId() });
  }

  async ajouterActivite(a: Nouveau<Activite>) {
    const cree = await this.data.Activite.create({ ...a, user_id: this.userId() });
    return { ...a, id: (cree as { id: string }).id };
  }

  async ajouterOeuvre(o: Nouveau<Oeuvre>) {
    const { termineeLe, ...reste } = o;
    const cree = await this.data.Oeuvre.create({
      ...reste,
      ...(termineeLe ? { termineeLe } : {}),
      user_id: this.userId(),
    });
    return { ...o, id: (cree as { id: string }).id };
  }

  async majOeuvre(id: string, changements: Partial<Nouveau<Oeuvre>>) {
    const { termineeLe, ...reste } = changements;
    await this.data.Oeuvre.update({ id }, { ...reste, ...(termineeLe ? { termineeLe } : {}) });
  }

  async ajouterCertification(c: Nouveau<Certification>) {
    const { intitule, ...reste } = c;
    const cree = await this.data.Certification.create({
      ...reste,
      ...(intitule ? { intitule } : {}),
      user_id: this.userId(),
    });
    return { ...c, id: (cree as { id: string }).id };
  }

  async supprimerActivite(id: string) {
    await this.data.Activite.delete({ id });
  }

  async supprimerOeuvre(id: string) {
    await this.data.Oeuvre.delete({ id });
  }

  async supprimerCertification(id: string) {
    await this.data.Certification.delete({ id });
  }

  async activitesDepuis(depuis: Date) {
    const lignes = await this.data.Activite.select([...CHAMPS_ACTIVITE])
      .where({ faiteLe: { gt: depuis } })
      .orderBy({ faiteLe: 'asc' })
      .first(200)
      .execute();
    return (lignes as Activite[]).map((a) => ({ ...a, faiteLe: enDate(a.faiteLe) }));
  }
}
