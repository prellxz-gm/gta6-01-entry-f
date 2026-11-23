// Costa Verde — config.js
// All tuning, districts, missions, weapons and vehicles for the game.
// Written fresh for variant F. No external data, no network.
export const CONFIG = {
  seed: 1,
  worldSize: 440,          // playable square, half-extent 220
  roadSpacing: 44,
  roadWidth: 12,
  beachX: -150,            // west of this is sand + sea
  seaX: -196,
  fixedDt: 1 / 60,
  walkSpeed: 9,
  runSpeed: 14,
  carAccel: 26,
  carMaxSpeed: 42,
  carMaxSpeedUpgraded: 55,
  carReverse: 14,
  carTurn: 2.4,
  gravity: 22,
  jumpVel: 9,
  playerHealth: 100,
  maxWanted: 5,
  incomePerDistrict: 25,  // $ per income tick
  incomeTickSec: 60,
  stuntBonus: 150,
  saveKey: 'costa-verde-save-v1',
};

export const DISTRICTS = [
  { id: 'marina',   name: 'Marina',   color: '#2ec4b6', cx: -60, cz: -110, r: 62 },
  { id: 'oldtown',  name: 'Old Town', color: '#e9c46a', cx:  80, cz: -100, r: 58 },
  { id: 'downtown', name: 'Downtown', color: '#e76f51', cx:  40, cz:   20, r: 66 },
  { id: 'docks',    name: 'Docks',    color: '#8d99ae', cx: -90, cz:  110, r: 60 },
  { id: 'hills',    name: 'Verde Hills', color: '#90be6d', cx: 110, cz: 110, r: 56 },
];

export const WEAPONS = [
  { id: 'fists',  name: 'Fists',   damage: 12, range: 3,   rate: 2.5, ammo: Infinity, auto: false, color: '#f4a261' },
  { id: 'pistol', name: 'Pistol',  damage: 22, range: 55,  rate: 3.5, ammo: 120, auto: false, color: '#e9ecef' },
  { id: 'smg',    name: 'SMG',     damage: 14, range: 48,  rate: 9,   ammo: 240, auto: true,  color: '#adb5bd' },
  { id: 'shotgun',name: 'Shotgun', damage: 55, range: 26,  rate: 1.1, ammo: 40,  auto: false, color: '#6c757d' },
];

export const CAR_DEFS = [
  { id: 'comet',   name: 'Comet',    color: 0xff5d8f, top: 42, accel: 26 },
  { id: 'verde',   name: 'Verde GT', color: 0x2ec4b6, top: 46, accel: 29 },
  { id: 'dune',    name: 'Dune Buggy', color: 0xe9c46a, top: 38, accel: 24 },
  { id: 'cruiser', name: 'Cruiser',  color: 0x4361ee, top: 40, accel: 25 },
];

export const MISSIONS = [
  { id: 'm1',  title: 'Welcome to Costa Verde', brief: 'Drive to the Marina marker and meet Rico.',        target: { x: -44, z: -88 }, reward: 200,  kind: 'goto' },
  { id: 'm2',  title: 'Beachfront Pickup',      brief: 'Collect the package on the beach, then return it to Rico.', target: { x: -165, z: -40 }, reward: 350, kind: 'collect' },
  { id: 'm3',  title: 'Getaway Practice',       brief: 'Street race: beat 2 rivals to the Downtown finish line.', target: { x: 44, z: 44 }, reward: 500, kind: 'race' },
  { id: 'm4',  title: 'Turfs: Marina',          brief: 'Take the Marina. Clear the rival crew marker, then hold the block.', target: { x: -44, z: -88 }, reward: 600, kind: 'turf', district: 'marina' },
  { id: 'm5',  title: 'The Mechanic',           brief: 'Deliver the Verde GT to the garage in Old Town. Unlocks garage upgrades.', target: { x: 88, z: -88 }, reward: 700, kind: 'deliver' },
  { id: 'm6',  title: 'Highway Heat',           brief: 'Reach wanted level 3, then lose the cops. Survive the heat.', target: { x: 0, z: 0 }, reward: 800, kind: 'heat' },
  { id: 'm7',  title: 'Turfs: Old Town',         brief: 'Take Old Town from the rival crew.',              target: { x: 88, z: -88 }, reward: 900, kind: 'turf', district: 'oldtown' },
  { id: 'm8',  title: 'Stunt King',             brief: 'Hit 3 stunt ramps. Air time pays — land clean for the bonus.', target: { x: -44, z: 132 }, reward: 1000, kind: 'stunt' },
  { id: 'm9',  title: 'Turfs: Docks',           brief: 'Take the Docks. The harbour crew will not go quietly.', target: { x: -88, z: 132 }, reward: 1200, kind: 'turf', district: 'docks' },
  { id: 'm10', title: 'Costa Verde Kingpin',    brief: 'Final run: grab the shipment at the Docks and deliver it to the Hills villa under full heat.', target: { x: 100, z: 100 }, reward: 2500, kind: 'finale' },
];

export const GARAGE_UPGRADES = [
  { id: 'engine', name: 'Engine Mk II',  cost: 800,  desc: '+30% top speed' },
  { id: 'armor',  name: 'Armored Plating', cost: 600, desc: '+50 max health, less damage' },
  { id: 'nitro',  name: 'Nitro Boost',   cost: 1000, desc: 'Hold SHIFT for nitro' },
];

export const CONTROLS_TEXT = 'WASD move / drive · Mouse look · Click shoot · E steal / enter car · Q weapon wheel (1-4 switch) · R reload · G call getaway driver · B garage (near garage) · SHIFT nitro / sprint · SPACE jump / handbrake · P pause';
