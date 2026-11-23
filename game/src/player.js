// Costa Verde — player.js
// On-foot movement + arcade car driving, car steal (E), stunt air detection,
// shooting (hitscan cone), damage, nitro, jump.
import * as THREE from 'three';
import { CONFIG, WEAPONS } from './config.js';
import { collide } from './world.js';

export function createPlayer() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.55, 1.7, 10),
    new THREE.MeshLambertMaterial({ color: 0xff5d8f })
  );
  body.position.y = 1.15; group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 12, 10),
    new THREE.MeshLambertMaterial({ color: 0xf1c27d })
  );
  head.position.y = 2.3; group.add(head);
  const cap = new THREE.Mesh(
    new THREE.ConeGeometry(0.45, 0.5, 10),
    new THREE.MeshLambertMaterial({ color: 0x2ec4b6 })
  );
  cap.position.y = 2.65; group.add(cap);
  return {
    mesh: group, x: 0, z: 20, heading: Math.PI, speed: 0,
    health: CONFIG.playerHealth, maxHealth: CONFIG.playerHealth,
    armor: 0, inCar: false, car: null, vy: 0, grounded: true,
    weaponIndex: 1, ammo: { pistol: 120, smg: 240, shotgun: 40 },
    fireCooldown: 0, airTime: 0, wasAirborne: false, stuntCount: 0,
    cash: 0, wanted: 0, wantedTimer: 0,
  };
}

