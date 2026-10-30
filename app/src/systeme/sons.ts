// Sons synthétisés à la volée (aucun fichier audio) et voix du Système.
// L'interface reste en français ; la voix parle japonais.

let ac: AudioContext | null = null;
let sortie: GainNode | null = null;

const CLE_REGLAGES = 'le-systeme.reglages';
function lireReglages(): { son: boolean; voix: boolean } {
  try {
    return { son: true, voix: false, ...JSON.parse(localStorage.getItem(CLE_REGLAGES) ?? '{}') };
  } catch {
    return { son: true, voix: false };
  }
}
export const reglages = lireReglages();
export function enregistrerReglages() {
  try {
    localStorage.setItem(CLE_REGLAGES, JSON.stringify(reglages));
  } catch {
    // Préférence de confort : sans stockage, on garde simplement les valeurs par défaut.
  }
}

/** À appeler depuis un clic : les navigateurs bloquent l'audio avant un geste. */
export function initAudio() {
  if (ac) return;
  ac = new AudioContext();
  sortie = ac.createGain();
  sortie.gain.value = 0.7;
  sortie.connect(ac.destination);
}

interface OptionsNote {
  type?: OscillatorType;
  vol?: number;
  f2?: number;
}

function note(f: number, t: number, duree: number, { type = 'sine', vol = 0.08, f2 }: OptionsNote = {}) {
  if (!ac || !sortie || !reglages.son) return;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + duree);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  o.connect(g);
  g.connect(sortie);
  o.start(t);
  o.stop(t + duree + 0.05);
}

function souffle(t: number, duree: number, vol: number, de: number, vers: number) {
  if (!ac || !sortie || !reglages.son) return;
  const len = Math.floor(ac.sampleRate * duree);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  const f = ac.createBiquadFilter();
  const g = ac.createGain();
  src.buffer = buf;
  f.type = 'bandpass';
  f.Q.value = 0.8;
  f.frequency.setValueAtTime(de, t);
  f.frequency.exponentialRampToValueAtTime(vers, t + duree);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + duree * 0.2);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  src.connect(f);
  f.connect(g);
  g.connect(sortie);
  src.start(t);
  src.stop(t + duree);
}

const maintenant = () => ac?.currentTime ?? 0;

export const sfx = {
  tick() {
    note(1600, maintenant(), 0.06, { type: 'square', vol: 0.025 });
  },
  ping() {
    const t = maintenant();
    note(988, t, 0.3, { vol: 0.07 });
    note(1480, t + 0.07, 0.45, { vol: 0.06 });
  },
  quete() {
    const t = maintenant();
    [659.25, 783.99, 987.77, 1318.5].forEach((f, i) => note(f, t + i * 0.1, 0.8, { type: 'triangle', vol: 0.07 }));
    souffle(t, 1, 0.06, 600, 3000);
  },
  niveau() {
    const t = maintenant();
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => note(f, t + i * 0.08, 0.7, { type: 'triangle', vol: 0.07 }));
    note(110, t, 1.4, { vol: 0.25, f2: 40 });
    souffle(t, 1.2, 0.08, 400, 4000);
  },
  ombre() {
    const t = maintenant();
    note(70, t, 2.5, { type: 'sawtooth', vol: 0.06, f2: 35 });
    note(140, t, 2.2, { vol: 0.12, f2: 55 });
    souffle(t, 2.4, 0.18, 3000, 150);
  },
  rang() {
    const t = maintenant();
    note(55, t, 2.5, { vol: 0.3, f2: 30 });
    [392, 523.25, 659.25, 783.99].forEach((f, i) => note(f, t + 0.3 + i * 0.12, 1.2, { type: 'triangle', vol: 0.06 }));
    souffle(t, 1.8, 0.12, 200, 5000);
  },
};

/** Répliques du Système, dites en japonais. */
export const REPLIQUES = {
  voixActivee: 'システム音声、起動。',
  accueil: 'おかえりなさい、プレイヤー。デイリークエストが届いています。',
  bienvenue: 'ようこそ、プレイヤー。デイリークエストが届いています。',
  distant: '別のデバイスから記録を受信しました。',
  terminal: '端末、接続完了。',
  objectif: '目標達成。',
  quete: 'デイリークエスト、完了。',
  oeuvre: '作品を制覇しました。影の抽出が可能です。',
  ombre: '起きろ。',
  certif: '資格を獲得しました。',
  niveau: 'レベルアップ。',
  rang: 'ランクアップ。',
  rangS: 'Sランクに、覚醒しました。',
  monarque: '影の君主として、覚醒しました。',
  simulationFin: 'シミュレーション終了。条件、未達成。',
  erreur: 'エラーが発生しました。',
} as const;

// Voix japonaises par ordre de préférence : les voix « Natural » d'Edge,
// puis celle de Chrome, puis n'importe quelle voix japonaise installée.
const PREFERENCES = [/Keita/i, /Nanami/i, /Natural|Online|Neural/i, /Google/i];
let voixJa: SpeechSynthesisVoice | null = null;
if (typeof speechSynthesis !== 'undefined') {
  const choisir = () => {
    const ja = speechSynthesis.getVoices().filter((v) => /^ja/i.test(v.lang));
    voixJa = PREFERENCES.map((p) => ja.find((v) => p.test(v.name))).find(Boolean) ?? ja[0] ?? null;
  };
  choisir();
  speechSynthesis.onvoiceschanged = choisir;
}

/** Une voix japonaise est installée dans ce navigateur. */
export const voixDisponible = () => voixJa !== null;

export function parler(texte: string) {
  if (!reglages.voix || !voixJa) return;
  const u = new SpeechSynthesisUtterance(texte);
  u.lang = 'ja-JP';
  u.voice = voixJa;
  u.pitch = 0.9;
  u.rate = 0.95;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}
