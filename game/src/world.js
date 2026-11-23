// Costa Verde — world.js
// Builds the golden-hour coastal city from a seeded RNG: roads, buildings,
// beach + sea, palms, lamps, stunt ramps, traffic cars, pedestrians, props.
// Everything placed here is a pure function of the seed.
import * as THREE from 'three';
import { CONFIG, DISTRICTS, CAR_DEFS } from './config.js';

function boxMat(color, rough = 0.9) {
  return new THREE.MeshLambertMaterial({ color });
}

export function buildWorld(scene, rng) {
  const world = {
    colliders: [],       // {x,z,r} circles + {x,z,hw,hd} boxes, for simple collision
    ramps: [],           // {x,z,angle,mesh}
    cars: [],            // traffic + parked, each {mesh,path,seg,t,speed,color,parked}
    peds: [],            // {mesh,x,z,dir,speed,phase}
    markers: {},
    buildings: [],
    trafficLights: [],
  };

  // ---- sky, fog, golden-hour sun ----
  scene.background = new THREE.Color(0xffb36b);
  scene.fog = new THREE.Fog(0xf7a55c, 180, 520);
  const hemi = new THREE.HemisphereLight(0xffd9a0, 0x3d5a80, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffc06e, 1.6);
  sun.position.set(-180, 90, -120);
  scene.add(sun);
  const amb = new THREE.AmbientLight(0xffe0b3, 0.35);
  scene.add(amb);

  // ---- ground: city slab, sand, sea ----
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 700),
    new THREE.MeshLambertMaterial({ color: 0x8a8f7a })
  );
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.05, 0);
  scene.add(ground);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 700),
    new THREE.MeshLambertMaterial({ color: 0xe8d29a })
  );
  sand.rotation.x = -Math.PI / 2; sand.position.set(CONFIG.beachX - 18, 0, 0);
  scene.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 700),
    new THREE.MeshLambertMaterial({ color: 0x2a7f9e })
  );
  sea.rotation.x = -Math.PI / 2; sea.position.set(CONFIG.seaX - 60, -0.4, 0);
  scene.add(sea);
  // gentle sea shimmer strip
  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(3, 700),
    new THREE.MeshLambertMaterial({ color: 0xdff3f7 })
  );
  foam.rotation.x = -Math.PI / 2; foam.position.set(CONFIG.seaX + 18, 0.05, 0);
  scene.add(foam);

  // ---- roads (grid) ----
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x3a3f44 });
  const lineMat = new THREE.MeshLambertMaterial({ color: 0xf5d76e });
  const roads = [];
  for (let x = -176; x <= 176; x += CONFIG.roadSpacing) roads.push({ x, z: 0, vertical: true });
  for (let z = -176; z <= 176; z += CONFIG.roadSpacing) roads.push({ x: 0, z, vertical: false });
  for (const r of roads) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(r.vertical ? CONFIG.roadWidth : 440, r.vertical ? 440 : CONFIG.roadWidth), roadMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(r.vertical ? r.x : 0, 0.02, r.vertical ? 0 : r.z);
    scene.add(m);
  }
  // dashed centre lines
  for (let x = -176; x <= 176; x += CONFIG.roadSpacing) {
    for (let z = -200; z < 200; z += 12) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 5), lineMat);
      d.rotation.x = -Math.PI / 2; d.position.set(x, 0.04, z);
      scene.add(d);
    }
  }

  // ---- buildings: seeded blocks between roads ----
  const palette = [0xe8b4b8, 0xf2d8a0, 0xa8dadc, 0x90be6d, 0xee964b, 0x9b5de5, 0xef476f, 0xcaf0f8];
  const blockCenters = [];
  for (let gx = -176 + 22; gx <= 176 - 22; gx += CONFIG.roadSpacing) {
    for (let gz = -176 + 22; gz <= 176 - 22; gz += CONFIG.roadSpacing) {
      if (gx < CONFIG.beachX + 8) continue; // beach stays open
      blockCenters.push({ x: gx, z: gz });
    }
  }
  for (const b of blockCenters) {
    // sidewalk slab so blocks read as city, not bare ground
    const slab = new THREE.Mesh(
      new THREE.PlaneGeometry(38, 38),
      new THREE.MeshLambertMaterial({ color: 0xb8b0a0 })
    );
    slab.rotation.x = -Math.PI / 2; slab.position.set(b.x, 0.01, b.z);
    scene.add(slab);
    const n = rng.int(2, 4);
    for (let i = 0; i < n; i++) {
      const w = rng.float(9, 18), d = rng.float(9, 18);
      const h = rng.float(8, 46);
      const ox = b.x + rng.float(-9, 9), oz = b.z + rng.float(-9, 9);
      const col = rng.pick(palette);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), boxMat(col));
      mesh.position.set(ox, h / 2, oz);
      scene.add(mesh);
      // rooftop trim
      const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.8, d + 0.6), boxMat(0x2b2d42));
      trim.position.set(ox, h + 0.4, oz);
      scene.add(trim);
      // lit windows strip (golden hour glow)
      if (rng.chance(0.6)) {
        const win = new THREE.Mesh(
          new THREE.PlaneGeometry(w * 0.7, Math.min(3, h * 0.4)),
          new THREE.MeshBasicMaterial({ color: 0xffd166 })
        );
        win.position.set(ox, h * 0.55, oz + d / 2 + 0.06);
        scene.add(win);
      }
      world.colliders.push({ x: ox, z: oz, hw: w / 2 + 0.5, hd: d / 2 + 0.5 });
      world.buildings.push(mesh);
    }
  }

  // ---- palms along the beach + scattered ----
  const trunkMat = boxMat(0x8b5e3c), leafMat = boxMat(0x2d6a4f);
  for (let z = -200; z <= 200; z += 14) {
    const x = CONFIG.beachX - 4 + rng.float(-3, 3);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 7, 6), trunkMat);
    trunk.position.set(x, 3.5, z + rng.float(-3, 3));
    scene.add(trunk);
    const top = new THREE.Mesh(new THREE.ConeGeometry(3.2, 3, 7), leafMat);
    top.position.set(x, 8.2, trunk.position.z);
    scene.add(top);
    world.colliders.push({ x, z: trunk.position.z, r: 0.9 });
  }

  // ---- stunt ramps (4, golden ramps) ----
  const rampSpots = [
    { x: -44, z: 132, angle: 0 },
    { x: 44, z: -44, angle: Math.PI / 2 },
    { x: -132, z: 44, angle: Math.PI },
    { x: 132, z: 88, angle: -Math.PI / 2 },
  ];
  const rampMat = new THREE.MeshLambertMaterial({ color: 0xf4a261 });
  for (const s of rampSpots) {
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(8, 0.8, 12), rampMat);
    ramp.position.set(s.x, 1.1, s.z);
    ramp.rotation.z = 0; ramp.rotation.y = s.angle;
    ramp.rotation.x = -0.42;
    scene.add(ramp);
    // chevron stripes
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.3, 1.2), new THREE.MeshBasicMaterial({ color: 0xffe66d }));
    stripe.position.set(s.x, 2.2, s.z); stripe.rotation.y = s.angle;
    scene.add(stripe);
    world.ramps.push({ x: s.x, z: s.z, angle: s.angle, mesh: ramp });
  }

  // ---- garage (Old Town) + race start + villa ----
  const garage = new THREE.Mesh(new THREE.BoxGeometry(20, 8, 14), boxMat(0x4361ee));
  garage.position.set(88, 4, -88); scene.add(garage);
  const gsign = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.4), new THREE.MeshBasicMaterial({ color: 0xffe66d }));
  gsign.position.set(88, 7, -80.6); scene.add(gsign);
  world.markers.garage = { x: 88, z: -78 };
  world.colliders.push({ x: 88, z: -88, hw: 10, hd: 7 });
  const villa = new THREE.Mesh(new THREE.BoxGeometry(22, 12, 18), boxMat(0xf8edeb));
  villa.position.set(118, 6, 118); scene.add(villa);
  world.markers.villa = { x: 104, z: 104 };
  world.colliders.push({ x: 118, z: 118, hw: 11, hd: 9 });

  // ---- traffic cars: parked + moving on road loops ----
  function makeCarMesh(color) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.1, 2), new THREE.MeshLambertMaterial({ color }));
    body.position.y = 0.75; g.add(body);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 1.8), new THREE.MeshLambertMaterial({ color: 0x1d3557 }));
    cab.position.set(-0.2, 1.6, 0); g.add(cab);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    for (const [wx, wz] of [[1.5, 1], [1.5, -1], [-1.5, 1], [-1.5, -1]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10), wheelMat);
      w.rotation.x = Math.PI / 2; w.position.set(wx, 0.42, wz); g.add(w);
    }
    return g;
  }
  world.makeCarMesh = makeCarMesh;
  // parked cars along roads
  for (let i = 0; i < 26; i++) {
    const roadX = rng.pick([-176, -132, -88, -44, 0, 44, 88, 132, 176]);
    const z = rng.float(-190, 190);
    const def = rng.pick(CAR_DEFS);
    const mesh = makeCarMesh(def.color);
    mesh.position.set(roadX + (rng.chance(0.5) ? 4.5 : -4.5), 0, z);
    mesh.rotation.y = rng.chance(0.5) ? 0 : Math.PI;
    scene.add(mesh);
    world.cars.push({ mesh, parked: true, x: mesh.position.x, z, def, speed: 0, stealable: true, hp: 100 });
    world.colliders.push({ x: mesh.position.x, z, r: 2.6, car: world.cars[world.cars.length - 1] });
  }
  // moving traffic on loops
  const loopRoads = [-132, -44, 44, 132];
  for (let i = 0; i < 14; i++) {
    const vertical = rng.chance(0.5);
    const road = rng.pick(loopRoads);
    const def = rng.pick(CAR_DEFS);
    const mesh = makeCarMesh(def.color);
    scene.add(mesh);
    world.cars.push({
      mesh, parked: false, vertical, road,
      t: rng.float(0, 440), speed: rng.float(9, 15), def,
      dir: rng.chance(0.5) ? 1 : -1, stealable: false, hp: 100,
    });
  }

  // ---- pedestrians ----
  const pedColors = [0xef476f, 0x06d6a0, 0x118ab2, 0xf78c6b, 0x9b5de5, 0x073b4c];
  for (let i = 0; i < 36; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 1.7, 8), boxMat(rng.pick(pedColors)));
    body.position.y = 1.15; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), boxMat(0xf1c27d));
    head.position.y = 2.3; g.add(head);
    const x = rng.float(-170, 190), z = rng.float(-190, 190);
    g.position.set(x, 0, z);
    scene.add(g);
    world.peds.push({ mesh: g, x, z, dir: rng.float(0, Math.PI * 2), speed: rng.float(1, 2.4), phase: rng.float(0, 10), alive: true });
  }

  // ---- district rings (visible turf borders) ----
  for (const d of DISTRICTS) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(d.r - 1.5, d.r, 48),
      new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2; ring.position.set(d.cx, 0.06, d.cz);
    scene.add(ring);
  }

  return world;
}

// Simple circle/box collision resolve for a point with radius r.
export function collide(world, x, z, r) {
  for (const c of world.colliders) {
    if (c.r !== undefined) {
      const dx = x - c.x, dz = z - c.z;
      const d2 = dx * dx + dz * dz, rr = r + c.r;
      if (d2 < rr * rr && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = c.x + (dx / d) * rr; z = c.z + (dz / d) * rr;
      }
    } else {
      const dx = Math.max(Math.abs(x - c.x) - c.hw, 0);
      const dz = Math.max(Math.abs(z - c.z) - c.hd, 0);
      if (dx * dx + dz * dz < r * r) {
        // push out along the smaller penetration axis
        const px = c.hw + r - Math.abs(x - c.x);
        const pz = c.hd + r - Math.abs(z - c.z);
        if (px < pz) x = c.x + Math.sign(x - c.x || 1) * (c.hw + r);
        else z = c.z + Math.sign(z - c.z || 1) * (c.hd + r);
      }
    }
  }
  // world bounds + sea wall
  x = Math.max(-215, Math.min(215, x));
  z = Math.max(-215, Math.min(215, z));
  if (x < CONFIG.seaX + 6) x = CONFIG.seaX + 6; // don't swim
  return { x, z };
}
