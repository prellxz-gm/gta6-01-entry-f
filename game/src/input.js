// Costa Verde — input.js
// Keyboard + mouse state. No gameplay randomness here.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouseDX = 0; this.mouseDY = 0;
    this.mouseDown = false;
    this.mouseClicked = false; // consumed by main loop each tick
    this.wheelDelta = 0;
    this.anyKey = false;
    this._onKeyDown = (e) => {
      if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code); this.anyKey = true;
      if (e.code === 'KeyQ') this.wheelToggle = true;
    };
    this._onKeyUp = (e) => { this.keys.delete(e.code); this._consumed?.delete(e.code); };
    this._onMouseMove = (e) => { this.mouseDX += e.movementX || 0; this.mouseDY += e.movementY || 0; };
    this._onMouseDown = (e) => { if (e.button === 0) { this.mouseDown = true; this.mouseClicked = true; } };
    this._onMouseUp = (e) => { if (e.button === 0) this.mouseDown = false; };
    this._onBlur = () => { this.keys.clear(); this.mouseDown = false; };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('blur', this._onBlur);
    this.canvas = canvas;
    this.wheelToggle = false;
  }
  down(code) { return this.keys.has(code); }
  pressed(code) { // edge-triggered, consumed once until keyup (safe across
    // multiple fixed-timestep ticks inside a single rendered frame)
    if (this.keys.has(code) && !this._prev?.has(code) && !this._consumed?.has(code)) {
      (this._consumed ??= new Set()).add(code);
      return true;
    }
    return false;
  }
  axis() {
    let x = 0, z = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) z -= 1;
    if (this.down('KeyS') || this.down('ArrowDown')) z += 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    return { x, z };
  }
  snapshotPrev() { this._prev = new Set(this.keys); }
  consumeMouse() { const dx = this.mouseDX, dy = this.mouseDY; this.mouseDX = 0; this.mouseDY = 0; const c = this.mouseClicked; this.mouseClicked = false; return { dx, dy, clicked: c }; }
  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('blur', this._onBlur);
  }
}
