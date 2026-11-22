import { THREE } from '@hocus/three';
import type { ItemType } from './app.ts';

/**
 * Procedural low-poly Halloween props built from primitives (no downloaded assets, no licences).
 * Each returns a Group whose origin sits on the floor (or wall) contact point.
 */
const std = (color: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...o });

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, pos?: [number, number, number], rot?: [number, number, number]) {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export interface Prop {
  group: THREE.Group;
  /** Materials that a "turn it <colour>" command recolours. */
  tintable: THREE.MeshStandardMaterial[];
  /** Emissive light sources that glow brighter in the dark. */
  glow: Array<{ mat: THREE.MeshStandardMaterial; light?: THREE.PointLight }>;
  animate?: (t: number, dt: number) => void;
}

function pumpkin(): Prop {
  const g = new THREE.Group();
  const skin = std(0xff7a1a, { roughness: 0.55 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const seg = mesh(new THREE.SphereGeometry(0.28, 16, 12), skin, [Math.cos(a) * 0.16, 0.32, Math.sin(a) * 0.16]);
    seg.scale.set(0.9, 1.05, 0.9);
    g.add(seg);
  }
  g.add(mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.18, 6), std(0x3b5a1e), [0, 0.68, 0], [0.2, 0, 0.15]));
  const glowMat = std(0xffd27a, { emissive: 0xffa53a, emissiveIntensity: 1.4 });
  const face = new THREE.Group();
  face.add(mesh(new THREE.ConeGeometry(0.06, 0.08, 3), glowMat, [-0.1, 0.4, 0.43], [Math.PI / 2, 0, 0]));
  face.add(mesh(new THREE.ConeGeometry(0.06, 0.08, 3), glowMat, [0.1, 0.4, 0.43], [Math.PI / 2, 0, 0]));
  face.add(mesh(new THREE.BoxGeometry(0.24, 0.05, 0.04), glowMat, [0, 0.24, 0.44]));
  g.add(face);
  const light = new THREE.PointLight(0xffa53a, 0.6, 2.2, 2);
  light.position.set(0, 0.35, 0.2);
  g.add(light);
  return { group: g, tintable: [skin], glow: [{ mat: glowMat, light }] };
}

function ghost(): Prop {
  const g = new THREE.Group();
  const body = std(0xe9ecff, { transparent: true, opacity: 0.88, emissive: 0x4fe3c1, emissiveIntensity: 0.08, roughness: 0.3 });
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pts.push(new THREE.Vector2(0.05 + Math.sin(t * Math.PI * 0.95) * 0.42 * (1 - t * 0.15), t * 1.1));
  }
  const shell = mesh(new THREE.LatheGeometry(pts.reverse(), 24), body);
  shell.position.y = -0.1;
  g.add(shell);
  const eye = std(0x0e0b14);
  g.add(mesh(new THREE.SphereGeometry(0.06, 10, 8), eye, [-0.13, 0.75, 0.36]));
  g.add(mesh(new THREE.SphereGeometry(0.06, 10, 8), eye, [0.13, 0.75, 0.36]));
  g.add(mesh(new THREE.SphereGeometry(0.08, 10, 8), eye, [0, 0.52, 0.39]));
  return {
    group: g,
    tintable: [body],
    glow: [],
    animate: (t) => {
      g.children[0]!.position.y = -0.1 + Math.sin(t * 0.002) * 0.08;
      g.rotation.z = Math.sin(t * 0.0013) * 0.06;
    },
  };
}

function bat(): Prop {
  const g = new THREE.Group();
  const skin = std(0x2a2233, { roughness: 0.8 });
  g.add(mesh(new THREE.SphereGeometry(0.14, 12, 10), skin, [0, 0, 0]));
  const wingGeo = new THREE.ShapeGeometry(
    new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.5, 0.18), new THREE.Vector2(0.62, -0.05), new THREE.Vector2(0.45, -0.02), new THREE.Vector2(0.35, -0.14), new THREE.Vector2(0.2, -0.06)]),
  );
  const wingMat = std(0x241c2e, { side: THREE.DoubleSide });
  const left = mesh(wingGeo, wingMat, [0.08, 0, 0]);
  const right = mesh(wingGeo, wingMat, [-0.08, 0, 0], [0, Math.PI, 0]);
  g.add(left, right);
  const eye = std(0xff5d73, { emissive: 0xff2244, emissiveIntensity: 1.2 });
  g.add(mesh(new THREE.SphereGeometry(0.025, 6, 6), eye, [-0.05, 0.04, 0.12]), mesh(new THREE.SphereGeometry(0.025, 6, 6), eye, [0.05, 0.04, 0.12]));
  return {
    group: g,
    tintable: [skin, wingMat],
    glow: [{ mat: eye }],
    animate: (t) => {
      const f = Math.sin(t * 0.018) * 0.7;
      left.rotation.y = f;
      right.rotation.y = Math.PI - f;
      g.position.y = Math.sin(t * 0.003) * 0.05;
    },
  };
}

