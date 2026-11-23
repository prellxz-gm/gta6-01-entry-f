// Costa Verde — missions.js
// 10 story missions + territory income + district standing + crew driver hook.
// Mission progress is pure state; no timers use the wall clock.
import * as THREE from 'three';
import { MISSIONS, CONFIG, DISTRICTS } from './config.js';

export function createMissionState() {
  return {
    index: 0,              // current mission (0..9), 10 = all done
    phase: 'goto',         // per-mission sub-state
    done: [],              // completed mission ids
    ownedDistricts: [],    // district ids controlled
    incomeTimer: 0,
    incomeEarned: 0,
    raceRivals: [],        // rival cars during race missions
    stuntHits: 0,
    heatPeak: 0,
    packageHeld: false,
    standing: {},          // district id -> standing 0..100
  };
}

export function currentMission(ms) {
  return ms.index < MISSIONS.length ? MISSIONS[ms.index] : null;
}

export function missionTarget(ms) {
  const m = currentMission(ms);
  return m ? m.target : null;
}

// Marker mesh: a tall golden beam + floating ring at the objective.
export function createMarkerMesh(scene) {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 42, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffe66d, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
  );
  beam.position.y = 21; g.add(beam);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3.2, 0.3, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe66d })
  );
  ring.rotation.x = Math.PI / 2; ring.position.y = 1.2; g.add(ring);
  g.userData.ring = ring;
  g.visible = false;
  scene.add(g);
  return g;
}

function dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }

export function updateMissions(ms, state, dt) {
  const m = currentMission(ms);
  const p = state.player;
  if (!m) return;

  // territory income tick
  ms.incomeTimer += dt;
  if (ms.incomeTimer >= CONFIG.incomeTickSec && ms.ownedDistricts.length > 0) {
    ms.incomeTimer = 0;
    const pay = CONFIG.incomePerDistrict * ms.ownedDistricts.length;
    state.cash += pay; ms.incomeEarned += pay;
    state.toast(`Territory income +$${pay} (${ms.ownedDistricts.length} district${ms.ownedDistricts.length > 1 ? 's' : ''})`);
  }

  const d = dist2(p.x, p.z, m.target.x, m.target.z);
  const arrive = d < 7;

  switch (m.kind) {
    case 'goto':
    case 'deliver':
    case 'finale':
      if (arrive) completeMission(ms, state, m);
      break;
    case 'collect':
      if (!ms.packageHeld && arrive) {
        ms.packageHeld = true;
        state.toast('Package collected — take it back to Rico at the Marina');
        if (state.audio) state.audio.pickup();
      } else if (ms.packageHeld && dist2(p.x, p.z, -44, -88) < 7) {
        completeMission(ms, state, m);
      }
      break;
    case 'race': {
      // rivals drive toward the finish; player must arrive first
      if (ms.phase === 'goto' && ms.raceRivals.length === 0) {
        ms.phase = 'racing';
        state.startRace();
      }
      if (ms.phase === 'racing' && arrive) {
        const rivalDone = ms.raceRivals.some((r) => r.finished);
        if (!rivalDone) completeMission(ms, state, m);
        else { state.toast('Rival beat you to the line — race again!'); ms.phase = 'goto'; ms.raceRivals = []; }
      }
      break;
    }
    case 'turf': {
      // stand inside the district ring for 6s to capture it
      const dist = DISTRICTS.find((x) => x.id === m.district);
      const inside = dist2(p.x, p.z, dist.cx, dist.cz) < dist.r;
      if (inside) {
        ms.captureT = (ms.captureT || 0) + dt;
        state.captureProgress = Math.min(1, ms.captureT / 6);
        if (ms.captureT >= 6) {
          ms.ownedDistricts.push(m.district);
          ms.standing[m.district] = 100;
          state.toast(`District captured: ${dist.name}! +$${CONFIG.incomePerDistrict}/min income`);
          completeMission(ms, state, m);
        }
      } else { ms.captureT = 0; state.captureProgress = 0; }
      break;
    }
    case 'heat': {
      ms.heatPeak = Math.max(ms.heatPeak, p.wanted);
      if (ms.heatPeak >= 3 && p.wanted === 0) completeMission(ms, state, m);
      else if (ms.heatPeak < 3) state.hint = 'Raise your wanted level to 3 stars (steal a car, hit a cop), then lose the heat.';
      break;
    }
    case 'stunt': {
      if (state.stuntCount >= 3) completeMission(ms, state, m);
      else state.hint = `Stunt jumps: ${state.stuntCount}/3 — hit the golden ramps fast in a car.`;
      break;
    }
    default:
      if (arrive) completeMission(ms, state, m);
  }
}

function completeMission(ms, state, m) {
  state.cash += m.reward;
  ms.done.push(m.id);
  ms.index++;
  ms.phase = 'goto';
  ms.captureT = 0; state.captureProgress = 0;
  ms.packageHeld = false;
  ms.raceRivals = [];
  state.toast(`MISSION COMPLETE: ${m.title}  +$${m.reward}`);
  if (state.audio) state.audio.missionDone();
  // standing: every completed mission raises standing everywhere a little
  for (const d of DISTRICTS) ms.standing[d.id] = Math.min(100, (ms.standing[d.id] || 20) + 8);
  // unlocks
  if (m.id === 'm5') { state.crewUnlocked = true; state.toast('CREW UNLOCKED: press G to call your getaway driver'); }
  if (m.id === 'm10') state.won = true;
  state.save();
}

export function districtStanding(ms, id) {
  return ms.standing[id] || 20;
}
