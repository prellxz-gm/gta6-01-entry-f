// Costa Verde — shots.js
// Deterministic screenshot scenes driven by ?shot=<name>&seed=<n>.
// start: title screen over a slow city orbit.
// play: on foot by the beach with a car, mission 1 active.
// chase: driving at wanted 3 with cops + helicopter + roadblock.
// end: Kingpin finale complete at the Hills villa.
export function parseShot() {
  const q = new URLSearchParams(window.location.search);
  return { shot: q.get('shot') || 'play', seed: parseInt(q.get('seed') || '1', 10) || 1 };
}

export function applyShot(state, shot) {
  const p = state.player;
  if (shot === 'start') {
    state.mode = 'menu';
    p.x = -120; p.z = -60; p.heading = Math.PI * 0.75;
    state.cash = 0; p.wanted = 0;
  } else if (shot === 'play') {
    state.mode = 'playing';
    p.x = 0; p.z = 20; p.heading = 0.5;
    state.cash = 350; p.wanted = 0;
    state.missions.index = 0;
  } else if (shot === 'chase') {
    state.mode = 'playing';
    // put the player in a car, wanted 3, cops already spawned
    const car = state.world.cars.find((c) => c.stealable);
    p.x = 0; p.z = 44; p.heading = Math.PI;
    state.cash = 1450; p.wanted = 3;
    if (car) {
      car.mesh.position.set(p.x, 0, p.z);
      p.inCar = true; p.car = car; p.speed = 24;
    }
    state.missions.index = 5; // Highway Heat in progress
    state.missions.heatPeak = 3;
    state.ownedDistricts = ['marina'];
    state.missions.ownedDistricts = ['marina'];
  } else if (shot === 'end') {
    state.mode = 'playing';
    // road intersection (132,132) facing the Hills villa — clear sightline,
    // camera stays on the road (never inside a building)
    p.x = 132; p.z = 132; p.heading = Math.PI / 4;
    state.cash = 6850; p.wanted = 0;
    state.missions.index = 10;
    state.missions.done = ['m1','m2','m3','m4','m5','m6','m7','m8','m9','m10'];
    state.missions.ownedDistricts = ['marina', 'oldtown', 'docks'];
    state.ownedDistricts = ['marina', 'oldtown', 'docks'];
    state.won = true;
  }
  state.shot = shot;
}