function candle(): Prop {
  const g = new THREE.Group();
  const wax = std(0xf2e6c8, { roughness: 0.5 });
  g.add(mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.5, 14), wax, [0, 0.25, 0]));
  g.add(mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.04, 16), std(0x6b5a3a, { metalness: 0.6 }), [0, 0.02, 0]));
  const flameMat = std(0xffd27a, { emissive: 0xffb347, emissiveIntensity: 2.4 });
  const flame = mesh(new THREE.ConeGeometry(0.045, 0.14, 10), flameMat, [0, 0.58, 0]);
  flame.castShadow = false;
  g.add(flame);
  const light = new THREE.PointLight(0xffb347, 1.2, 3.5, 2);
  light.position.set(0, 0.7, 0);
  g.add(light);
  return {
    group: g,
    tintable: [wax],
    glow: [{ mat: flameMat, light }],
    animate: (t) => {
      const f = 0.85 + Math.sin(t * 0.013) * 0.08 + Math.sin(t * 0.031) * 0.06;
      flame.scale.set(1, f * 1.1, 1);
      light.userData.flicker = f;
    },
  };
}

function cobweb(): Prop {
  const g = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({ color: 0xdcd7ea, transparent: true, opacity: 0.7 });
  const spokes = 8;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    pts.push(new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(a) * 0.7, Math.sin(a) * 0.7, 0));
  }
  for (let r = 1; r <= 4; r++)
    for (let i = 0; i < spokes; i++) {
      const a1 = (i / spokes) * Math.PI * 2;
      const a2 = ((i + 1) / spokes) * Math.PI * 2;
      const rr = r * 0.17;
      pts.push(new THREE.Vector3(Math.cos(a1) * rr, Math.sin(a1) * rr, 0), new THREE.Vector3(Math.cos(a2) * rr * 0.92, Math.sin(a2) * rr * 0.92, 0));
    }
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), mat));
  // Invisible disc so the web can be pointed at.
  g.add(new THREE.Mesh(new THREE.CircleGeometry(0.7, 16), new THREE.MeshBasicMaterial({ visible: false })));
  return { group: g, tintable: [], glow: [] };
}

function coffin(): Prop {
  const g = new THREE.Group();
  const wood = std(0x6b4030, { roughness: 0.75 });
  const shape = new THREE.Shape([new THREE.Vector2(-0.25, -0.8), new THREE.Vector2(0.25, -0.8), new THREE.Vector2(0.4, 0.35), new THREE.Vector2(0.28, 0.8), new THREE.Vector2(-0.28, 0.8), new THREE.Vector2(-0.4, 0.35)]);
  const box = mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.35, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02 }), wood, [0, 0.02, 0], [-Math.PI / 2, 0, 0]);
  g.add(box);
  const brass = std(0xc9a44a, { metalness: 0.8, roughness: 0.3 });
  g.add(mesh(new THREE.BoxGeometry(0.06, 0.02, 0.4), brass, [0, 0.4, -0.15]), mesh(new THREE.BoxGeometry(0.22, 0.02, 0.06), brass, [0, 0.4, -0.22]));
  return { group: g, tintable: [wood], glow: [] };
}

function lantern(): Prop {
  const g = new THREE.Group();
  const iron = std(0x2b2b33, { metalness: 0.7, roughness: 0.4 });
  const glass = std(0xffe2a0, { emissive: 0xffb347, emissiveIntensity: 1.5, transparent: true, opacity: 0.85 });
  const swing = new THREE.Group();
  swing.add(mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.6, 4), iron, [0, 0.3, 0]));
  swing.add(mesh(new THREE.BoxGeometry(0.28, 0.36, 0.28), glass, [0, -0.2, 0]));
  swing.add(mesh(new THREE.ConeGeometry(0.22, 0.16, 4), iron, [0, 0.06, 0], [0, Math.PI / 4, 0]));
  swing.add(mesh(new THREE.BoxGeometry(0.32, 0.04, 0.32), iron, [0, -0.4, 0]));
  const light = new THREE.PointLight(0xffb347, 1.0, 4, 2);
  light.position.set(0, -0.2, 0);
  swing.add(light);
  g.add(swing);
  return { group: g, tintable: [iron], glow: [{ mat: glass, light }], animate: (t) => (swing.rotation.z = Math.sin(t * 0.0016) * 0.12) };
}

