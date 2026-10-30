import type { Depot } from './depot';
import {
  bonusDejaRecu,
  CATEGORIE_PAR_TYPE,
  memeJour,
  pasOeuvre,
  QUETES_PAR_DEFAUT,
  queteDuJourRemplie,
  uniteCourte,
  uniteLongue,
  UNITE_QUETE,
  XP_CERTIFICATION,
  XP_OEUVRE_TERMINEE,
  XP_QUETE_ACCOMPLIE,
  xpPour,
} from './regles';
import type { Activite, Certification, Donnees, FormatOeuvre, Oeuvre, Quete, TypeOeuvre, UniteOeuvre } from './types';

// Chaque action écrit dans le journal et renvoie les activités créées :
// l'interface en déduit les notifications et cinématiques à jouer.

export async function eveillerJoueur(depot: Depot, nom: string) {
  await depot.creerJoueur(nom.trim().toUpperCase());
  for (const q of QUETES_PAR_DEFAUT) await depot.creerQuete(q);
}

/** Ajoute le bonus de la quête quotidienne si cette action vient de la remplir. */
async function verifierBonus(depot: Depot, d: Donnees, nouvelles: Activite[], appareil: string) {
  const toutes = [...d.activites, ...nouvelles];
  if (queteDuJourRemplie(d.quetes, toutes) && !bonusDejaRecu(toutes)) {
    nouvelles.push(
      await depot.ajouterActivite({
        categorie: 'quete',
        unite: 'aucune',
        quantite: 0,
        xp: XP_QUETE_ACCOMPLIE,
        libelle: 'Quête quotidienne accomplie',
        faiteLe: new Date(),
        appareil,
      })
    );
  }
  return nouvelles;
}

export async function avancerQuete(depot: Depot, d: Donnees, q: Quete, appareil: string) {
  const unite = UNITE_QUETE[q.categorie];
  const a = await depot.ajouterActivite({
    categorie: q.categorie,
    unite,
    quantite: q.pas,
    xp: xpPour(unite, q.pas),
    libelle: `${q.libelle} · +${q.pas} ${uniteLongue(unite, q.pas)}`,
    faiteLe: new Date(),
    appareil,
  });
  return verifierBonus(depot, d, [a], appareil);
}

export async function avancerOeuvre(depot: Depot, d: Donnees, o: Oeuvre, appareil: string) {
  if (o.terminee) return [];
  const progression = Math.min(o.total, o.progression + pasOeuvre(o.unite));
  const quantite = progression - o.progression;
  const finie = progression >= o.total;
  const nouvelles: Activite[] = [];
  await depot.majOeuvre(o.id, finie ? { progression, terminee: true, termineeLe: new Date() } : { progression });
  nouvelles.push(
    await depot.ajouterActivite({
      categorie: CATEGORIE_PAR_TYPE[o.type],
      unite: o.unite,
      quantite,
      xp: xpPour(o.unite, quantite),
      libelle: `${o.titre} · ${uniteCourte(o.unite)} ${progression}`,
      faiteLe: new Date(),
      appareil,
    })
  );
  if (finie) nouvelles.push(await activiteOeuvreTerminee(depot, o.titre, appareil));
  return verifierBonus(depot, d, nouvelles, appareil);
}

const activiteOeuvreTerminee = (depot: Depot, titre: string, appareil: string) =>
  depot.ajouterActivite({
    categorie: 'oeuvre',
    unite: 'aucune',
    quantite: 0,
    xp: XP_OEUVRE_TERMINEE,
    libelle: titre,
    faiteLe: new Date(),
    appareil,
  });

export interface FormulaireOeuvre {
  type: TypeOeuvre;
  format: FormatOeuvre;
  unite: UniteOeuvre;
  titre: string;
  progression: number;
  total: number;
}

/** Une œuvre ajoutée déjà terminée rejoint directement l'armée des ombres. */
export async function ajouterOeuvre(depot: Depot, f: FormulaireOeuvre, appareil: string) {
  const total = Math.max(1, Math.round(f.total));
  const progression = Math.min(total, Math.max(0, Math.round(f.progression)));
  const terminee = progression >= total;
  const titre = f.titre.trim();
  await depot.ajouterOeuvre({
    type: f.type,
    format: f.type === 'anime' ? 'en_ligne' : f.format,
    unite: f.unite,
    titre,
    progression,
    total,
    terminee,
    termineeLe: terminee ? new Date() : null,
    creeLe: new Date(),
  });
  return terminee ? [await activiteOeuvreTerminee(depot, titre, appareil)] : [];
}

/* ---------- Corrections ---------- */
// Le journal sert de source de vérité : supprimer une saisie retire aussi
// l'expérience qui en découlait (bonus de quête, ombre, certification).

const CATEGORIES_QUETE = new Set(['sport', 'lecture', 'anime', 'manga']);

export async function supprimerActivite(depot: Depot, d: Donnees, a: Activite) {
  await depot.supprimerActivite(a.id);
  if (!CATEGORIES_QUETE.has(a.categorie)) return;
  // Si la quête de ce jour-là n'est plus remplie, son bonus disparaît aussi.
  const restantes = d.activites.filter((x) => x.id !== a.id);
  if (queteDuJourRemplie(d.quetes, restantes, a.faiteLe)) return;
  const bonus = restantes.find((x) => x.categorie === 'quete' && memeJour(x.faiteLe, a.faiteLe));
  if (bonus) await depot.supprimerActivite(bonus.id);
}

export async function supprimerOeuvre(depot: Depot, d: Donnees, o: Oeuvre) {
  await depot.supprimerOeuvre(o.id);
  if (!o.terminee) return;
  // L'ombre part avec l'œuvre : on retire l'activité « œuvre terminée » correspondante.
  const fin = [...d.activites].reverse().find((a) => a.categorie === 'oeuvre' && a.libelle === o.titre);
  if (fin) await depot.supprimerActivite(fin.id);
}

export async function supprimerCertification(depot: Depot, d: Donnees, c: Certification) {
  await depot.supprimerCertification(c.id);
  const gain = [...d.activites].reverse().find((a) => a.categorie === 'certification' && a.libelle === c.code);
  if (gain) await depot.supprimerActivite(gain.id);
}

export async function ajouterCertification(
  depot: Depot,
  code: string,
  intitule: string,
  obtenueLe: Date,
  appareil: string
) {
  const c = code.trim().toUpperCase();
  await depot.ajouterCertification({ code: c, intitule: intitule.trim() || null, obtenueLe });
  return [
    await depot.ajouterActivite({
      categorie: 'certification',
      unite: 'aucune',
      quantite: 0,
      xp: XP_CERTIFICATION,
      libelle: c,
      faiteLe: new Date(),
      appareil,
    }),
  ];
}
