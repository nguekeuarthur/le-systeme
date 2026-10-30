import { parler, sfx } from './sons';

// Notifications et cinématiques du Système. Elles passent une par une,
// dans l'ordre, même quand plusieurs actions arrivent en même temps.

export const attendre = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const file: (() => Promise<void>)[] = [];
let enCours = false;

export function enfiler(etape: () => Promise<void> | void) {
  file.push(async () => {
    await etape();
  });
  if (!enCours) void vider();
}

async function vider() {
  enCours = true;
  while (file.length) {
    try {
      await file.shift()!();
    } catch (e) {
      console.error(e);
    }
  }
  enCours = false;
}

const el = (id: string) => document.getElementById(id);

export async function taper(cible: HTMLElement, texte: string, vitesse = 22) {
  cible.textContent = '';
  for (const ch of texte) {
    cible.textContent += ch;
    if (ch !== ' ') await attendre(vitesse);
  }
}

interface OptionsNotif {
  duree?: number;
  son?: keyof typeof sfx;
  couleur?: string;
  /** Réplique japonaise dite par la voix du Système. */
  voix?: string;
}

export async function notifier(titre: string, detail = '', { duree = 1900, son = 'ping', couleur, voix }: OptionsNotif = {}) {
  const n = el('notif');
  if (!n) return;
  n.style.setProperty('--nc', couleur ?? 'var(--sys)');
  n.innerHTML = `<div class="n-tete">[ ! ] SYSTÈME</div><div class="n-corps"></div>${detail ? `<div class="n-detail">${detail}</div>` : ''}`;
  n.classList.add('show');
  sfx[son]();
  if (voix) parler(voix);
  await taper(n.querySelector('.n-corps') as HTMLElement, titre, 16);
  await attendre(duree);
  n.classList.remove('show');
  await attendre(280);
}

interface OptionsCine {
  kicker: string;
  grand: string;
  sous?: string;
  couleur?: string;
  duree?: number;
  lettre?: string;
}

export async function cine({ kicker, grand, sous = '', couleur = 'var(--sys)', duree = 2600, lettre = '' }: OptionsCine) {
  const c = el('cine');
  if (!c) return;
  c.style.setProperty('--c', couleur);
  c.innerHTML = `${lettre ? `<div class="c-lettre">${lettre}</div>` : ''}<div class="c-kicker">${kicker}</div><div class="c-grand">${grand}</div>${sous ? `<div class="c-sous">${sous}</div>` : ''}`;
  c.classList.add('show');
  await attendre(duree);
  c.classList.remove('show');
  await attendre(450);
}

export function flash(couleur: string) {
  el('flash')?.animate([{ opacity: 0.85, background: couleur }, { opacity: 0, background: couleur }], {
    duration: 900,
    easing: 'ease-out',
  });
}

/** Petit texte qui s'envole au-dessus d'un élément (« +60 XP »). */
export function flotter(texte: string, ancre: Element | null, couleur = 'var(--sys)') {
  if (!ancre) return;
  const r = ancre.getBoundingClientRect();
  const s = document.createElement('div');
  s.className = 'flotte';
  s.textContent = texte;
  s.style.color = couleur;
  s.style.left = `${r.left + r.width / 2}px`;
  s.style.top = `${r.top + r.height * 0.4}px`;
  document.body.appendChild(s);
  s.animate(
    [
      { transform: 'translate(-50%, 0)', opacity: 0 },
      { transform: 'translate(-50%, -10px)', opacity: 1, offset: 0.2 },
      { transform: 'translate(-50%, -48px)', opacity: 0 },
    ],
    { duration: 1600, easing: 'ease-out' }
  ).onfinish = () => s.remove();
}
