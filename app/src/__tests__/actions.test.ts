import { beforeEach, describe, expect, it } from 'vitest';

import {
  ajouterCertification,
  ajouterOeuvre,
  avancerOeuvre,
  avancerQuete,
  eveillerJoueur,
  supprimerActivite,
  supprimerCertification,
  supprimerOeuvre,
} from '@/systeme/actions';
import { DepotLocal } from '@/systeme/depotLocal';
import { calculerVue, XP_QUETE_ACCOMPLIE } from '@/systeme/regles';

describe('actions du joueur (dépôt local)', () => {
  let depot: DepotLocal;

  beforeEach(async () => {
    depot = new DepotLocal();
    await eveillerJoueur(depot, 'arthur');
  });

  it('crée le joueur et les quatre quêtes par défaut', async () => {
    const d = await depot.charger();
    expect(d.joueur?.nom).toBe('ARTHUR');
    expect(d.quetes).toHaveLength(4);
    expect(d.joueur?.creeLe).toBeInstanceOf(Date);
  });

  it('donne le bonus une seule fois quand toutes les quêtes du jour sont remplies', async () => {
    for (;;) {
      const d = await depot.charger();
      const q = d.quetes.find((x) => calculerVue(d).progression[x.categorie] < x.objectif);
      if (!q) break;
      await avancerQuete(depot, d, q, 'ici');
    }
    let d = await depot.charger();
    expect(d.activites.filter((a) => a.categorie === 'quete')).toHaveLength(1);
    expect(d.activites.find((a) => a.categorie === 'quete')?.xp).toBe(XP_QUETE_ACCOMPLIE);

    await avancerQuete(depot, d, d.quetes[0], 'ici');
    d = await depot.charger();
    expect(d.activites.filter((a) => a.categorie === 'quete')).toHaveLength(1);
  });

  it("termine une œuvre et l'ajoute à l'armée des ombres", async () => {
    await ajouterOeuvre(
      depot,
      { type: 'anime', format: 'papier', unite: 'episode', titre: 'Frieren', progression: 27, total: 28 },
      'ici'
    );
    let d = await depot.charger();
    expect(d.oeuvres[0].format).toBe('en_ligne');
    const nouvelles = await avancerOeuvre(depot, d, d.oeuvres[0], 'ici');
    expect(nouvelles.map((a) => a.categorie)).toEqual(['anime', 'oeuvre']);
    d = await depot.charger();
    expect(d.oeuvres[0].terminee).toBe(true);
    expect(calculerVue(d).ombres).toBe(1);
  });

  it('une œuvre ajoutée déjà terminée donne directement une ombre', async () => {
    const nouvelles = await ajouterOeuvre(
      depot,
      { type: 'manga', format: 'papier', unite: 'tome', titre: 'Vagabond', progression: 0, total: 37 },
      'ici'
    );
    expect(nouvelles).toEqual([]);
    const fini = await ajouterOeuvre(
      depot,
      { type: 'livre', format: 'papier', unite: 'page', titre: 'Atomic Habits', progression: 320, total: 320 },
      'ici'
    );
    expect(fini.map((a) => a.categorie)).toEqual(['oeuvre']);
  });

  it('supprimer une saisie retire le bonus si la quête du jour n’est plus remplie', async () => {
    for (;;) {
      const d = await depot.charger();
      const q = d.quetes.find((x) => calculerVue(d).progression[x.categorie] < x.objectif);
      if (!q) break;
      await avancerQuete(depot, d, q, 'ici');
    }
    let d = await depot.charger();
    const sport = d.activites.find((a) => a.categorie === 'sport')!;
    await supprimerActivite(depot, d, sport);
    d = await depot.charger();
    expect(d.activites.some((a) => a.categorie === 'quete')).toBe(false);
    expect(calculerVue(d).queteRemplie).toBe(false);
  });

  it('supprimer une œuvre terminée retire son ombre, et une certification son rang', async () => {
    await ajouterOeuvre(
      depot,
      { type: 'anime', format: 'en_ligne', unite: 'episode', titre: 'Frieren', progression: 28, total: 28 },
      'ici'
    );
    await ajouterCertification(depot, 'DP-600', '', new Date(), 'ici');
    let d = await depot.charger();
    expect(calculerVue(d)).toMatchObject({ ombres: 1, rang: 'S' });

    await supprimerOeuvre(depot, d, d.oeuvres[0]);
    d = await depot.charger();
    await supprimerCertification(depot, d, d.certifications[0]);
    d = await depot.charger();
    expect(calculerVue(d)).toMatchObject({ ombres: 0, rang: 'E', xpTotal: 0 });
  });

  it('les certifications font monter le rang', async () => {
    for (const code of ['az-900', 'DP-900', 'PL-300', 'DP-700']) {
      await ajouterCertification(depot, code, '', new Date(), 'ici');
    }
    const d = await depot.charger();
    expect(d.certifications.map((c) => c.code)).toContain('AZ-900');
    expect(calculerVue(d).rang).toBe('A');
  });
});
