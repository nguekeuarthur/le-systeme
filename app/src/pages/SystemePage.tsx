import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import { Fenetre, Modale } from '@/components/systeme/Fenetre';
import { FormCertif, FormNom, FormOeuvre } from '@/components/systeme/Formulaires';
import { Journal } from '@/components/systeme/Journal';
import { Radar } from '@/components/systeme/Radar';
import { QrTerminal, Terminal } from '@/components/systeme/Terminal';
import { useAuth } from '@/hooks/AuthContext';
import { creerDepot } from '@/services/depot';
import * as actions from '@/systeme/actions';
import { idAppareil } from '@/systeme/depot';
import { attendre, cine, enfiler, flash, flotter, notifier, taper } from '@/systeme/narrateur';
import {
  calculerVue,
  CERTIF_MONARQUE,
  CERTIF_RANG_S,
  nomRang,
  evenementsEntre,
  pasOeuvre,
  RANGS,
  uniteCourte,
  uniteLongue,
  UNITE_QUETE,
  xpMax,
  type Evenement,
  type Rang,
} from '@/systeme/regles';
import { CLASSE_PAR_TYPE, NOM_CLASSE, type InfoOmbre } from '@/systeme/ombres';
import { creerScene, CYAN, type Scene3D } from '@/systeme/scene';
import { enregistrerReglages, initAudio, parler, reglages, REPLIQUES, sfx, voixDisponible } from '@/systeme/sons';
import type { Activite, Donnees, Oeuvre, Quete } from '@/systeme/types';

import '@/systeme/systeme.css';

const COULEUR_RANG: Record<Rang, number> = {
  E: 0x8a9bb0,
  D: 0x4ade80,
  C: 0x4fd1ff,
  B: 0x9b7bff,
  A: 0xffc857,
  S: 0xff2d55,
  M: 0xa855f7,
};
const hexCss = (h: number) => `#${h.toString(16).padStart(6, '0')}`;
/** Aux rangs d'éveil (S, Monarque), la porte prend la couleur du rang ; sinon elle reste cyan. */
const estEveil = (r: Rang) => r === 'S' || r === 'M';
const teintePorte = (r: Rang) => (estEveil(r) ? COULEUR_RANG[r] : CYAN);
const symboleRang = (r: Rang) => (r === 'M' ? '♛' : r);
const TYPE_LIBELLE = { anime: 'ANIME', manga: 'MANGA', livre: 'LIVRE' } as const;
const FORMAT_LIBELLE = { papier: 'PAPIER', en_ligne: 'EN LIGNE' } as const;
const TEXTE_INTRO = "Vous avez rempli les conditions d'éveil.\nVoulez-vous devenir Joueur ?";
const TEXTE_INTRO_TERMINAL = 'Terminal mobile détecté.\nLe connecter au Système ?';
const CLE_DONNEES_LOCALES = 'le-systeme.donnees.v1';

const CADENAS = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-label="Verrouillé">
    <rect x="5" y="11" width="14" height="10" rx="1" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

const deuxChiffres = (n: number) => String(n).padStart(2, '0');
const dateDuJour = () => {
  const d = new Date();
  return `${deuxChiffres(d.getDate())}.${deuxChiffres(d.getMonth() + 1)}.${d.getFullYear()}`;
};

type Phase = 'chargement' | 'intro' | 'nom' | 'jeu';
/** Valeurs affichées tant qu'une cinématique ne les a pas encore révélées. */
type Retenue = { niveau: number; rang: Rang; ombres: number };
type MajRetenue = (fn: (r: Retenue | null) => Retenue | null) => void;

