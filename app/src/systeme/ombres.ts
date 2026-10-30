import * as THREE from 'three';

import type { TypeOeuvre } from './types';

// Les soldats de l'armée des ombres. Chaque type d'œuvre terminée donne une classe :
// un anime donne un chevalier, un manga un assassin, un livre un mage.

export type ClasseOmbre = 'chevalier' | 'assassin' | 'mage';
export const CLASSE_PAR_TYPE: Record<TypeOeuvre, ClasseOmbre> = {
  anime: 'chevalier',
  manga: 'assassin',
  livre: 'mage',
};
export const NOM_CLASSE: Record<ClasseOmbre, string> = {
  chevalier: 'CHEVALIER',
  assassin: 'ASSASSIN',
  mage: 'MAGE',
};

export interface InfoOmbre {
  titre: string;
  type: TypeOeuvre;
}

const NOIR = new THREE.MeshBasicMaterial({ color: 0x040208 });
const NOIR_TISSU = new THREE.MeshBasicMaterial({ color: 0x040208, side: THREE.DoubleSide });
const LUEUR = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xb07cff).multiplyScalar(2.2) });
const OEIL = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xc79bff).multiplyScalar(4) });
const INVISIBLE = new THREE.MeshBasicMaterial({ visible: false });

const G = {
  jambe: new THREE.CylinderGeometry(0.07, 0.06, 0.6, 8),
  torse: new THREE.CylinderGeometry(0.25, 0.18, 0.6, 12),
  robe: new THREE.CylinderGeometry(0.2, 0.46, 1.25, 16),
  manche: new THREE.CylinderGeometry(0.06, 0.13, 0.5, 10),
  epaule: new THREE.SphereGeometry(0.15, 12, 8),
  tete: new THREE.SphereGeometry(0.14, 16, 12),
  capuche: new THREE.SphereGeometry(0.18, 16, 12),
  pointe: new THREE.ConeGeometry(0.12, 0.32, 12),
  corne: new THREE.ConeGeometry(0.035, 0.24, 8),
  oeil: new THREE.SphereGeometry(0.028, 8, 6),
  lame: new THREE.BoxGeometry(0.045, 0.8, 0.012),
  garde: new THREE.BoxGeometry(0.2, 0.035, 0.04),
  dague: new THREE.BoxGeometry(0.03, 0.34, 0.01),
  baton: new THREE.CylinderGeometry(0.018, 0.022, 1.7, 6),
  orbe: new THREE.SphereGeometry(0.075, 16, 12),
  livre: new THREE.BoxGeometry(0.2, 0.03, 0.15),
  cible: new THREE.BoxGeometry(0.9, 1.9, 0.7),
};

interface Tissu {
  mesh: THREE.Mesh;
  base: Float32Array;
  hauteur: number;
}

export interface DonneesOmbre {
  info: InfoOmbre;
  corps: THREE.Group;
  aura: THREE.Sprite;
  yeux: THREE.Mesh[];
  tissus: Tissu[];
  livre?: THREE.Mesh;
  orbe?: THREE.Mesh;
  cible: THREE.Mesh;
  phase: number;
}

