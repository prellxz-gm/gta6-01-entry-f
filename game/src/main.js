// Costa Verde — main.js
// Wires everything: fixed-timestep loop, HUD, menus, save, shooting,
// traffic + pedestrian updates, street races, getaway driver, garage.
import * as THREE from 'three';
import { CONFIG, MISSIONS, WEAPONS, GARAGE_UPGRADES, CONTROLS_TEXT, DISTRICTS } from './config.js';
import { RNG } from './random.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { buildWorld } from './world.js';
import { createRenderer, updateCamera, drawMinimap } from './render.js';
import { createPlayer, updatePlayer } from './player.js';
import { createPolice, updatePolice, clearPolice } from './police.js';
import { createMissionState, currentMission, missionTarget, createMarkerMesh, updateMissions } from './missions.js';
import { parseShot, applyShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const { renderer, scene, camera } = createRenderer(canvas);
const { shot, seed } = parseShot();
const rng = new RNG(seed);
const input = new Input(canvas);
const audio = new AudioSys();
const world = buildWorld(scene, rng);
const player = createPlayer();
scene.add(player.mesh);
const police = createPolice();
const missions = createMissionState();
const marker = createMarkerMesh(scene);

const state = {
  mode: 'menu', // menu | playing | paused | won | busted
  shot, seed, worldSize: CONFIG.worldSize,
  player, world, missions, audio,
  cash: 0, cops: [], ownedDistricts: missions.ownedDistricts,
  captureProgress: 0, hint: '', slowmo: 0, stuntCount: 0,
  upgrades: { engine: false, armor: false, nitro: false },
  crewUnlocked: false, crewCooldown: 0, won: false,
  toasts: [], raceRivals: [],
  addWanted(n, why) {
    player.wanted = Math.min(CONFIG.maxWanted, player.wanted + n);
    player.wantedTimer = 0;
    if (why) this.toast(`${why} — wanted ${player.wanted}`);
    if (player.wanted >= 3) audio.setSiren(true);
  },
  toast(msg) {
    this.toasts.push({ msg, t: 0 });
    const el = $('toast');
    if (el) { el.textContent = msg; el.classList.add('show'); clearTimeout(this._toastTimer); this._toastTimer = setTimeout(() => el.classList.remove('show'), 3200); }
  },
  shoot(w) {
    // hitscan: nearest damageable target inside a forward cone
    const fx = -Math.sin(player.heading), fz = -Math.cos(player.heading);
    let best = null, bestD = w.range;
    const consider = (x, z, obj, kind) => {
      const dx = x - player.x, dz = z - player.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > bestD || d < 0.5) return;
      const dot = (dx * fx + dz * fz) / d;
      if (dot > 0.86) { best = { obj, kind, d }; bestD = d; }
    };
    for (const pd of world.peds) if (pd.alive) consider(pd.x, pd.z, pd, 'ped');
    for (const c of police.cops) consider(c.x, c.z, c, 'cop');
    for (const c of world.cars) if (!c.stealable || c === player.car) consider(c.mesh.position.x, c.mesh.position.z, c, 'car');
    if (!best) return;
    if (best.kind === 'ped') {
      best.obj.alive = false;
      best.obj.mesh.visible = false;
      this.addWanted(1, 'Pedestrian down');
    } else if (best.kind === 'cop') {
      best.obj.hp -= w.damage;
      if (best.obj.hp <= 0) {
        scene.remove(best.obj.mesh);
        police.cops.splice(police.cops.indexOf(best.obj), 1);
        this.cash += 50;
        this.addWanted(1, 'Cop car destroyed');
        this.toast('Cop car destroyed +$50');
      }
    } else if (best.kind === 'car') {
      best.obj.hp -= w.damage;
      if (best.obj.hp <= 0) {
        this.toast('Car wrecked');
        best.obj.hp = 100;
        best.obj.mesh.position.y = -0.2;
      }
    }
  },
  startRace() {
    this.raceRivals = [];
    for (let i = 0; i < 2; i++) {
      const mesh = world.makeCarMesh(i === 0 ? 0xef476f : 0x118ab2);
      const rx = player.x + (i === 0 ? -6 : 6), rz = player.z + 4;
      mesh.position.set(rx, 0, rz);
      scene.add(mesh);
      this.raceRivals.push({ mesh, x: rx, z: rz, speed: 20 + i * 1.5, finished: false });
    }
    missions.raceRivals = this.raceRivals;
    this.toast('RACE! Beat the rivals to the Downtown marker!');
  },
  busted() {
    const fine = Math.min(this.cash, 200);
    this.cash -= fine;
    player.wanted = 0; player.health = player.maxHealth;
    player.x = 0; player.z = 0; player.inCar = false; player.car = null; player.speed = 0;
    clearPolice(police, scene);
    audio.setSiren(false);
    audio.busted();
    this.toast(`BUSTED! Fine -$${fine}. The crew bailed you out.`);
    this.mode = 'playing';
  },
  wasted() {
    const lost = Math.min(this.cash, 150);
    this.cash -= lost;
    player.health = player.maxHealth; player.wanted = 0;
    player.x = 0; player.z = 0; player.inCar = false; player.car = null; player.speed = 0;
    clearPolice(police, scene);
    audio.setSiren(false);
    this.toast(`WASTED! -$${lost}. You wake up at the clinic.`);
    this.mode = 'playing';
  },
  save() {
    try {
      localStorage.setItem(CONFIG.saveKey, JSON.stringify({
        cash: this.cash, missionIndex: missions.index, done: missions.done,
        owned: missions.ownedDistricts, upgrades: this.upgrades,
        crew: this.crewUnlocked, health: player.health,
      }));
    } catch (e) { /* storage unavailable in headless — ignore */ }
  },
  load() {
    try {
      const raw = localStorage.getItem(CONFIG.saveKey);
      if (!raw) return false;
      const s = JSON.parse(raw);
      this.cash = s.cash || 0;
      missions.index = s.missionIndex || 0;
      missions.done = s.done || [];
      missions.ownedDistricts = s.owned || [];
      this.ownedDistricts = missions.ownedDistricts;
      this.upgrades = s.upgrades || this.upgrades;
      this.crewUnlocked = !!s.crew;
      player.health = s.health || player.maxHealth;
      return true;
    } catch (e) { return false; }
  },
};
window.__costaVerde = state;
window.__gameError = null;
window.addEventListener('error', (e) => { window.__gameError = String(e.message || e.error); });

