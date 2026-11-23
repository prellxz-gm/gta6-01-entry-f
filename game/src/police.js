// Costa Verde — police.js
// Wanted 0–5: cop cars spawn, chase and ram; helicopter at 3+; roadblocks at 4+.
// Busted when a cop stays close while the player is slow on foot or stopped.
import * as THREE from 'three';
import { CONFIG } from './config.js';

export function createPolice() {
  return { cops: [], heli: null, heliActive: false, roadblocks: [], spawnTimer: 0, bustedTimer: 0 };
}

function makeCopMesh(scene) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.1, 2), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  body.position.y = 0.75; g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 1.8), new THREE.MeshLambertMaterial({ color: 0xf8f9fa }));
  cab.position.set(-0.2, 1.6, 0); g.add(cab);
  const light = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 1.2), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
  light.position.set(-0.2, 2.2, 0); g.add(light);
  g.userData.light = light;
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  for (const [wx, wz] of [[1.5, 1], [1.5, -1], [-1.5, 1], [-1.5, -1]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10), wheelMat);
    w.rotation.x = Math.PI / 2; w.position.set(wx, 0.42, wz); g.add(w);
  }
  scene.add(g);
  return g;
}

function makeHeli(scene) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(4, 1.6, 2.2), new THREE.MeshLambertMaterial({ color: 0x212529 }));
  g.add(body);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.15, 0.5), new THREE.MeshLambertMaterial({ color: 0xadb5bd }));
  rotor.position.y = 1.1; g.add(rotor);
  const spot = new THREE.Mesh(new THREE.ConeGeometry(3, 12, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.25, side: THREE.DoubleSide }));
  spot.position.y = -6; spot.rotation.x = Math.PI; g.add(spot);
  g.userData.rotor = rotor;
  scene.add(g);
  return g;
}

export function updatePolice(police, scene, player, state, dt, rng) {
  const wanted = player.wanted;
  const wantCount = wanted === 0 ? 0 : wanted + 1; // 2..6 cops
  police.spawnTimer -= dt;

  // spawn / despawn to match wanted level
  if (police.cops.length < wantCount && police.spawnTimer <= 0) {
    const mesh = makeCopMesh(scene);
    const a = rng.float(0, Math.PI * 2);
    const x = player.x + Math.sin(a) * 55, z = player.z + Math.cos(a) * 55;
    mesh.position.set(x, 0, z);
    police.cops.push({ mesh, x, z, heading: a, speed: 0, hp: 60, flash: 0 });
    police.spawnTimer = 1.2;
  }
  while (police.cops.length > wantCount) {
    const c = police.cops.pop();
    scene.remove(c.mesh);
  }

  // helicopter at wanted 3+
  if (wanted >= 3 && !police.heli) {
    police.heli = makeHeli(scene);
    police.heliActive = true;
  } else if (wanted < 3 && police.heli) {
    scene.remove(police.heli);
    police.heli = null; police.heliActive = false;
  }
  if (police.heli) {
    const h = police.heli;
    h.position.set(player.x + 14, 26, player.z + 10);
    h.userData.rotor.rotation.y += dt * 22;
    h.rotation.y += dt * 0.4;
  }

  // roadblocks at wanted 4+: static cop-car walls ahead of the player
  if (wanted >= 4 && police.roadblocks.length === 0) {
    for (let i = 0; i < 3; i++) {
      const mesh = makeCopMesh(scene);
      const fx = -Math.sin(player.heading), fz = -Math.cos(player.heading);
      const bx = player.x + fx * (34 + i * 8) + (i - 1) * 5;
      const bz = player.z + fz * (34 + i * 8);
      mesh.position.set(bx, 0, bz);
      mesh.rotation.y = player.heading + Math.PI / 2;
      police.roadblocks.push({ mesh, x: bx, z: bz });
    }
  } else if (wanted < 4) {
    for (const rb of police.roadblocks) scene.remove(rb.mesh);
    police.roadblocks = [];
  }

  // chase behaviour
  let closest = Infinity;
  for (const c of police.cops) {
    const dx = player.x - c.x, dz = player.z - c.z;
    const d = Math.sqrt(dx * dx + dz * dz) || 0.001;
    closest = Math.min(closest, d);
    const targetHeading = Math.atan2(-dx, -dz);
    let dh = targetHeading - c.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    c.heading += Math.max(-2.6 * dt, Math.min(2.6 * dt, dh));
    const top = 24 + wanted * 3.2;
    c.speed = Math.min(top, c.speed + 16 * dt);
    c.x -= Math.sin(c.heading) * c.speed * dt;
    c.z -= Math.cos(c.heading) * c.speed * dt;
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.heading + Math.PI;
    c.flash += dt * 10;
    c.mesh.userData.light.material.color.setHex(Math.floor(c.flash) % 2 === 0 ? 0xff0000 : 0x2244ff);
    // ram: hitting the player damages + slows
    if (d < 3.4) {
      player.health -= 14 * dt * 10 * 0.12;
      if (player.inCar) player.speed *= 0.94;
      else { player.x += (dx / d) * 2.2; player.z += (dz / d) * 2.2; }
    }
  }

  // busted: cop very close while player is slow / on foot for a while
  if (wanted > 0 && closest < 4 && Math.abs(player.speed) < 3 && !player.inCar) {
    police.bustedTimer += dt;
    if (police.bustedTimer > 2.5) state.busted();
  } else {
    police.bustedTimer = Math.max(0, police.bustedTimer - dt * 2);
  }

  // wanted decay: stay slow and out of sight (no cop within 30) and it cools off
  if (wanted > 0) {
    player.wantedTimer += dt;
    if (closest > 32 && player.wantedTimer > 9) {
      player.wanted = Math.max(0, player.wanted - 1);
      player.wantedTimer = 0;
      state.toast(`Heat cooling off — wanted ${player.wanted}`);
    }
  } else player.wantedTimer = 0;

  // expose cop positions for the minimap
  state.cops = police.cops;
  return police;
}

export function clearPolice(police, scene) {
  for (const c of police.cops) scene.remove(c.mesh);
  police.cops = [];
  if (police.heli) { scene.remove(police.heli); police.heli = null; }
  for (const rb of police.roadblocks) scene.remove(rb.mesh);
  police.roadblocks = [];
}