function piece(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/** Cape ou écharpe accrochée par le haut, qui ondule dans la boucle de rendu. */
function tissu(largeur: number, hauteur: number): Tissu {
  const geo = new THREE.PlaneGeometry(largeur, hauteur, 6, 10);
  geo.translate(0, -hauteur / 2, 0);
  const mesh = new THREE.Mesh(geo, NOIR_TISSU);
  return { mesh, base: Float32Array.from(geo.attributes.position.array), hauteur };
}

export function construireOmbre(info: InfoOmbre, aura: THREE.Sprite): THREE.Group {
  const classe = CLASSE_PAR_TYPE[info.type];
  const racine = new THREE.Group();
  const corps = new THREE.Group();
  const tissus: Tissu[] = [];
  const yeux = [piece(G.oeil, OEIL, -0.05, 0, 0.125), piece(G.oeil, OEIL, 0.05, 0, 0.125)];
  let livre: THREE.Mesh | undefined;
  let orbe: THREE.Mesh | undefined;

  if (classe === 'chevalier') {
    corps.add(piece(G.jambe, NOIR, -0.1, 0.3), piece(G.jambe, NOIR, 0.1, 0.3), piece(G.torse, NOIR, 0, 0.88));
    const ep1 = piece(G.epaule, NOIR, -0.29, 1.15);
    const ep2 = piece(G.epaule, NOIR, 0.29, 1.15);
    ep1.scale.set(1.25, 0.8, 1);
    ep2.scale.set(1.25, 0.8, 1);
    const c1 = piece(G.corne, NOIR, -0.09, 1.47);
    const c2 = piece(G.corne, NOIR, 0.09, 1.47);
    c1.rotation.z = 0.45;
    c2.rotation.z = -0.45;
    const lame = piece(G.lame, LUEUR, 0.36, 0.62, 0.06);
    lame.rotation.z = 0.12;
    const garde = piece(G.garde, NOIR, 0.31, 1.02, 0.06);
    garde.rotation.z = 0.12;
    const cape = tissu(0.62, 1.05);
    cape.mesh.position.set(0, 1.2, -0.17);
    tissus.push(cape);
    corps.add(ep1, ep2, piece(G.tete, NOIR, 0, 1.33), c1, c2, lame, garde, cape.mesh);
    yeux.forEach((o) => (o.position.y = 1.35));
  } else if (classe === 'assassin') {
    const j1 = piece(G.jambe, NOIR, -0.09, 0.3);
    const j2 = piece(G.jambe, NOIR, 0.09, 0.3);
    j1.scale.x = j2.scale.x = 0.85;
    const torse = piece(G.torse, NOIR, 0, 0.88);
    torse.scale.set(0.82, 1, 0.82);
    const capuche = piece(G.capuche, NOIR, 0, 1.36, -0.05);
    capuche.scale.set(1, 1.12, 1);
    const d1 = piece(G.dague, LUEUR, -0.31, 0.74, 0.1);
    const d2 = piece(G.dague, LUEUR, 0.31, 0.74, 0.1);
    d1.rotation.z = -0.55;
    d2.rotation.z = 0.55;
    const echarpe = tissu(0.2, 0.75);
    echarpe.mesh.position.set(0.1, 1.2, -0.16);
    tissus.push(echarpe);
    corps.add(j1, j2, torse, piece(G.tete, NOIR, 0, 1.31), capuche, d1, d2, echarpe.mesh);
    yeux.forEach((o) => (o.position.y = 1.33));
  } else {
    const m1 = piece(G.manche, NOIR, -0.26, 0.98);
    const m2 = piece(G.manche, NOIR, 0.26, 0.98);
    m1.rotation.z = -0.35;
    m2.rotation.z = 0.35;
    const capuche = piece(G.capuche, NOIR, 0, 1.4, -0.05);
    capuche.scale.set(1, 1.1, 1);
    const pointe = piece(G.pointe, NOIR, 0, 1.6, -0.1);
    pointe.rotation.x = -0.45;
    orbe = piece(G.orbe, LUEUR, 0.4, 1.74, 0.05);
    livre = piece(G.livre, LUEUR, -0.4, 1.0, 0.2);
    const cape = tissu(0.5, 1.1);
    cape.mesh.position.set(0, 1.26, -0.2);
    tissus.push(cape);
    corps.add(
      piece(G.robe, NOIR, 0, 0.62),
      m1,
      m2,
      piece(G.epaule, NOIR, -0.2, 1.2),
      piece(G.epaule, NOIR, 0.2, 1.2),
      piece(G.tete, NOIR, 0, 1.36),
      capuche,
      pointe,
      piece(G.baton, NOIR, 0.4, 0.85, 0.05),
      orbe,
      livre,
      cape.mesh
    );
    yeux.forEach((o) => (o.position.y = 1.38));
  }

  corps.add(...yeux);
  aura.scale.set(1.9, 3, 1);
  aura.position.set(0, 1.05, -0.35);
  const cible = piece(G.cible, INVISIBLE, 0, 0.95);
  racine.add(aura, corps, cible);
  const donnees: DonneesOmbre = { info, corps, aura, yeux, tissus, livre, orbe, cible, phase: Math.random() * 6.28 };
  racine.userData = donnees;
  return racine;
}

/** Respiration, cape au vent, livre et orbe du mage. */
export function animerOmbre(g: THREE.Group, t: number, survolee: boolean) {
  const d = g.userData as DonneesOmbre;
  d.aura.material.opacity = 0.26 + 0.1 * Math.sin(t * 2 + d.phase) + (survolee ? 0.3 : 0);
  d.corps.position.y = Math.sin(t * 1.4 + d.phase) * 0.015;
  for (const ti of d.tissus) {
    const pos = ti.mesh.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const y = ti.base[i * 3 + 1];
      const libre = -y / ti.hauteur;
      pos.setZ(i, ti.base[i * 3 + 2] - libre * (0.08 + 0.06 * Math.sin(t * 2.2 + y * 5 + ti.base[i * 3] * 3 + d.phase)));
    }
    pos.needsUpdate = true;
  }
  if (d.livre) {
    d.livre.rotation.y = t * 0.8 + d.phase;
    d.livre.position.y = 1.0 + Math.sin(t * 2 + d.phase) * 0.04;
  }
  if (d.orbe) d.orbe.scale.setScalar(1 + 0.15 * Math.sin(t * 3 + d.phase));
}