function tree(): Prop {
  const g = new THREE.Group();
  const bark = std(0x3a2c26, { roughness: 0.95 });
  const branch = (len: number, r: number, depth: number, parent: THREE.Object3D, seed: number) => {
    const m = mesh(new THREE.CylinderGeometry(r * 0.6, r, len, 6), bark, [0, len / 2, 0]);
    const node = new THREE.Group();
    node.add(m);
    parent.add(node);
    if (depth > 0)
      for (let k = 0; k < 2; k++) {
        const child = new THREE.Group();
        child.position.y = len * (0.7 + 0.15 * k);
        child.rotation.z = (k ? -1 : 1) * (0.5 + 0.2 * Math.sin(seed + k));
        child.rotation.y = seed * 1.7 + k * 2.1;
        node.add(child);
        branch(len * 0.65, r * 0.6, depth - 1, child, seed + k + 1);
      }
  };
  branch(1.1, 0.13, 3, g, 1);
  return { group: g, tintable: [], glow: [] };
}

function skeleton(): Prop {
  const g = new THREE.Group();
  const bone = std(0xe8e0cc, { roughness: 0.6 });
  g.add(mesh(new THREE.SphereGeometry(0.17, 14, 12), bone, [0, 1.52, 0]));
  const eye = std(0x0e0b14);
  g.add(mesh(new THREE.SphereGeometry(0.04, 8, 6), eye, [-0.06, 1.55, 0.14]), mesh(new THREE.SphereGeometry(0.04, 8, 6), eye, [0.06, 1.55, 0.14]));
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6), bone, [0, 1.1, 0]));
  for (let i = 0; i < 4; i++) g.add(mesh(new THREE.TorusGeometry(0.15 - i * 0.015, 0.018, 6, 16, Math.PI), bone, [0, 1.25 - i * 0.09, 0.02], [0, 0, Math.PI]));
  g.add(mesh(new THREE.BoxGeometry(0.3, 0.08, 0.12), bone, [0, 0.8, 0]));
  for (const s of [-1, 1]) {
    g.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 6), bone, [s * 0.1, 0.48, 0]));
    g.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.5, 6), bone, [s * 0.24, 1.08, 0], [0, 0, s * 0.25]));
  }
  return { group: g, tintable: [], glow: [], animate: (t) => (g.children[0]!.rotation.z = Math.sin(t * 0.002) * 0.15) };
}

function cat(): Prop {
  const g = new THREE.Group();
  const fur = std(0x1b1720, { roughness: 0.9 });
  const body = mesh(new THREE.SphereGeometry(0.28, 14, 12), fur, [0, 0.28, 0]);
  body.scale.set(1, 0.9, 1.3);
  g.add(body);
  g.add(mesh(new THREE.SphereGeometry(0.17, 14, 12), fur, [0, 0.6, 0.22]));
  g.add(mesh(new THREE.ConeGeometry(0.06, 0.14, 4), fur, [-0.08, 0.77, 0.22]), mesh(new THREE.ConeGeometry(0.06, 0.14, 4), fur, [0.08, 0.77, 0.22]));
  const eye = std(0xb9f18c, { emissive: 0x7fff4f, emissiveIntensity: 1.3 });
  g.add(mesh(new THREE.SphereGeometry(0.03, 8, 6), eye, [-0.06, 0.63, 0.37]), mesh(new THREE.SphereGeometry(0.03, 8, 6), eye, [0.06, 0.63, 0.37]));
  const tail = mesh(new THREE.TorusGeometry(0.22, 0.03, 6, 16, Math.PI * 1.2), fur, [0, 0.35, -0.35], [0, Math.PI / 2, 0]);
  g.add(tail);
  return { group: g, tintable: [fur], glow: [{ mat: eye }], animate: (t) => (tail.rotation.x = Math.sin(t * 0.003) * 0.3) };
}

