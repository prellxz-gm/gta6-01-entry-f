// Costa Verde — main.ts (variant F entrypoint)
// Copies game/ + screenshots/ into the output dir, then builds dossier.json
// with the kit's buildDossier helper. Node stdlib only (plus the vendor import).
import { cpSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const out = resolve(process.env.MAKEFUN_OUTPUT_DIR || 'out');
mkdirSync(out, { recursive: true });

const root = resolve(import.meta.dirname ?? '.');
const gameSrc = join(root, 'game');
const shotsSrc = join(root, 'screenshots');

if (existsSync(gameSrc)) cpSync(gameSrc, join(out, 'game'), { recursive: true });
if (existsSync(shotsSrc)) cpSync(shotsSrc, join(out, 'screenshots'), { recursive: true });

const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

// buildDossier returns the dossier bytes (Uint8Array); write them verbatim so
// the output is byte-deterministic across runs (no timestamps injected here).
const bytes = dossier instanceof Uint8Array ? dossier : new TextEncoder().encode(String(dossier));
writeFileSync(join(out, 'dossier.json'), bytes);
console.log('Costa Verde dossier written to', join(out, 'dossier.json'), `(${bytes.length} bytes)`);
