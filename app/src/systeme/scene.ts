import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { animerOmbre, construireOmbre, type DonneesOmbre, type InfoOmbre } from './ombres';

export const CYAN = 0x4fd1ff;
const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);

export interface Scene3D {
  /** Fait entrer la caméra dans la scène (ou la place directement). */
  entrer(direct: boolean): void;
  /** Place l'armée sans animation : une ombre par œuvre terminée. */
  definirOmbres(liste: InfoOmbre[]): void;
  /** Fait sortir une nouvelle ombre du sol. */
  invoquerOmbre(info: InfoOmbre): void;
  /** Prévient quand la souris passe sur une ombre (null quand elle la quitte). */
  surSurvol(rappel: (info: InfoOmbre | null, x: number, y: number) => void): void;
  pilier(couleur: number): void;
  onde(couleur: number, echelle?: number, duree?: number): void;
  teinter(couleur: number, duree?: number): void;
  secouer(force: number): void;
  detruire(): void;
}

function texRadiale(arrets: [number, string][]) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const d = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  arrets.forEach(([o, col]) => d.addColorStop(o, col));
  g.fillStyle = d;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const VERTEX_UV = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export function creerScene(canvas: HTMLCanvasElement): Scene3D {
  const mobile = matchMedia('(max-width: 900px)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x02040a);
  scene.fog = new THREE.FogExp2(0x02040a, 0.045);
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 200);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.85, 0.55, 0.22));
  composer.addPass(new OutputPass());

  const texPoint = texRadiale([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,.6)'], [1, 'rgba(255,255,255,0)']]);
  const texHalo = texRadiale([[0, 'rgba(255,255,255,.9)'], [0.35, 'rgba(255,255,255,.25)'], [1, 'rgba(255,255,255,0)']]);

  // Sol : grille lumineuse avec une onde qui part de la porte
  const solMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(CYAN) } },
    vertexShader: `varying vec3 vPos;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vPos = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uColor; varying vec3 vPos;
      float ligne(vec2 p, float s, float w){ vec2 q = p / s; vec2 g = abs(fract(q - 0.5) - 0.5) / (fwidth(q) * w); return 1.0 - min(min(g.x, g.y), 1.0); }
      void main(){
        vec2 p = vPos.xz;
        float d = length(p - vec2(0.0, -1.5));
        float g = ligne(p, 1.0, 1.0) * 0.35 + ligne(p, 4.0, 1.5) * 0.6;
        float fondu = smoothstep(26.0, 3.0, d);
        float onde = 0.55 + 0.45 * sin(d * 0.9 - uTime * 1.6);
        float halo = smoothstep(6.0, 0.0, d) * 0.25;
        gl_FragColor = vec4(uColor * (g * fondu * onde * 0.9 + halo), 1.0);
      }`,
  });
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), solMat);
  sol.rotation.x = -Math.PI / 2;
  scene.add(sol);

  const haloMat = new THREE.MeshBasicMaterial({ map: texHalo, color: new THREE.Color(CYAN), transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), haloMat);
  halo.rotation.x = -Math.PI / 2;
  halo.position.set(0, 0.02, -1.5);
  scene.add(halo);

  // La porte : anneaux, runes et vortex
  const porte = new THREE.Group();
  porte.position.set(0, 2.6, -1.5);
  scene.add(porte);
  const anneauMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(CYAN).multiplyScalar(3) });
  porte.add(new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.05, 16, 220), anneauMat));
  const anneau2 = new THREE.Mesh(new THREE.TorusGeometry(2.75, 0.012, 8, 220), anneauMat);
  porte.add(anneau2);
  const runeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(CYAN).multiplyScalar(2), transparent: true, opacity: 0.85 });
  const runes = new THREE.Group();
  porte.add(runes);
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.035, i % 5 === 0 ? 0.3 : 0.14), runeMat);
    m.position.set(Math.cos(a) * 2.47, Math.sin(a) * 2.47, 0);
    m.rotation.z = a - Math.PI / 2;
    runes.add(m);
  }
  const vortexMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uA: { value: new THREE.Color(CYAN) }, uB: { value: new THREE.Color(0x1a1060) } },
    vertexShader: VERTEX_UV,
    fragmentShader: `uniform float uTime; uniform vec3 uA; uniform vec3 uB; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1.0, 0.0)), u.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), u.x), u.y); }
      float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * n(p); p *= 2.03; a *= 0.5; } return v; }
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float s = atan(p.y, p.x) + r * 4.0 - uTime * 0.7;
        vec2 q = vec2(cos(s), sin(s)) * (0.6 + r * 2.2);
        float v = fbm(q * 1.6 + vec2(uTime * 0.12, -uTime * 0.08));
        float bande = smoothstep(0.45, 0.75, v);
        vec3 c = mix(uB * 0.6, uA, bande) * (0.12 + 0.75 * v * v);
        c += uA * pow(max(0.0, 1.0 - r), 6.0) * 0.45;
        c += uA * smoothstep(0.86, 1.0, r) * 0.5;
        float alpha = smoothstep(1.0, 0.94, r) * 0.9;
        gl_FragColor = vec4(c * alpha, alpha);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  porte.add(new THREE.Mesh(new THREE.CircleGeometry(2.18, 128), vortexMat));

  // Lumières
  scene.add(new THREE.HemisphereLight(0x223a66, 0x05020a, 0.5));
  const lumPorte = new THREE.PointLight(CYAN, 24, 0, 2);
  lumPorte.position.set(0, 2.6, -0.6);
  scene.add(lumPorte);
  for (const cote of [-1, 1]) {
    const l = new THREE.PointLight(0x8b5cf6, 18, 0, 2);
    l.position.set(cote * 5.5, 2.5, -4);
    scene.add(l);
  }
  const lumInvocation = new THREE.PointLight(0xb07cff, 0, 0, 2);
  scene.add(lumInvocation);

  // Particules de mana qui montent
  const N = mobile ? 700 : 1600;
  const partPos = new Float32Array(N * 3);
  const partVit = new Float32Array(N);
  const partCol = new Float32Array(N * 3);
  const cA = new THREE.Color(0x7fdcff);
  const cB = new THREE.Color(0xa78bfa);
  for (let i = 0; i < N; i++) {
    const r = 2 + Math.random() * 16;
    const a = Math.random() * Math.PI * 2;
    partPos.set([Math.cos(a) * r, Math.random() * 10, Math.sin(a) * r - 2], i * 3);
    partVit[i] = 0.15 + Math.random() * 0.5;
    const c = Math.random() < 0.75 ? cA : cB;
    partCol.set([c.r, c.g, c.b], i * 3);
  }
  const partGeo = new THREE.BufferGeometry();
  partGeo.setAttribute('position', new THREE.BufferAttribute(partPos, 3));
  partGeo.setAttribute('color', new THREE.BufferAttribute(partCol, 3));
  const partMat = new THREE.PointsMaterial({ size: 0.09, map: texPoint, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  scene.add(new THREE.Points(partGeo, partMat));

  // Gerbe violette de l'extraction d'ombre
  const BURST_N = 500;
  const burstPos = new Float32Array(BURST_N * 3);
  const burstVit = new Float32Array(BURST_N * 3);
  const burstGeo = new THREE.BufferGeometry();
  burstGeo.setAttribute('position', new THREE.BufferAttribute(burstPos, 3));
  const burstMat = new THREE.PointsMaterial({ size: 0.1, map: texPoint, color: new THREE.Color(0xb07cff).multiplyScalar(2), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const burst = new THREE.Points(burstGeo, burstMat);
  burst.frustumCulled = false;
  scene.add(burst);
  let burstVie = 0;

  // Pilier de lumière
  const pilierMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uO: { value: 0 }, uC: { value: new THREE.Color(0x9fe6ff) } },
    vertexShader: VERTEX_UV,
    fragmentShader: `uniform float uTime; uniform float uO; uniform vec3 uC; varying vec2 vUv;
      void main(){ float a = pow(1.0 - vUv.y, 1.4) * (0.7 + 0.3 * sin(vUv.y * 60.0 - uTime * 14.0)); gl_FragColor = vec4(uC * 2.5 * a * uO, a * uO); }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const pilierMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 16, 48, 1, true), pilierMat);
  pilierMesh.position.set(0, 8, -1.5);
  pilierMesh.visible = false;
  scene.add(pilierMesh);

  // Armée des ombres : une silhouette par œuvre terminée (voir ombres.ts)
  const slots: { x: number; z: number }[] = [];
  for (let rangee = 0; rangee < 4; rangee++) {
    for (let col = 0; col < 5; col++) {
      for (const cote of [-1, 1]) slots.push({ x: cote * (3.4 + col * 1.05 + rangee * 0.35), z: 0.8 - rangee * 1.45 - col * 0.35 });
    }
  }
  const ombres: THREE.Group[] = [];

  function creerOmbre(slot: { x: number; z: number }, info: InfoOmbre) {
    const aura = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texHalo, color: 0x7c3aed, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    const g = construireOmbre(info, aura);
    g.scale.setScalar(1.08 + Math.random() * 0.2);
    g.position.set(slot.x, 0, slot.z);
    g.rotation.y = Math.atan2(-slot.x, 11 - slot.z);
    scene.add(g);
    ombres.push(g);
    return g;
  }

  function retirerOmbre() {
    const g = ombres.pop();
    if (!g) return;
    scene.remove(g);
    (g.userData as DonneesOmbre).aura.material.dispose();
    for (const t of (g.userData as DonneesOmbre).tissus) t.mesh.geometry.dispose();
  }

  // Fumée violette qui s'élève lentement de l'armée
  const FUMEE_N = mobile ? 120 : 260;
  const fumeePos = new Float32Array(FUMEE_N * 3);
  const fumeeVie = new Float32Array(FUMEE_N);
  const fumeeGeo = new THREE.BufferGeometry();
  fumeeGeo.setAttribute('position', new THREE.BufferAttribute(fumeePos, 3));
  const fumeeMat = new THREE.PointsMaterial({ size: 0.16, map: texPoint, color: new THREE.Color(0x7c3aed).multiplyScalar(1.3), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
  const fumee = new THREE.Points(fumeeGeo, fumeeMat);
  fumee.frustumCulled = false;
  scene.add(fumee);
  function relancerFumee(i: number) {
    const g = ombres[Math.floor(Math.random() * ombres.length)];
    if (!g) {
      fumeePos[i * 3 + 1] = -10;
      return;
    }
    fumeePos.set([g.position.x + (Math.random() - 0.5) * 0.7, Math.random() * 0.4, g.position.z + (Math.random() - 0.5) * 0.5], i * 3);
    fumeeVie[i] = 1.5 + Math.random() * 2.5;
  }

  // Survol : quelle ombre est sous la souris ?
  const rayon = new THREE.Raycaster();
  const souris = new THREE.Vector2();
  let survolee: THREE.Group | null = null;
  let rappelSurvol: ((info: InfoOmbre | null, x: number, y: number) => void) | null = null;
  const surMouvement = (e: PointerEvent) => {
    souris.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    rayon.setFromCamera(souris, camera);
    const touche = rayon.intersectObjects(ombres.map((g) => (g.userData as DonneesOmbre).cible), false)[0];
    survolee = touche ? (touche.object.parent as THREE.Group) : null;
    canvas.style.cursor = survolee ? 'pointer' : '';
    rappelSurvol?.(survolee ? (survolee.userData as DonneesOmbre).info : null, e.clientX, e.clientY);
  };
  const surSortie = () => {
    survolee = null;
    rappelSurvol?.(null, 0, 0);
  };
  canvas.addEventListener('pointermove', surMouvement);
  canvas.addEventListener('pointerleave', surSortie);

  // Petites animations pilotées par la boucle de rendu
  type Anim = { t0: number; duree: number; maj: (p: number) => void; fin?: () => void };
  const anims: Anim[] = [];
  const animer = (duree: number, maj: Anim['maj'], fin?: Anim['fin']) => anims.push({ t0: performance.now(), duree, maj, fin });
  let camR = 24;
  let camH = 7.5;
  let secousse = 0;

  const couleurPorte = new THREE.Color(CYAN);
  function appliquerCouleur(c: THREE.Color) {
    anneauMat.color.copy(c).multiplyScalar(3);
    runeMat.color.copy(c).multiplyScalar(2);
    vortexMat.uniforms.uA.value.copy(c);
    lumPorte.color.copy(c);
    haloMat.color.copy(c);
    solMat.uniforms.uColor.value.copy(c);
  }

  function onde(couleur: number, echelle = 10, duree = 1400, x = 0, z = -1.5) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.92, 1, 96),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(couleur).multiplyScalar(3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.04, z);
    scene.add(m);
    animer(
      duree,
      (p) => {
        m.scale.setScalar(0.2 + easeOut(p) * echelle);
        m.material.opacity = 1 - p;
      },
      () => {
        scene.remove(m);
        m.geometry.dispose();
        m.material.dispose();
      }
    );
  }

  const surRedim = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
  };
  addEventListener('resize', surRedim);

  const horloge = new THREE.Clock();
  let raf = 0;
  function boucle() {
    raf = requestAnimationFrame(boucle);
    const dt = Math.min(horloge.getDelta(), 0.05);
    const t = horloge.elapsedTime;
    const now = performance.now();
    for (let i = anims.length - 1; i >= 0; i--) {
      const a = anims[i];
      const p = Math.min(1, (now - a.t0) / a.duree);
      a.maj(p);
      if (p >= 1) {
        anims.splice(i, 1);
        a.fin?.();
      }
    }
    const ang = Math.sin(t * 0.07) * 0.28;
    camera.position.set(Math.sin(ang) * camR, camH + Math.sin(t * 0.13) * 0.15, Math.cos(ang) * camR - 1);
    if (secousse > 0.001) {
      camera.position.x += (Math.random() - 0.5) * secousse;
      camera.position.y += (Math.random() - 0.5) * secousse;
      secousse *= Math.pow(0.04, dt);
    }
    camera.lookAt(0, 2.3, -1.5);

    vortexMat.uniforms.uTime.value = t;
    solMat.uniforms.uTime.value = t;
    pilierMat.uniforms.uTime.value = t;
    runes.rotation.z = t * 0.15;
    anneau2.rotation.z = -t * 0.1;
    lumPorte.intensity = 24 + Math.sin(t * 2.2) * 5;

    for (let i = 0; i < N; i++) {
      partPos[i * 3 + 1] += partVit[i] * dt;
      partPos[i * 3] += Math.sin(t + i) * 0.002;
      if (partPos[i * 3 + 1] > 10) partPos[i * 3 + 1] = 0;
    }
    partGeo.attributes.position.needsUpdate = true;

    if (burstVie > 0) {
      burstVie -= dt;
      for (let i = 0; i < BURST_N * 3; i += 3) {
        burstPos[i] += burstVit[i] * dt;
        burstPos[i + 1] += burstVit[i + 1] * dt;
        burstPos[i + 2] += burstVit[i + 2] * dt;
        burstVit[i + 1] *= 0.985;
      }
      burstGeo.attributes.position.needsUpdate = true;
      burstMat.opacity = Math.max(0, burstVie / 2.4);
    }

    for (const g of ombres) animerOmbre(g, t, g === survolee);
    for (let i = 0; i < FUMEE_N; i++) {
      fumeeVie[i] -= dt;
      if (fumeeVie[i] <= 0) relancerFumee(i);
      else {
        fumeePos[i * 3 + 1] += dt * 0.35;
        fumeePos[i * 3] += Math.sin(t * 0.8 + i) * dt * 0.05;
      }
    }
    fumeeGeo.attributes.position.needsUpdate = true;
    composer.render();
  }
  boucle();

  return {
    entrer(direct) {
      animer(direct ? 1 : 4200, (p) => {
        const e = easeInOut(p);
        camR = 24 + (11.5 - 24) * e;
        camH = 7.5 + (3.4 - 7.5) * e;
      });
    },
    definirOmbres(liste) {
      while (ombres.length) retirerOmbre();
      liste.slice(-slots.length).forEach((info, i) => creerOmbre(slots[i], info));
    },
    invoquerOmbre(info) {
      // Armée complète : la plus ancienne ombre laisse sa place à la nouvelle.
      let slot = slots[ombres.length];
      if (ombres.length >= slots.length) {
        const ancienne = ombres.shift()!;
        slot = { x: ancienne.position.x, z: ancienne.position.z };
        scene.remove(ancienne);
      }
      const g = creerOmbre(slot, info);
      g.position.y = -2.2;
      const yeux = (g.userData as DonneesOmbre).yeux;
      yeux.forEach((o) => o.scale.setScalar(0.001));
      for (let i = 0; i < BURST_N; i++) {
        burstPos.set([slot.x + (Math.random() - 0.5) * 0.8, Math.random() * 0.4, slot.z + (Math.random() - 0.5) * 0.8], i * 3);
        burstVit.set([(Math.random() - 0.5) * 1.4, 1 + Math.random() * 3.2, (Math.random() - 0.5) * 1.4], i * 3);
      }
      burstGeo.attributes.position.needsUpdate = true;
      burstVie = 2.4;
      onde(0xb07cff, 3, 2200, slot.x, slot.z);
      lumInvocation.position.set(slot.x, 1.5, slot.z + 0.6);
      secousse = 0.18;
      animer(
        2200,
        (p) => {
          g.position.y = -2.2 + 2.2 * easeOut(p);
          lumInvocation.intensity = 60 * Math.sin(Math.PI * Math.min(1, p * 1.2));
        },
        () => {
          g.position.y = 0;
          lumInvocation.intensity = 0;
          animer(450, (p) => yeux.forEach((o) => o.scale.setScalar(Math.max(0.001, p))));
        }
      );
    },
    pilier(couleur) {
      pilierMesh.visible = true;
      pilierMat.uniforms.uC.value.set(couleur);
      animer(
        1900,
        (p) => {
          pilierMat.uniforms.uO.value = p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85;
          const s = 1 - p * 0.6;
          pilierMesh.scale.set(s, 1, s);
        },
        () => {
          pilierMesh.visible = false;
        }
      );
    },
    onde: (couleur, echelle, duree) => onde(couleur, echelle, duree),
    teinter(couleur, duree = 1200) {
      const de = couleurPorte.clone();
      const vers = new THREE.Color(couleur);
      animer(duree, (p) => {
        couleurPorte.copy(de).lerp(vers, easeInOut(p));
        appliquerCouleur(couleurPorte);
      });
    },
    secouer(force) {
      secousse = force;
    },
    surSurvol(rappel) {
      rappelSurvol = rappel;
    },
    detruire() {
      cancelAnimationFrame(raf);
      removeEventListener('resize', surRedim);
      canvas.removeEventListener('pointermove', surMouvement);
      canvas.removeEventListener('pointerleave', surSortie);
      composer.dispose();
      renderer.dispose();
    },
  };
}
