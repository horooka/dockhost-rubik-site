import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  MOVE_SPIN,
  SOLVED,
  colorHex,
  cubieSlotAfterMove,
  inAnimateLayer,
  parseMoves,
  stickerAt,
  wcaMoveToInternal,
} from "/cube/state.js";

const GAP = 0.04;
const SIZE = 0.92;
const ANIM_MS = 180;
const STEP = SIZE + GAP;
const INNER = 0x1a1a22;

const FACE_AXES = {
  R: new THREE.Vector3(1, 0, 0),
  L: new THREE.Vector3(-1, 0, 0),
  U: new THREE.Vector3(0, 1, 0),
  D: new THREE.Vector3(0, -1, 0),
  F: new THREE.Vector3(0, 0, 1),
  B: new THREE.Vector3(0, 0, -1),
  M: new THREE.Vector3(-1, 0, 0),
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

const LOCAL_FACES = ["R", "L", "U", "D", "F", "B"];

function gridPosition(x, y, z) {
  return new THREE.Vector3((x - 1) * STEP, (y - 1) * STEP, (z - 1) * STEP);
}

export class CubeRenderer {
  constructor(container, state) {
    this.state = state;
    this.busy = false;
    this.queue = [];

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x12141d);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.camera.position.set(4.5, 4.2, 5.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 12;

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x666677, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 0.35);
    key.position.set(5, 8, 6);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.25);
    fill.position.set(-4, -2, -5);
    this.scene.add(fill);

    this.cubies = [];
    this._buildCubies();
    this._resize();
    window.addEventListener("resize", () => this._resize());
    this._loop();
  }

  _resize() {
    const w = this.renderer.domElement.clientWidth || 480;
    const h = this.renderer.domElement.clientHeight || 480;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  _loop() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this._loop());
  }

  reset() {
    this.state.facelets = SOLVED;
    this.state.moveCount = 0;
    this._buildCubies();
  }

  _buildCubies() {
    for (const c of this.cubies) this.scene.remove(c.mesh);
    this.cubies = [];

    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        for (let z = 0; z < 3; z++) {
          if (x === 1 && y === 1 && z === 1) continue;
          const mesh = this._makeCubie();
          mesh.position.copy(gridPosition(x, y, z));
          this.scene.add(mesh);
          this.cubies.push({ x, y, z, mesh });
        }
      }
    }
    this._paintAll();
  }

  _makeCubie() {
    const geo = new THREE.BoxGeometry(SIZE, SIZE, SIZE);
    const mats = LOCAL_FACES.map(
      () => new THREE.MeshBasicMaterial({ color: INNER }),
    );
    const mesh = new THREE.Mesh(geo, mats);
    mesh.quaternion.identity();
    return mesh;
  }

  _paintCubie(c) {
    LOCAL_FACES.forEach((face, i) => {
      const letter = stickerAt(this.state.facelets, c.x, c.y, c.z, face);
      c.mesh.material[i].color.setHex(letter ? colorHex(letter) : INNER);
    });
  }

  _paintAll() {
    for (const c of this.cubies) {
      c.mesh.position.copy(gridPosition(c.x, c.y, c.z));
      c.mesh.quaternion.identity();
      this._paintCubie(c);
    }
  }

  _applySlotPermutation(selected, move) {
    const updates = selected.map((c) => ({
      c,
      pos: cubieSlotAfterMove(move, c.x, c.y, c.z),
    }));
    for (const { c, pos } of updates) {
      [c.x, c.y, c.z] = pos;
    }
  }

  async animateMove(move, { wca = false } = {}) {
    const animMove = wca ? wcaMoveToInternal(move) : move;
    const stateMove = wca ? wcaMoveToInternal(move) : move;
    const face = animMove[0];
    const axis = FACE_AXES[face].clone();
    let angle = (Math.PI / 2) * MOVE_SPIN[face];
    if (animMove.includes("'")) angle *= -1;
    if (animMove.includes("2")) angle *= 2;

    const selected = this.cubies.filter((c) =>
      inAnimateLayer(animMove, c.x, c.y, c.z),
    );
    if (!selected.length) {
      this.state.apply(stateMove);
      this._paintAll();
      return;
    }

    const group = new THREE.Group();
    this.scene.add(group);

    const pivot = new THREE.Vector3();
    for (const c of selected) {
      pivot.add(c.mesh.position);
    }
    pivot.multiplyScalar(1 / selected.length);
    group.position.copy(pivot);

    for (const c of selected) {
      this.scene.remove(c.mesh);
      group.add(c.mesh);
      c.mesh.position.sub(pivot);
    }

    const turnAxis = axis.clone().normalize();
    const turnQuat = new THREE.Quaternion();

    await this._tween((t) => {
      group.rotation.set(0, 0, 0);
      turnQuat.setFromAxisAngle(turnAxis, angle * t);
      group.quaternion.copy(turnQuat);
    });

    for (const c of selected) {
      group.remove(c.mesh);
      this.scene.add(c.mesh);
    }
    group.position.set(0, 0, 0);
    group.rotation.set(0, 0, 0);
    group.quaternion.identity();
    this.scene.remove(group);

    this.state.apply(stateMove);
    this._applySlotPermutation(selected, animMove);

    for (const c of selected) {
      c.mesh.position.copy(gridPosition(c.x, c.y, c.z));
      c.mesh.quaternion.identity();
      this._paintCubie(c);
    }
  }

  _tween(fn) {
    return new Promise((resolve) => {
      const start = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - start) / ANIM_MS);
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        fn(ease);
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  async runMove(move, opts = {}) {
    this.queue.push({ move, opts });
    if (this.busy) return;
    this.busy = true;
    while (this.queue.length) {
      const { move: m, opts: o } = this.queue.shift();
      await this.animateMove(m, o);
    }
    this.busy = false;
  }

  async runSequence(notation, opts = {}) {
    for (const m of parseMoves(notation)) await this.runMove(m, opts);
  }

  async scramble(notation) {
    this.reset();
    await this.runSequence(notation, { wca: true });
  }
}