async function cineRang(scene: Scene3D | null, de: Rang, vers: Rang, simulation = false) {
  const hex = COULEUR_RANG[vers];
  const eveil = estEveil(vers);
  sfx.rang();
  scene?.teinter(hex, 900);
  scene?.pilier(hex);
  scene?.onde(hex, eveil ? 18 : 12, 1800);
  scene?.secouer(eveil ? 0.6 : 0.3);
  flash(`${hexCss(hex)}8c`);
  parler(vers === 'M' ? REPLIQUES.monarque : vers === 'S' ? REPLIQUES.rangS : REPLIQUES.rang);
  const sous =
    vers === 'M'
      ? `Condition remplie : ${CERTIF_MONARQUE} · Éveil du Monarque des ombres`
      : vers === 'S'
        ? `Condition remplie : ${CERTIF_RANG_S} · Rang S atteint`
        : `${nomRang(de)} → <b>${nomRang(vers)}</b>`;
  await cine({
    kicker: simulation ? '[ SIMULATION · RÉÉVALUATION DU CHASSEUR ]' : '[ RÉÉVALUATION DU CHASSEUR ]',
    grand: vers === 'M' ? 'MONARQUE' : vers === 'S' ? 'ÉVEIL' : `RANG ${vers}`,
    sous,
    couleur: hexCss(hex),
    duree: eveil ? 3600 : 2800,
    lettre: symboleRang(vers),
  });
  if (!eveil) scene?.teinter(CYAN, 1600);
}

/** Une ombre par œuvre terminée, de la plus ancienne à la plus récente. */
const listeOmbres = (d: Donnees): InfoOmbre[] =>
  d.oeuvres
    .filter((o) => o.terminee)
    .sort((a, b) => (a.termineeLe?.getTime() ?? 0) - (b.termineeLe?.getTime() ?? 0))
    .map((o) => ({ titre: o.titre, type: o.type }));

/** Met en file les notifications et cinématiques d'un lot d'événements. */
function jouer(evts: Evenement[], scene: Scene3D | null, setRetenue: MajRetenue, oeuvres: Oeuvre[]) {
  const barreXp = () => document.querySelector('.xp-barre');
  for (const e of evts) {
    switch (e.type) {
      case 'progres':
        enfiler(async () => {
          if (e.distant) {
            await notifier(e.libelle, `<b>+${e.xp} XP</b> · saisi sur un autre appareil`, {
              duree: 1300,
              voix: REPLIQUES.distant,
            });
          } else {
            flotter(`+${e.xp} XP`, barreXp());
          }
        });
        break;
      case 'objectif':
        enfiler(async () => {
          flotter(`+${e.xp} XP`, barreXp());
          await notifier(
            `Objectif rempli : ${e.libelle}.`,
            `<b>+${e.xp} XP</b>${e.distant ? ' · saisi sur un autre appareil' : ''}`,
            { voix: REPLIQUES.objectif }
          );
        });
        break;
      case 'quete':
        enfiler(async () => {
          sfx.quete();
          flash('rgba(79,209,255,.35)');
          scene?.onde(CYAN, 9, 1500);
          parler(REPLIQUES.quete);
          await cine({
            kicker: '[ QUÊTE QUOTIDIENNE ]',
            grand: 'ACCOMPLIE',
            sous: `Récompense : <b>+${e.xp} XP</b> · CONSTANCE +3 · Pénalité évitée`,
          });
        });
        break;
      case 'ombre': {
        const type = [...oeuvres].reverse().find((o) => o.terminee && o.titre === e.titre)?.type ?? 'anime';
        const classe = NOM_CLASSE[CLASSE_PAR_TYPE[type]];
        enfiler(async () => {
          await notifier(`Œuvre terminée : ${e.titre}.`, "Extraction d'ombre possible.", {
            couleur: 'var(--ombre)',
            duree: 1300,
            voix: REPLIQUES.oeuvre,
          });
          sfx.ombre();
          scene?.invoquerOmbre({ titre: e.titre, type });
          parler(REPLIQUES.ombre);
          await cine({
            kicker: `[ EXTRACTION D'OMBRE · ${e.titre.toUpperCase()} ]`,
            grand: 'LÈVE-TOI.',
            sous: `Un ${classe.toLowerCase()} rejoint ton armée · <b>+120 XP</b>`,
            couleur: 'var(--ombre)',
            duree: 2800,
          });
          setRetenue((r) => (r ? { ...r, ombres: r.ombres + 1 } : r));
        });
        break;
      }
      case 'certif':
        enfiler(() =>
          notifier(`Certification obtenue : ${e.code}.`, '<b>+300 XP</b> · MAÎTRISE +12', {
            couleur: 'var(--or)',
            voix: REPLIQUES.certif,
          })
        );
        break;
      case 'niveau':
        for (let n = e.de + 1; n <= e.vers; n++) {
          enfiler(async () => {
            sfx.niveau();
            scene?.pilier(0x9fe6ff);
            scene?.onde(CYAN, 12, 1600);
            scene?.secouer(0.25);
            flash('rgba(140,225,255,.5)');
            parler(REPLIQUES.niveau);
            setRetenue((r) => (r ? { ...r, niveau: n } : r));
            await cine({ kicker: '[ SYSTÈME ]', grand: 'NIVEAU SUPÉRIEUR', sous: `Niveau ${n - 1} → <b>${n}</b>`, duree: 2800 });
          });
        }
        break;
      case 'rang':
        enfiler(async () => {
          await cineRang(scene, e.de, e.vers);
          setRetenue((r) => (r ? { ...r, rang: e.vers } : r));
        });
        break;
    }
  }
}