// ---- shot setup (deterministic scenes for screenshots) ----
applyShot(state, shot);
if (shot !== 'start') state.mode = 'playing';
if (shot === 'end') { /* won flag stays set (HUD shows KINGPIN) but the full-screen
  win overlay is suppressed for the end shot so the villa scene stays visible */ }

// ---- HUD helpers ----
function fmtMoney(n) { return '$' + Math.floor(n).toLocaleString('en-US'); }
function updateHUD() {
  const m = currentMission(missions);
  $('hud-cash').textContent = fmtMoney(state.cash);
  $('hud-health').textContent = 'HP ' + Math.max(0, Math.ceil(player.health));
  $('hud-health').style.width = Math.max(0, player.health) + '%';
  $('hud-armor').textContent = state.upgrades.armor ? 'ARMOR' : '';
  const w = WEAPONS[player.weaponIndex];
  $('hud-weapon').textContent = w.name + (w.ammo === Infinity ? '' : ` · ${player.ammo[w.id] ?? 0}`);
  $('hud-speed').textContent = player.inCar ? Math.abs(Math.round(player.speed * 2.4)) + ' km/h' : (player.speed > 8 ? 'RUN' : 'ON FOOT');
  $('hud-stars').textContent = '★'.repeat(player.wanted) + '☆'.repeat(CONFIG.maxWanted - player.wanted);
  $('hud-stars').style.color = player.wanted >= 3 ? '#ff4040' : '#ffe66d';
  const obj = $('hud-objective');
  if (state.won) obj.textContent = '👑 KINGPIN OF COSTA VERDE — all 10 missions complete!';
  else if (m) obj.textContent = `Mission ${missions.index + 1}/10: ${m.title} — ${m.brief}` + (state.hint ? ' ' + state.hint : '');
  else obj.textContent = 'Free roam — Costa Verde is yours.';
  const terr = $('hud-territory');
  const owned = missions.ownedDistricts.map((id) => DISTRICTS.find((d) => d.id === id)?.name).filter(Boolean).join(', ');
  terr.textContent = owned
    ? `Territory: ${owned} (+$${CONFIG.incomePerDistrict * missions.ownedDistricts.length}/min)`
    : 'Territory: none yet — take a district in a turf mission';
  const stand = $('hud-standing');
  stand.textContent = 'Standing: ' + DISTRICTS.map((d) => `${d.name} ${missions.standing[d.id] || 20}`).join(' · ');
  if (state.captureProgress > 0) $('hud-capture').textContent = `Capturing district… ${Math.round(state.captureProgress * 100)}%`;
  else $('hud-capture').textContent = '';
  // mission marker position
  const t = missionTarget(missions);
  if (t && !state.won) {
    marker.visible = true;
    marker.position.set(t.x, 0, t.z);
    marker.userData.ring.rotation.z += 0.02;
  } else marker.visible = false;
  // weapon wheel
  const wheel = $('wheel');
  if (input.down('KeyQ') && state.mode === 'playing') {
    wheel.style.display = 'flex';
    wheel.innerHTML = WEAPONS.map((wp, i) => `<div class="wslot${i === player.weaponIndex ? ' sel' : ''}">${i + 1} ${wp.name}</div>`).join('');
  } else wheel.style.display = 'none';
  // garage panel
  const nearGarage = Math.hypot(player.x - 88, player.z - -78) < 12;
  const gp = $('garage-panel');
  if (nearGarage && state.mode === 'playing') {
    gp.style.display = 'block';
    gp.innerHTML = '<b>GARAGE — Costa Verde Customs</b><br>' + GARAGE_UPGRADES.map((u) =>
      `<button data-upg="${u.id}" ${state.upgrades[u.id] ? 'disabled' : ''}>${u.name} — $${u.cost}${state.upgrades[u.id] ? ' ✓ OWNED' : ''}<br><small>${u.desc}</small></button>`
    ).join('') + '<br><small>Press B to close · click a button to buy</small>';
    gp.querySelectorAll('[data-upg]').forEach((b) => b.addEventListener('click', () => {
      const u = GARAGE_UPGRADES.find((x) => x.id === b.dataset.upg);
      if (!u || state.upgrades[u.id]) return;
      if (state.cash < u.cost) { state.toast('Not enough cash for ' + u.name); return; }
      state.cash -= u.cost; state.upgrades[u.id] = true;
      if (u.id === 'armor') { player.maxHealth += 50; player.health += 50; }
      state.toast(`${u.name} installed!`);
      audio.pickup(); state.save();
    }, { once: true }));
  } else gp.style.display = 'none';
}