function cauldron(): Prop {
  const g = new THREE.Group();
  const iron = std(0x2b2b33, { metalness: 0.6, roughness: 0.45 });
  const pot = mesh(new THREE.SphereGeometry(0.45, 18, 14, 0, Math.PI * 2, Math.PI * 0.25, Math.PI * 0.75), iron, [0, 0.45, 0]);
  g.add(pot);
  g.add(mesh(new THREE.TorusGeometry(0.33, 0.04, 8, 20), iron, [0, 0.76, 0], [Math.PI / 2, 0, 0]));
  const brew = std(0x4fe3c1, { emissive: 0x2bbf9a, emissiveIntensity: 1.2 });
  g.add(mesh(new THREE.CircleGeometry(0.31, 20), brew, [0, 0.72, 0], [-Math.PI / 2, 0, 0]));
  const light = new THREE.PointLight(0x4fe3c1, 0.8, 3, 2);
  light.position.set(0, 1, 0);
  g.add(light);
  const bubbles = new THREE.Group();
  for (let i = 0; i < 5; i++) bubbles.add(mesh(new THREE.SphereGeometry(0.04, 8, 6), brew, [Math.sin(i * 2) * 0.15, 0.75, Math.cos(i * 2) * 0.15]));
  g.add(bubbles);
  return {
    group: g,
    tintable: [brew],
    glow: [{ mat: brew, light }],
    animate: (t) => bubbles.children.forEach((b, i) => (b.position.y = 0.75 + ((t * 0.0006 + i * 0.2) % 1) * 0.4)),
  };
}

function gravestone(): Prop {
  const g = new THREE.Group();
  const stone = std(0x6f6a7a, { roughness: 0.95 });
  const shape = new THREE.Shape();
  shape.moveTo(-0.4, 0);
  shape.lineTo(-0.4, 0.8);
  shape.absarc(0, 0.8, 0.4, Math.PI, 0, true);
  shape.lineTo(0.4, 0);
  g.add(mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03 }), stone, [0, 0, -0.08]));
  const carve = std(0x3a3644);
  g.add(mesh(new THREE.BoxGeometry(0.06, 0.4, 0.02), carve, [0, 0.8, 0.12]), mesh(new THREE.BoxGeometry(0.26, 0.06, 0.02), carve, [0, 0.88, 0.12]));
  return { group: g, tintable: [stone], glow: [] };
}

function spider(): Prop {
  const g = new THREE.Group();
  const body = std(0x1b1720);
  g.add(mesh(new THREE.SphereGeometry(0.12, 12, 10), body, [0, 0, 0.05]));
  g.add(mesh(new THREE.SphereGeometry(0.08, 10, 8), body, [0, 0.13, 0.05]));
  for (let i = 0; i < 4; i++)
    for (const s of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 4), body, [s * 0.15, 0.05 - i * 0.06, 0.05], [0, 0, s * (1.1 + i * 0.12)]));
  const thread = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.2, 0.05), new THREE.Vector3(0, 2.5, 0.05)]), new THREE.LineBasicMaterial({ color: 0xdcd7ea }));
  g.add(thread);
  return { group: g, tintable: [body], glow: [], animate: (t) => (g.position.y = Math.sin(t * 0.0012) * 0.1) };
}

function moonWindow(): Prop {
  const g = new THREE.Group();
  const frame = std(0x3a2c26, { roughness: 0.9 });
  const sky = std(0x1d2a4a, { emissive: 0x2a3d6e, emissiveIntensity: 0.6 });
  g.add(mesh(new THREE.CircleGeometry(0.85, 32), sky, [0, 0, 0.02]));
  g.add(mesh(new THREE.TorusGeometry(0.85, 0.07, 8, 32), frame, [0, 0, 0.05]));
  g.add(mesh(new THREE.BoxGeometry(0.06, 1.7, 0.06), frame, [0, 0, 0.06]), mesh(new THREE.BoxGeometry(1.7, 0.06, 0.06), frame, [0, 0, 0.06]));
  const moon = std(0xfff4d6, { emissive: 0xfff0c4, emissiveIntensity: 1.6 });
  g.add(mesh(new THREE.CircleGeometry(0.28, 24), moon, [0.3, 0.3, 0.03]));
  return { group: g, tintable: [], glow: [{ mat: moon }] };
}

const BUILDERS: Record<ItemType, () => Prop> = {
  pumpkin, ghost, bat, candle, cobweb, coffin, lantern, tree, skeleton, cat, cauldron, gravestone, spider, window: moonWindow,
};

export function buildProp(type: ItemType): Prop {
  return BUILDERS[type]();
}