export function SystemePage() {
  const { isAuthenticated, loading, signIn } = useAuth();
  const depot = useMemo(() => creerDepot(), []);
  const appareil = useMemo(() => idAppareil(), []);
  const direct = useMemo(() => location.hash === '#direct', []);
  /** `?telephone` : terminal de saisie mobile, sans scène 3D. */
  const telephone = useMemo(() => new URLSearchParams(location.search).has('telephone'), []);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Scene3D | null>(null);
  const introTxt = useRef<HTMLParagraphElement>(null);
  const donneesRef = useRef<Donnees | null>(null);
  const vus = useRef(new Set<string>());
  const chaine = useRef<Promise<void>>(Promise.resolve());
  const lotsEnCours = useRef(0);
  const demarre = useRef(false);

  const [phase, setPhase] = useState<Phase>('chargement');
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [retenue, setRetenue] = useState<Retenue | null>(null);
  const [ouvertes, setOuvertes] = useState(0);
  const [modale, setModale] = useState<'oeuvre' | 'certif' | 'terminal' | 'journal' | null>(null);
  const [etiquette, setEtiquette] = useState<{ info: InfoOmbre; x: number; y: number } | null>(null);
  const [demo, setDemo] = useState(true);
  const [son, setSon] = useState(reglages.son);
  const [voix, setVoix] = useState(reglages.voix);
  const [erreur, setErreur] = useState<string | null>(null);
  const [introPrete, setIntroPrete] = useState(false);
  const [introFin, setIntroFin] = useState(false);

  const vue = useMemo(() => (donnees ? calculerVue(donnees) : null), [donnees]);

  useEffect(() => {
    document.addEventListener('pointerdown', initAudio, { once: true });
    if (telephone) return;
    const scene = creerScene(canvasRef.current!);
    sceneRef.current = scene;
    scene.surSurvol((info, x, y) => setEtiquette(info ? { info, x, y } : null));
    return () => {
      scene.detruire();
      sceneRef.current = null;
    };
  }, [telephone]);

  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement;
      if (cible.closest('input, textarea, select')) return;
      if (e.key === 'd' || e.key === 'D') setDemo((v) => !v);
    };
    addEventListener('keydown', surTouche);
    return () => removeEventListener('keydown', surTouche);
  }, []);

  /** Lance la partie : fenêtres qui s'ouvrent une à une, puis le message d'accueil. */
  const lancerJeu = useCallback((d: Donnees, delai: number, accueil: { texte: string; voix: string } | null) => {
    const v = calculerVue(d);
    donneesRef.current = d;
    setDonnees(d);
    sceneRef.current?.definirOmbres(listeOmbres(d));
    if (estEveil(v.rang)) sceneRef.current?.teinter(teintePorte(v.rang), 10);
    setPhase('jeu');
    for (let i = 1; i <= 4; i++) {
      setTimeout(() => {
        setOuvertes(i);
        sfx.tick();
      }, delai + (i - 1) * 260);
    }
    if (accueil) {
      setTimeout(
        () => enfiler(() => notifier(accueil.texte, 'Quête quotidienne disponible.', { voix: accueil.voix })),
        delai + 1400
      );
    }
  }, []);

  const entrer = useCallback(
    async (enDirect: boolean) => {
      let d: Donnees;
      try {
        d = await depot.charger();
      } catch (err) {
        setErreur(err instanceof Error ? err.message : 'Chargement impossible.');
        setIntroFin(false);
        return;
      }
      d.activites.forEach((a) => vus.current.add(a.id));
      donneesRef.current = d;
      sceneRef.current?.entrer(enDirect);
      if (!d.joueur) {
        setPhase('nom');
        return;
      }
      if (telephone) {
        lancerJeu(d, 0, { texte: 'Terminal connecté au Système.', voix: REPLIQUES.terminal });
        return;
      }
      lancerJeu(
        d,
        enDirect ? 0 : 2200,
        enDirect ? null : { texte: `Bon retour, Joueur ${d.joueur.nom}.`, voix: REPLIQUES.accueil }
      );
    },
    [depot, lancerJeu, telephone]
  );

  // Fin du contrôle de session : intro, ou entrée directe avec #direct.
  useEffect(() => {
    if (loading || demarre.current) return;
    demarre.current = true;
    if (!direct) {
      setPhase('intro');
      return;
    }
    void (async () => {
      if (!isAuthenticated) {
        if (depot.mode !== 'hors-ligne') {
          setPhase('intro');
          return;
        }
        await signIn();
      }
      await entrer(true);
    })();
  }, [loading, direct, isAuthenticated, depot, signIn, entrer]);

  useEffect(() => {
    if (phase !== 'intro') return;
    let annule = false;
    void (async () => {
      await attendre(500);
      if (annule || !introTxt.current) return;
      await taper(introTxt.current, telephone ? TEXTE_INTRO_TERMINAL : TEXTE_INTRO, 34);
      if (!annule) setIntroPrete(true);
    })();
    return () => {
      annule = true;
    };
  }, [phase, telephone]);

  /** Compare l'avant et l'après d'une écriture, puis joue ce qui s'est passé. */
  const appliquer = useCallback(
    (avantD: Donnees, apresD: Donnees, nouvelles: Activite[]) => {
      const avant = calculerVue(avantD);
      const apres = calculerVue(apresD);
      const evts = evenementsEntre(avant, apres, nouvelles, apresD.quetes, appareil);
      nouvelles.forEach((a) => vus.current.add(a.id));
      const aRetenir = evts.some((e) => e.type === 'niveau' || e.type === 'rang' || e.type === 'ombre');
      if (aRetenir) {
        lotsEnCours.current += 1;
        setRetenue((r) => r ?? { niveau: avant.niveau, rang: avant.rang, ombres: avant.ombres });
      }
      donneesRef.current = apresD;
      setDonnees(apresD);
      jouer(evts, sceneRef.current, setRetenue, apresD.oeuvres);
      if (aRetenir) {
        enfiler(() => {
          lotsEnCours.current -= 1;
          if (lotsEnCours.current === 0) setRetenue(null);
        });
      }
    },
    [appareil]
  );

  /** Les écritures passent une par une : chaque action part de l'état laissé par la précédente. */
  const executer = useCallback(
    (action: (d: Donnees) => Promise<Activite[]>) => {
      chaine.current = chaine.current.then(async () => {
        const avantD = donneesRef.current;
        if (!avantD) return;
        try {
          const nouvelles = await action(avantD);
          appliquer(avantD, await depot.charger(), nouvelles);
        } catch (err) {
          console.error(err);
          enfiler(() =>
            notifier('Erreur du Système.', err instanceof Error ? err.message : String(err), {
              couleur: 'var(--alerte)',
              voix: REPLIQUES.erreur,
            })
          );
        }
      });
      return chaine.current;
    },
    [depot, appliquer]
  );

  // Synchronisation : rejoue ici les actions saisies sur un autre appareil (le téléphone).
  useEffect(() => {
    if (phase !== 'jeu') return;
    const id = setInterval(
      () => {
        if (document.hidden) return;
        chaine.current = chaine.current.then(async () => {
          const d = donneesRef.current;
          if (!d) return;
          const plusRecente = d.activites.reduce((m, a) => Math.max(m, a.faiteLe.getTime()), 0);
          try {
            const recentes = await depot.activitesDepuis(new Date(Math.max(0, plusRecente - 5 * 60_000)));
            const inconnues = recentes.filter((a) => !vus.current.has(a.id));
            if (!inconnues.length) return;
            appliquer(d, await depot.charger(), inconnues);
          } catch (err) {
            console.warn('Synchronisation impossible', err);
          }
        });
      },
      depot.mode === 'fabric' ? 3000 : 1500
    );
    return () => clearInterval(id);
  }, [phase, depot, appliquer]);

  const accepter = async () => {
    initAudio();
    sfx.ping();
    setErreur(null);
    try {
      if (!isAuthenticated) await signIn();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Connexion impossible.');
      return;
    }
    setIntroFin(true);
    await entrer(false);
  };

  const eveiller = async (nom: string) => {
    try {
      await actions.eveillerJoueur(depot, nom);
      const d = await depot.charger();
      d.activites.forEach((a) => vus.current.add(a.id));
      lancerJeu(d, 300, {
        texte: `Bienvenue, Joueur ${d.joueur?.nom ?? nom.toUpperCase()}.`,
        voix: REPLIQUES.bienvenue,
      });
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Échec de l'éveil.");
    }
  };

  const surQuete = (q: Quete) => {
    sfx.tick();
    void executer((d) => actions.avancerQuete(depot, d, q, appareil));
  };
  const surOeuvre = (o: Oeuvre) => {
    sfx.tick();
    void executer((d) => actions.avancerOeuvre(depot, d, o, appareil));
  };
  const surNouvelleOeuvre = async (f: actions.FormulaireOeuvre) => {
    setModale(null);
    await executer(() => actions.ajouterOeuvre(depot, f, appareil));
  };
  const surCertif = async (code: string, intitule: string, obtenueLe: Date) => {
    setModale(null);
    await executer(() => actions.ajouterCertification(depot, code, intitule, obtenueLe, appareil));
  };

  /** Une suppression ne joue pas de cinématique : l'état est simplement recalculé. */
  const corriger = (action: (d: Donnees) => Promise<void>) => {
    chaine.current = chaine.current.then(async () => {
      const avantD = donneesRef.current;
      if (!avantD) return;
      try {
        await action(avantD);
        const apresD = await depot.charger();
        const avant = calculerVue(avantD);
        const apres = calculerVue(apresD);
        donneesRef.current = apresD;
        setDonnees(apresD);
        sceneRef.current?.definirOmbres(listeOmbres(apresD));
        if (avant.rang !== apres.rang) sceneRef.current?.teinter(teintePorte(apres.rang), 1200);
        enfiler(() =>
          notifier('Saisie supprimée.', 'Expérience et caractéristiques recalculées.', { son: 'tick', duree: 1200 })
        );
      } catch (err) {
        console.error(err);
        enfiler(() =>
          notifier('Erreur du Système.', err instanceof Error ? err.message : String(err), {
            couleur: 'var(--alerte)',
            voix: REPLIQUES.erreur,
          })
        );
      }
    });
    return chaine.current;
  };

  /** Joue le prochain éveil (S, puis Monarque) sans rien enregistrer : la chute de la vidéo. */
  const simulerEveil = () => {
    const rangReel = vue?.rang ?? 'E';
    if (rangReel === 'M') return;
    const cible: Rang = rangReel === 'S' ? 'M' : 'S';
    const condition = cible === 'M' ? CERTIF_MONARQUE : CERTIF_RANG_S;
    enfiler(async () => {
      await cineRang(sceneRef.current, rangReel, cible, true);
      await notifier('Simulation terminée.', `Condition d'éveil toujours requise : <b>${condition}</b>`, {
        couleur: 'var(--alerte)',
        voix: REPLIQUES.simulationFin,
      });
      sceneRef.current?.teinter(teintePorte(rangReel), 1500);
    });
  };

  const effacerLocal = () => {
    if (!confirm('Effacer toutes les données gardées dans ce navigateur ?')) return;
    localStorage.removeItem(CLE_DONNEES_LOCALES);
    location.reload();
  };

  const niveau = retenue?.niveau ?? vue?.niveau ?? 1;
  const rang: Rang = retenue?.rang ?? vue?.rang ?? 'E';
  const ombres = retenue?.ombres ?? vue?.ombres ?? 0;
  const enAttenteDeNiveau = !!(retenue && vue && retenue.niveau < vue.niveau);
  const xpPct = !vue ? 0 : enAttenteDeNiveau ? 100 : (100 * vue.xp) / vue.max;
  const xpTxt = !vue ? '' : enAttenteDeNiveau ? `${xpMax(niveau)} / ${xpMax(niveau)} XP` : `${vue.xp} / ${vue.max} XP`;
  const couleurRang = hexCss(COULEUR_RANG[rang]);
  const idxRang = RANGS.indexOf(rang);
  const quetes = donnees ? [...donnees.quetes].sort((a, b) => a.ordre - b.ordre) : [];
  const enCours = donnees ? donnees.oeuvres.filter((o) => !o.terminee) : [];

  return (
    <div className={`systeme${telephone ? ' telephone' : ''}`}>
      {!telephone && <canvas id="scene" ref={canvasRef} />}
      <div id="flash" />

      <header className="barre">
        <div className="marque">
          <span className="losange">◆</span> LE SYSTÈME
          <span className="badge">
            {depot.mode === 'fabric' ? 'Fabric App' : 'Fabric App · hors ligne'}
            {telephone ? ' · terminal' : ''}
          </span>
        </div>
        <div className="barre-droite">
          <span className="date num">{dateDuJour()}</span>
          {phase === 'jeu' && (
            <button type="button" className="puce" onClick={() => setModale('journal')}>
              Journal
            </button>
          )}
          <button
            type="button"
            className={`puce${son ? ' on' : ''}`}
            onClick={() => {
              reglages.son = !reglages.son;
              enregistrerReglages();
              setSon(reglages.son);
            }}
          >
            Son
          </button>
          <button
            type="button"
            className={`puce${voix ? ' on' : ''}`}
            onClick={() => {
              reglages.voix = !reglages.voix;
              enregistrerReglages();
              setVoix(reglages.voix);
              if (!reglages.voix) return;
              if (voixDisponible()) {
                parler(REPLIQUES.voixActivee);
              } else {
                enfiler(() =>
                  notifier(
                    'Aucune voix japonaise sur cet appareil.',
                    'Ouvre l’app dans Edge ou Chrome, ou ajoute la voix japonaise dans les paramètres de Windows.',
                    { couleur: 'var(--alerte)', duree: 3500 }
                  )
                );
              }
            }}
          >
            Voix
          </button>
        </div>
      </header>

      {phase === 'jeu' && vue && telephone && (
        <Terminal
          vue={vue}
          niveau={niveau}
          rang={symboleRang(rang)}
          couleurRang={couleurRang}
          xpPct={xpPct}
          quetes={quetes}
          enCours={enCours}
          surQuete={surQuete}
          surOeuvre={surOeuvre}
          ouvrir={setModale}
        />
      )}

      {phase === 'jeu' && vue && !telephone && (
        <>
          <main className="hud">
            <section className="col">
              <Fenetre titre="STATUT" ouverte={ouvertes >= 1}>
                <div className="s-grille">
                  <div>
                    <div className="lab">NOM</div>
                    <div className="val">{vue.nom}</div>
                  </div>
                  <div>
                    <div className="lab d">NIVEAU</div>
                    <div className="val niveau num">{niveau}</div>
                  </div>
                  <div>
                    <div className="lab">TITRE</div>
                    <div className="val titre">{vue.titre}</div>
                  </div>
                  <div>
                    <div className="lab d">RANG</div>
                    <div className="val rang" style={{ color: couleurRang, textShadow: `0 0 14px ${couleurRang}` }}>
                      {symboleRang(rang)}
                    </div>
                  </div>
                </div>
                <div className="xp">
                  <div className="xp-barre">
                    <div className="xp-rempli" style={{ width: `${xpPct.toFixed(1)}%` }} />
                  </div>
                  <div className="xp-txt">
                    <span>EXPÉRIENCE</span>
                    <span className="num">{xpTxt}</span>
                  </div>
                </div>
                <Radar stats={vue.stats} />
              </Fenetre>

              <Fenetre titre="EN COURS" ouverte={ouvertes >= 3}>
                {enCours.length ? (
                  <ul className="liste">
                    {enCours.map((o) => (
                      <li key={o.id} className="o">
                        <div className="o-haut">
                          <span className="o-type">
                            {TYPE_LIBELLE[o.type]}
                            {o.type !== 'anime' ? ` · ${FORMAT_LIBELLE[o.format]}` : ''}
                          </span>
                          <span className="o-prog num">
                            {uniteCourte(o.unite)} {o.progression}/{o.total}
                          </span>
                        </div>
                        <div className="o-titre">{o.titre}</div>
                        <div className="o-bas">
                          <div className="o-barre">
                            <i style={{ width: `${(100 * o.progression) / o.total}%` }} />
                          </div>
                          <button type="button" className="o-btn" onClick={() => surOeuvre(o)}>
                            +{pasOeuvre(o.unite)} {uniteCourte(o.unite)}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="vide">Aucune œuvre en cours. Ajoute un anime, un manga ou un livre.</p>
                )}
                <button type="button" className="ajouter" onClick={() => setModale('oeuvre')}>
                  + AJOUTER UNE ŒUVRE
                </button>
              </Fenetre>
            </section>

            <section className="col droite">
              <Fenetre titre="QUÊTE QUOTIDIENNE" alerte ouverte={ouvertes >= 2}>
                <p className="q-sous">L'entraînement du Joueur</p>
                <ul className="liste q-liste">
                  {quetes.map((q) => {
                    const fait = vue.progression[q.categorie];
                    const fini = fait >= q.objectif;
                    const u = UNITE_QUETE[q.categorie];
                    return (
                      <li key={q.id} className={`q${fini ? ' fini' : ''}`}>
                        <button
                          type="button"
                          className="q-btn"
                          onClick={() => surQuete(q)}
                          aria-label={`${q.libelle} : ajouter ${q.pas} ${uniteLongue(u, q.pas)}`}
                        >
                          <span className="q-nom">{q.libelle}</span>
                          <span className="q-pts" />
                          <span className="q-val num">
                            [{fait}/{q.objectif} {uniteLongue(u, q.objectif)}]
                          </span>
                          <span className="q-etat">{fini ? '✓' : '+'}</span>
                        </button>
                        <div className="q-barre">
                          <i style={{ width: `${Math.min(100, (100 * fait) / q.objectif)}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <p className="q-avert">⚠ Ne pas accomplir la quête quotidienne entraînera une pénalité.</p>
              </Fenetre>

              <Fenetre titre="RANG DE CHASSEUR" ouverte={ouvertes >= 4}>
                <div className="rangs">
                  {RANGS.map((x, i) => {
                    const cls = i < idxRang ? 'passe' : i === idxRang ? 'actuel' : estEveil(x) ? 'verrou' : 'futur';
                    return (
                      <div
                        key={x}
                        className={`r ${cls}`}
                        style={{ '--rc': hexCss(COULEUR_RANG[x]) } as CSSProperties}
                        title={x === 'M' ? 'Monarque' : `Rang ${x}`}
                      >
                        <i>{cls === 'verrou' ? CADENAS : symboleRang(x)}</i>
                      </div>
                    );
                  })}
                </div>
                {donnees && donnees.certifications.length > 0 && (
                  <div className="certifs">
                    {donnees.certifications.map((c) => (
                      <span key={c.id} className="certif" title={c.intitule ?? undefined}>
                        {c.code}
                      </span>
                    ))}
                  </div>
                )}
                <p className="cond">
                  {rang === 'M' ? (
                    'Monarque éveillé. Rang maximal atteint.'
                  ) : (
                    <>
                      Condition d'éveil du {rang === 'S' ? 'rang Monarque' : 'rang S'} :{' '}
                      <b>certification {rang === 'S' ? CERTIF_MONARQUE : CERTIF_RANG_S}</b>
                    </>
                  )}
                </p>
                <button type="button" className="ajouter" onClick={() => setModale('certif')}>
                  + AJOUTER UNE CERTIFICATION
                </button>
              </Fenetre>
            </section>
          </main>

          <div className="armee">
            ARMÉE DES OMBRES <b className="num">{ombres}</b>
          </div>

          <div className={`demo${demo ? '' : ' cache'}`}>
            <span className="demo-t">
              DÉMO <kbd>D</kbd>
            </span>
            <button type="button" onClick={() => setModale('terminal')}>
              Terminal mobile
            </button>
            {rang !== 'M' && (
              <button type="button" onClick={simulerEveil}>
                Simuler l'éveil ({rang === 'S' ? CERTIF_MONARQUE : CERTIF_RANG_S})
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                location.hash = '';
                location.reload();
              }}
            >
              Rejouer l'intro
            </button>
            {depot.mode === 'hors-ligne' && (
              <button type="button" onClick={effacerLocal}>
                Effacer les données
              </button>
            )}
          </div>
        </>
      )}

      <div id="notif" className="notif" />
      <div id="cine" className="cine" />

      {phase === 'intro' && (
        <div className={`ecran${introFin ? ' fin' : ''}`}>
          <Fenetre titre="NOTIFICATION" ouverte>
            <p className="intro-txt" ref={introTxt} />
            {introPrete && (
              <button type="button" className="btn-sys pulse" onClick={accepter} disabled={introFin}>
                ACCEPTER
              </button>
            )}
            {erreur && <p className="erreur">{erreur}</p>}
          </Fenetre>
        </div>
      )}

      {phase === 'nom' && (
        <div className="ecran">
          <Fenetre titre="INSCRIPTION DU JOUEUR" ouverte>
            <FormNom onValider={eveiller} />
            {erreur && <p className="erreur">{erreur}</p>}
          </Fenetre>
        </div>
      )}

      {modale === 'oeuvre' && (
        <Modale titre="NOUVELLE ŒUVRE" onFermer={() => setModale(null)}>
          <FormOeuvre onValider={surNouvelleOeuvre} />
        </Modale>
      )}
      {modale === 'certif' && (
        <Modale titre="NOUVELLE CERTIFICATION" onFermer={() => setModale(null)}>
          <FormCertif onValider={surCertif} />
        </Modale>
      )}
      {modale === 'journal' && donnees && (
        <Modale titre="JOURNAL DU JOUEUR" onFermer={() => setModale(null)} large>
          <Journal
            donnees={donnees}
            surActivite={(a) => corriger((d) => actions.supprimerActivite(depot, d, a))}
            surOeuvre={(o) => corriger((d) => actions.supprimerOeuvre(depot, d, o))}
            surCertification={(c) => corriger((d) => actions.supprimerCertification(depot, d, c))}
          />
        </Modale>
      )}
      {modale === 'terminal' && (
        <Modale titre="TERMINAL MOBILE" onFermer={() => setModale(null)}>
          <QrTerminal url={`${location.origin}/?telephone`} />
        </Modale>
      )}

      {etiquette && (
        <div className="etiquette-ombre" style={{ left: etiquette.x, top: etiquette.y }}>
          <span className="eo-classe">OMBRE · {NOM_CLASSE[CLASSE_PAR_TYPE[etiquette.info.type]]}</span>
          <span className="eo-titre">{etiquette.info.titre}</span>
        </div>
      )}
    </div>
  );
}