// ---- menus ----
function showMenu() {
  state.mode = 'menu';
  $('menu').style.display = 'flex';
  $('hud').style.display = 'none';
}
function startGame(fromSave) {
  audio.ensure();
  if (fromSave) state.load();
  $('menu').style.display = 'none';
  $('hud').style.display = 'block';
  $('win').style.display = 'none';
  state.mode = 'playing';
  if (canvas.requestPointerLock) { try { canvas.requestPointerLock(); } catch (e) {} }
}
$('btn-start').addEventListener('click', () => startGame(false));
$('btn-continue').addEventListener('click', () => startGame(true));
$('btn-resume').addEventListener('click', () => { $('pause').style.display = 'none'; state.mode = 'playing'; });
$('controls-text').textContent = CONTROLS_TEXT;
if (state.mode === 'menu') { showMenu(); $('hud').style.display = 'none'; }
else { $('menu').style.display = 'none'; $('hud').style.display = 'block'; }
if (state.mode === 'playing') audio.ensure();

// ---- per-tick simulation (fixed timestep) ----
const camState = { x: 0, z: 60, y: 6 };
let acc = 0, last = performance.now(), frames = 0;

function tick(dt) {
  // pause toggle
  if (input.pressed('KeyP') || input.pressed('Escape')) {
    if (state.mode === 'playing') { state.mode = 'paused'; $('pause').style.display = 'flex'; }
    else if (state.mode === 'paused') { state.mode = 'playing'; $('pause').style.display = 'none'; }
  }
  if (state.mode !== 'playing') return;

  // weapon switch 1-4
  for (let i = 0; i < 4; i++) if (input.pressed('Digit' + (i + 1))) player.weaponIndex = i;
  // getaway driver
  state.crewCooldown = Math.max(0, state.crewCooldown - dt);
  if (input.pressed('KeyG') && state.crewUnlocked && state.crewCooldown <= 0) {
    state.crewCooldown = 45;
    player.wanted = Math.max(0, player.wanted - 1);
    const car = world.cars.find((c) => c.stealable && c !== player.car);
    if (car) { car.mesh.position.set(player.x + 6, 0, player.z + 6); }
    state.toast('Getaway driver Rico is here — heat down, fresh car ready.');
    audio.horn();
  }
  if (input.pressed('KeyB')) { /* garage panel is proximity-based; B just toasts */ }

  const simDt = state.slowmo > 0 ? dt * 0.35 : dt;
  updatePlayer(player, input, world, state, simDt, audio);
  updateMissions(missions, state, simDt);
  updatePolice(police, scene, player, state, simDt, rng);
  audio.setSiren(player.wanted >= 3);

  // traffic: loop along roads
  for (const c of world.cars) {
    if (c.parked) continue;
    c.t += c.speed * c.dir * simDt;
    if (c.t > 210) c.t = -210; if (c.t < -210) c.t = 210;
    if (c.vertical) { c.mesh.position.set(c.road + 3 * c.dir, 0, c.t); c.mesh.rotation.y = c.dir > 0 ? Math.PI : 0; }
    else { c.mesh.position.set(c.t, 0, c.road + 3 * c.dir); c.mesh.rotation.y = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
  }
  // pedestrians wander
  for (const pd of world.peds) {
    if (!pd.alive) continue;
    pd.phase += simDt;
    if (pd.phase > 6) { pd.phase = 0; pd.dir = rng.float(0, Math.PI * 2); }
    pd.x += Math.sin(pd.dir) * pd.speed * simDt;
    pd.z += Math.cos(pd.dir) * pd.speed * simDt;
    if (Math.abs(pd.x) > 200 || Math.abs(pd.z) > 200) pd.dir += Math.PI;
    pd.mesh.position.set(pd.x, 0, pd.z);
    pd.mesh.rotation.y = pd.dir;
  }
  // race rivals drive to the finish
  for (const r of state.raceRivals) {
    if (r.finished) continue;
    const t = missionTarget(missions);
    if (!t) continue;
    const dx = t.x - r.x, dz = t.z - r.z;
    const d = Math.sqrt(dx * dx + dz * dz) || 1;
    r.x += (dx / d) * r.speed * simDt;
    r.z += (dz / d) * r.speed * simDt;
    r.mesh.position.set(r.x, 0, r.z);
    r.mesh.rotation.y = Math.atan2(-dx, -dz) + Math.PI;
    if (d < 7) r.finished = true;
  }

  // health / death
  if (player.health <= 0) state.wasted();
  if (player.wanted >= 5) audio.setSiren(true);

  // win overlay (not on the ?shot=end screenshot, where the scene must show)
  if (state.won && state.shot !== 'end' && $('win').style.display !== 'flex') {
    $('win').style.display = 'flex';
    $('win-stats').textContent = `Cash ${fmtMoney(state.cash)} · Districts ${missions.ownedDistricts.length}/5 · Territory earned $${missions.incomeEarned} · Stunts ${state.stuntCount}`;
    state.save();
  }
  // autosave every ~20s of play
  state._saveT = (state._saveT || 0) + simDt;
  if (state._saveT > 20) { state._saveT = 0; state.save(); }
}

function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  acc += dt;
  let steps = 0;
  while (acc >= CONFIG.fixedDt && steps < 15) {
    tick(CONFIG.fixedDt);
    acc -= CONFIG.fixedDt;
    steps++;
  }
  input.snapshotPrev();
  if (state.mode === 'playing' || state.mode === 'menu' || state.mode === 'won') {
    if (state.mode === 'menu') {
      // slow orbit for the title screen
      const t = now / 1000;
      camera.position.set(Math.sin(t * 0.05) * 150, 55, Math.cos(t * 0.05) * 150);
      camera.lookAt(0, 8, 0);
    } else {
      updateCamera(camera, player.x, player.z, player.heading, player.inCar, player.speed, dt, camState);
    }
    renderer.render(scene, camera);
    const mm = $('minimap');
    if (mm && mm.getContext) {
      const mctx = mm.getContext('2d');
      drawMinimap(mctx, state);
    }
    updateHUD();
    audio.updateMusic(dt, player.wanted > 0 ? 1 : 0.5);
    frames++;
    if (frames === 30) window.__gameReady = true;
  }
}
requestAnimationFrame(frame);
