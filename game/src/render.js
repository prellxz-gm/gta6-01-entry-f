// Costa Verde — render.js
// Renderer + third-person camera + minimap (2D canvas, top-down).
import * as THREE from 'three';
import { CONFIG, DISTRICTS } from './config.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = false;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  return { renderer, scene, camera };
}

// Smooth third-person camera: behind + above the player/car, look ahead.
export function updateCamera(camera, px, pz, heading, inCar, speed, dt, camState) {
  const dist = inCar ? 13 : 9;
  const height = inCar ? 5.2 : 4.2;
  const backX = Math.sin(heading) * dist;
  const backZ = Math.cos(heading) * dist;
  const tx = px + backX, tz = pz + backZ;
  const k = 1 - Math.pow(0.0015, dt); // frame-rate independent smoothing
  camState.x += (tx - camState.x) * k;
  camState.z += (tz - camState.z) * k;
  camState.y += ((height) - camState.y) * k;
  camera.position.set(camState.x, camState.y, camState.z);
  const lookX = px - Math.sin(heading) * 6 - Math.sin(heading) * speed * 0.12;
  const lookZ = pz - Math.cos(heading) * 6 - Math.cos(heading) * speed * 0.12;
  camera.lookAt(lookX, 1.6, lookZ);
}

// Minimap: roads, beach, districts (owned = filled), player, cars, cops, marker.
export function drawMinimap(ctx, state) {
  const S = 168, W = state.worldSize;
  const toMap = (x, z) => [((x + W / 2) / W) * S, ((z + W / 2) / W) * S];
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = 'rgba(20,28,38,0.85)';
  ctx.fillRect(0, 0, S, S);
  // sea + sand
  ctx.fillStyle = '#2a7f9e';
  ctx.fillRect(0, 0, ((CONFIG.seaX + 30 + W / 2) / W) * S, S);
  ctx.fillStyle = '#e8d29a';
  ctx.fillRect(((CONFIG.seaX + 30 + W / 2) / W) * S, 0, 14, S);
  // roads
  ctx.strokeStyle = '#5a6270'; ctx.lineWidth = 3;
  for (let v = -176; v <= 176; v += CONFIG.roadSpacing) {
    const [ax] = toMap(v, 0); const [, az] = toMap(0, v);
    ctx.beginPath(); ctx.moveTo(ax, 0); ctx.lineTo(ax, S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, az); ctx.lineTo(S, az); ctx.stroke();
  }
  // districts
  for (const d of DISTRICTS) {
    const [mx, mz] = toMap(d.cx, d.cz);
    const mr = (d.r / W) * S;
    ctx.beginPath(); ctx.arc(mx, mz, mr, 0, Math.PI * 2);
    ctx.fillStyle = state.ownedDistricts.includes(d.id) ? d.color + '88' : d.color + '22';
    ctx.fill();
    ctx.strokeStyle = d.color; ctx.lineWidth = 1;
    ctx.stroke();
  }
  // mission marker
  if (state.missionTarget) {
    const [mx, mz] = toMap(state.missionTarget.x, state.missionTarget.z);
    ctx.fillStyle = '#ffe66d';
    ctx.beginPath(); ctx.arc(mx, mz, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.stroke();
  }
  // garage
  const [gx, gz] = toMap(88, -78);
  ctx.fillStyle = '#4361ee'; ctx.fillRect(gx - 4, gz - 4, 8, 8);
  // cops
  ctx.fillStyle = '#ff4040';
  for (const c of state.cops) {
    const [mx, mz] = toMap(c.x, c.z);
    ctx.beginPath(); ctx.arc(mx, mz, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  // player arrow
  const [px, pz] = toMap(state.player.x, state.player.z);
  ctx.save();
  ctx.translate(px, pz); ctx.rotate(Math.atan2(Math.sin(state.player.heading), Math.cos(state.player.heading)) + Math.PI);
  ctx.fillStyle = state.player.inCar ? '#2ec4b6' : '#ffffff';
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
  ctx.restore();
}