function nearestCar(world, x, z, maxD) {
  let best = null, bestD = maxD;
  for (const c of world.cars) {
    if (!c.stealable) continue;
    const dx = c.mesh.position.x - x, dz = c.mesh.position.z - z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

export function updatePlayer(p, input, world, state, dt, audio) {
  const mouse = input.consumeMouse();
  p.heading -= mouse.dx * 0.0035;
  p.fireCooldown = Math.max(0, p.fireCooldown - dt);
  const ax = input.axis();
  const sprint = input.down('ShiftLeft') || input.down('ShiftRight');

  if (p.inCar && p.car) {
    // ---- driving ----
    const car = p.car;
    const nitro = state.upgrades.nitro && sprint;
    const top = (car.def.top * (state.upgrades.engine ? 1.3 : 1)) * (nitro ? 1.45 : 1);
    let throttle = 0;
    if (ax.z < 0) throttle = 1;
    if (ax.z > 0) throttle = -0.55;
    p.speed += throttle * car.def.accel * dt * (nitro ? 1.5 : 1);
    p.speed -= p.speed * 0.9 * dt; // drag
    if (input.down('Space')) p.speed -= p.speed * 2.2 * dt; // handbrake
    p.speed = Math.max(-CONFIG.carReverse, Math.min(top, p.speed));
    const steer = ax.x * CONFIG.carTurn * dt * Math.sign(p.speed || 1) * Math.min(1, Math.abs(p.speed) / 8 + 0.25);
    p.heading += steer;
    const nx = p.x - Math.sin(p.heading) * p.speed * dt;
    const nz = p.z - Math.cos(p.heading) * p.speed * dt;
    const res = collide(world, nx, nz, 2.2);
    // hitting a wall hard slows you down
    if (Math.abs(res.x - nx) > 0.01 || Math.abs(res.z - nz) > 0.01) p.speed *= 0.5;
    p.x = res.x; p.z = res.z;
    car.mesh.position.set(p.x, 0, p.z);
    car.mesh.rotation.y = p.heading + Math.PI;
    // ramp check: driving onto a ramp launches the car
    for (const r of world.ramps) {
      const dx = p.x - r.x, dz = p.z - r.z;
      if (dx * dx + dz * dz < 30 && Math.abs(p.speed) > 16 && p.grounded) {
        p.vy = CONFIG.jumpVel + Math.abs(p.speed) * 0.18;
        p.grounded = false;
        p.airTime = 0;
        if (audio) audio.stunt();
        state.slowmo = 0.9; // brief slow-mo on launch
      }
    }
    // exit car
    if (input.pressed('KeyE')) {
      p.inCar = false;
      p.car = null;
      p.x += Math.sin(p.heading + Math.PI / 2) * 3;
      p.z += Math.cos(p.heading + Math.PI / 2) * 3;
      p.speed = 0;
    }
  } else {
    // ---- on foot ----
    const sp = sprint ? CONFIG.runSpeed : CONFIG.walkSpeed;
    const mx = (ax.x * Math.cos(p.heading) - ax.z * Math.sin(p.heading));
    const mz = (ax.x * Math.sin(p.heading) + ax.z * Math.cos(p.heading));
    // NOTE: forward is -Z rotated by heading; recompute properly:
    const fx = -Math.sin(p.heading), fz = -Math.cos(p.heading);
    const rx = Math.cos(p.heading), rz = -Math.sin(p.heading);
    const vx = (fx * -ax.z + rx * ax.x) * sp;
    const vz = (fz * -ax.z + rz * ax.x) * sp;
    void mx; void mz;
    let nx = p.x + vx * dt, nz = p.z + vz * dt;
    const res = collide(world, nx, nz, 0.8);
    p.x = res.x; p.z = res.z;
    p.speed = Math.sqrt(vx * vx + vz * vz);
    if (input.down('Space') && p.grounded) { p.vy = CONFIG.jumpVel; p.grounded = false; }
    // steal / enter nearest car
    if (input.pressed('KeyE')) {
      const car = nearestCar(world, p.x, p.z, 5);
      if (car) {
        p.inCar = true; p.car = car; p.speed = 0;
        state.cash = state.cash; // no cost to steal
        state.addWanted(1, 'Grand theft auto');
        if (audio) audio.horn();
      }
    }
  }

  // ---- vertical (jump / stunt air) ----
  if (!p.grounded) {
    p.vy -= CONFIG.gravity * dt;
    p.airTime += dt;
    const y = (p.mesh.position.y || 0) + p.vy * dt;
    if (y <= 0) {
      // landing
      if (p.airTime > 0.9 && p.inCar) {
        const bonus = CONFIG.stuntBonus + Math.floor(p.airTime * 60);
        state.cash += bonus;
        state.stuntCount++;
        state.toast(`STUNT! +$${bonus}  (air ${p.airTime.toFixed(1)}s)`);
        if (audio) audio.stunt();
      }
      p.mesh.position.y = 0; p.vy = 0; p.grounded = true; p.airTime = 0;
    } else {
      p.mesh.position.y = y;
    }
  }
  if (p.inCar && p.car) {
    // car mesh carries the height while airborne
    p.car.mesh.position.y = p.mesh.position.y;
    p.mesh.visible = false;
  } else {
    p.mesh.visible = true;
    p.mesh.position.set(p.x, p.mesh.position.y || 0, p.z);
    p.mesh.rotation.y = p.heading + Math.PI;
  }
  // slow-mo decay
  if (state.slowmo > 0) state.slowmo = Math.max(0, state.slowmo - dt);

  // ---- shooting ----
  const w = WEAPONS[p.weaponIndex];
  if ((mouse.clicked || (w.auto && input.mouseDown)) && p.fireCooldown <= 0 && !p.inCar) {
    if (w.ammo !== Infinity && (p.ammo[w.id] || 0) <= 0) {
      if (audio) audio._tone && audio._tone(120, 0.08, 'square', 0.15);
    } else {
      p.fireCooldown = 1 / w.rate;
      if (w.ammo !== Infinity) p.ammo[w.id]--;
      if (audio) { if (w.id === 'shotgun') audio.shotgun(); else if (w.id === 'fists') audio.punch(); else audio.shoot(); }
      state.shoot(w);
    }
  }
  if (input.pressed('KeyR')) {
    const w2 = WEAPONS[p.weaponIndex];
    if (w2.ammo !== Infinity) { p.ammo[w2.id] = w2.ammo; state.toast(`${w2.name} reloaded`); }
  }
  return p;
}
