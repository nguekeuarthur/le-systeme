import { describe, expect, it } from 'vitest';

import {
  calculerVue,
  evenementsEntre,
  niveauDepuisXp,
  QUETES_PAR_DEFAUT,
  rangDepuisCertifs,
  xpMax,
} from '@/systeme/regles';
import type { Activite, Donnees } from '@/systeme/types';

const quetes = QUETES_PAR_DEFAUT.map((q, i) => ({ ...q, id: `q${i}` }));
const base = (): Donnees => ({
  joueur: { id: 'j', nom: 'ARTHUR', creeLe: new Date() },
  quetes,
  oeuvres: [],
  certifications: [],
  activites: [],
});
let n = 0;
const act = (a: Partial<Activite>): Activite => ({
  id: `a${n++}`,
  categorie: 'sport',
  unite: 'minute',
  quantite: 10,
  xp: 20,
  libelle: 'Sport',
  faiteLe: new Date(),
  appareil: 'ici',
  ...a,
});

describe('niveaux', () => {
  it('passe au niveau suivant au seuil exact', () => {
    expect(niveauDepuisXp(0)).toEqual({ niveau: 1, xp: 0, max: xpMax(1) });
    expect(niveauDepuisXp(xpMax(1))).toEqual({ niveau: 2, xp: 0, max: xpMax(2) });
    expect(niveauDepuisXp(xpMax(1) + xpMax(2) + 5).niveau).toBe(3);
  });
});

describe('rangs', () => {
  it('monte avec le nombre de certifications, la DP-600 donne S et l’AI-103 Monarque', () => {
    expect(rangDepuisCertifs([])).toBe('E');
    expect(rangDepuisCertifs(['AZ-900', 'DP-900', 'PL-300'])).toBe('B');
    expect(rangDepuisCertifs(['A', 'B', 'C', 'D', 'E', 'F'])).toBe('A');
    expect(rangDepuisCertifs(['dp-600'])).toBe('S');
    expect(rangDepuisCertifs(['DP-600', 'DP-700', 'ai-103'])).toBe('M');
    // Le rang Monarque se construit sur le rang S.
    expect(rangDepuisCertifs(['AI-103'])).toBe('D');
  });
});

describe('vue du joueur', () => {
  it("compte la progression du jour seulement, et les tomes en chapitres", () => {
    const hier = new Date(Date.now() - 86_400_000);
    const d = base();
    d.activites = [
      act({ quantite: 20 }),
      act({ quantite: 30, faiteLe: hier }),
      act({ categorie: 'manga', unite: 'tome', quantite: 1, xp: 50 }),
    ];
    const v = calculerVue(d);
    expect(v.progression.sport).toBe(20);
    expect(v.progression.manga).toBe(8);
    expect(v.queteRemplie).toBe(false);
  });

  it('additionne toute l’expérience du journal', () => {
    const d = base();
    d.activites = [act({ xp: 300 }), act({ categorie: 'certification', unite: 'aucune', quantite: 0, xp: 300 })];
    expect(calculerVue(d).xpTotal).toBe(600);
  });
});

describe('événements', () => {
  it("annonce l'objectif rempli, la quête accomplie et la montée de niveau", () => {
    const avantD = base();
    avantD.activites = [
      act({ quantite: 20, xp: 380 }),
      act({ categorie: 'lecture', unite: 'page', quantite: 20, xp: 0 }),
      act({ categorie: 'anime', unite: 'episode', quantite: 1, xp: 0 }),
      act({ categorie: 'manga', unite: 'chapitre', quantite: 3, xp: 0 }),
    ];
    const nouvelles = [
      act({ quantite: 10, xp: 20, appareil: 'telephone' }),
      act({ categorie: 'quete', unite: 'aucune', quantite: 0, xp: 150, appareil: 'telephone' }),
    ];
    const apresD = { ...avantD, activites: [...avantD.activites, ...nouvelles] };
    const evts = evenementsEntre(calculerVue(avantD), calculerVue(apresD), nouvelles, quetes, 'ecran');
    expect(evts.map((e) => e.type)).toEqual(['objectif', 'quete', 'niveau']);
    expect(evts[0]).toMatchObject({ type: 'objectif', libelle: 'Sport', distant: true });
  });
});
