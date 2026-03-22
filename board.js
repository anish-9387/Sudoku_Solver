// ================================================================
// board.js  —  Three.js 3D Sudoku Board
// ================================================================
//
// PURPOSE: Creates and manages the 3D visual representation of the
//          Sudoku board using Three.js (a WebGL/3D library).
//
// KEY THREE.JS CONCEPTS USED:
//   • Scene       — the 3D world that holds all objects
//   • Camera      — the viewpoint into the scene (PerspectiveCamera)
//   • Renderer    — draws the scene onto a <canvas> element
//   • Geometry    — the shape of a 3D object (BoxGeometry = cube/box)
//   • Material    — the appearance of a surface (color, texture)
//   • Mesh        — geometry + material combined into a renderable object
//   • Texture     — an image drawn onto a surface (used for numbers)
//   • OrbitControls — mouse/touch controls for rotating, zooming, panning
//   • Light        — illuminates the scene (AmbientLight + DirectionalLight)
// ================================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';


// ────────────────────────────────────────────────────────────────
// CONSTANTS
// ────────────────────────────────────────────────────────────────

const CELL_SIZE   = 1.0;    // Width/height of each cell cube
const CELL_GAP    = 0.06;   // Tiny gap between adjacent cells
const BOX_GAP     = 0.14;   // Larger gap between 3×3 boxes
const CELL_DEPTH  = 0.25;   // How "thick" (Z-axis) each cell is

// Cell colours in different algorithm states (as hex numbers)
const COLORS = {
  default:    0x1e1e40,
  given:      0x162a4a,
  trying:     0x1a4a1a,
  backtrack:  0x4a1a1a,
  solved:     0x1a4a2a,
  selected:   0x2a2a6a,
  gridLine:   0x4fc3f7,
  boxLine:    0x7c4dff,
};

// Text colour on cell faces (as CSS strings, used in canvas textures)
const TEXT_COLORS = {
  given:     '#4fc3f7',
  placed:    '#a5d6a7',
  backtrack: '#ef9a9a',
  solved:    '#ffa726',
};


// ────────────────────────────────────────────────────────────────
// SudokuBoard3D  —  Main class managing the entire 3D scene
// ────────────────────────────────────────────────────────────────
export class SudokuBoard3D {

  // ── Constructor ──────────────────────────────────────────────
  constructor(containerElement) {
    this.container = containerElement;
    this.cellMeshes = [];   // 2D array [row][col] of Three.js Mesh objects

    this._setupScene();
    this._setupLights();
    this._setupCamera();
    this._setupControls();
    this._buildGrid();
    this._setupResizeHandler();
    this._startRenderLoop();
  }


  // ── Scene Setup ──────────────────────────────────────────────
  // The Scene is the "world" — everything lives inside it.
  _setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x08081a);

    // Subtle fog makes distant objects fade into the background
    this.scene.fog = new THREE.FogExp2(0x08081a, 0.04);

    // Renderer: translates Three.js scene into WebGL pixels
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,      // Smooth edges
      alpha: true,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Size the renderer to match the container div
    const { width, height } = this.container.getBoundingClientRect();
    this.renderer.setSize(width || 600, height || 500);

    // Inject the <canvas> element into the page
    this.container.appendChild(this.renderer.domElement);
  }


  // ── Lights ───────────────────────────────────────────────────
  // Without lights, all materials appear black.
  _setupLights() {
    // AmbientLight: fills the scene with soft uniform light (no shadows)
    const ambient = new THREE.AmbientLight(0x404070, 1.5);
    this.scene.add(ambient);

    // DirectionalLight: like sunlight — parallel rays, casts shadows
    const dirLight = new THREE.DirectionalLight(0xffffff, 2);
    dirLight.position.set(8, 12, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width  = 2048;
    dirLight.shadow.mapSize.height = 2048;
    this.scene.add(dirLight);

    // A second softer fill light from the opposite side
    const fillLight = new THREE.DirectionalLight(0x4040aa, 0.8);
    fillLight.position.set(-6, -4, -6);
    this.scene.add(fillLight);

    // PointLight in the center of the board for a nice glow effect
    this.centerLight = new THREE.PointLight(0x4fc3f7, 0.8, 20);
    this.centerLight.position.set(0, 2, 0);
    this.scene.add(this.centerLight);
  }


  // ── Camera ───────────────────────────────────────────────────
  // PerspectiveCamera mimics how human eyes see (objects farther
  // away appear smaller). Parameters: FOV, aspect ratio, near/far clip.
  _setupCamera() {
    const { width, height } = this.container.getBoundingClientRect();
    const aspect = (width || 600) / (height || 500);

    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 200);
    this.camera.position.set(0, 16, 16);   // Start at an angled view
    this.camera.lookAt(0, 0, 0);
  }


  // ── OrbitControls ────────────────────────────────────────────
  // Allows the user to rotate (orbit), zoom, and pan the camera
  // using mouse or touch input.
  _setupControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;    // Smooth inertia effect
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance   = 6;       // Minimum zoom-in distance
    this.controls.maxDistance   = 40;      // Maximum zoom-out distance
    this.controls.maxPolarAngle = Math.PI / 1.8;  // Prevent flipping upside-down
    this.controls.target.set(0, 0, 0);
  }


  // ── Build the 9×9 Grid ────────────────────────────────────────
  // Creates 81 cell meshes and positions them in the scene.
  _buildGrid() {
    this.cellMeshes = Array.from({ length: 9 }, () => Array(9).fill(null));

    // Total board span (we'll use this to center the grid at origin)
    // Each cell takes CELL_SIZE + CELL_GAP, plus BOX_GAP at box boundaries
    const totalSpan = 9 * (CELL_SIZE + CELL_GAP) + 2 * (BOX_GAP - CELL_GAP);

    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {

        // ── Geometry ──────────────────────────────────────────
        // BoxGeometry creates a rectangular box (cuboid).
        // Arguments: width, height, depth
        const geometry = new THREE.BoxGeometry(
          CELL_SIZE, CELL_SIZE, CELL_DEPTH
        );

        // ── Material ──────────────────────────────────────────
        // MeshStandardMaterial interacts with light (realistic shading).
        // We create 6 materials — one per face of the box.
        // The top face (+Z) will show the number texture.
        const materials = this._createCellMaterials(COLORS.default);

        // ── Mesh ──────────────────────────────────────────────
        // A Mesh combines geometry + material into a renderable 3D object.
        const mesh = new THREE.Mesh(geometry, materials);
        mesh.castShadow    = true;
        mesh.receiveShadow = true;

        // Calculate world position for this cell
        const pos = this._cellPosition(row, col, totalSpan);
        mesh.position.set(pos.x, pos.y, 0);

        // Store row/col metadata on the mesh for easy lookup later
        mesh.userData = { row, col, state: 'default', value: 0 };

        this.scene.add(mesh);
        this.cellMeshes[row][col] = mesh;
      }
    }

    // Draw box-separator lines to visually divide the 3×3 boxes
    this._drawBoxBorders(totalSpan);

    // Add a base platform beneath the board
    this._addBasePlatform(totalSpan);
  }


  // ── Cell Position Calculator ──────────────────────────────────
  // Converts grid (row, col) indices to a Three.js world (x, y) position.
  _cellPosition(row, col, totalSpan) {
    const step = CELL_SIZE + CELL_GAP;

    // Add an extra BOX_GAP at each 3×3 box boundary
    const extraX = Math.floor(col / 3) * (BOX_GAP - CELL_GAP);
    const extraY = Math.floor(row / 3) * (BOX_GAP - CELL_GAP);

    const x = col * step + extraX - totalSpan / 2 + CELL_SIZE / 2;
    const y = -(row * step + extraY - totalSpan / 2 + CELL_SIZE / 2);

    return { x, y };
  }


  // ── Create Cell Materials (6 faces) ───────────────────────────
  // Three.js BoxGeometry has 6 faces: right, left, top, bottom, front, back
  // We apply different materials to distinguish the "display face" (front)
  // from the sides.
  _createCellMaterials(color, textureCanvas = null) {
    const sideMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.7,
      metalness: 0.1,
    });

    // Front face (+Z): show the number texture if provided
    const frontMat = textureCanvas
      ? new THREE.MeshStandardMaterial({
          map: new THREE.CanvasTexture(textureCanvas),
          roughness: 0.4,
          metalness: 0.2,
        })
      : new THREE.MeshStandardMaterial({
          color,
          roughness: 0.4,
          metalness: 0.2,
          emissive: new THREE.Color(color).multiplyScalar(0.15),
        });

    // BoxGeometry face order: right, left, top, bottom, front (+Z), back (-Z)
    return [sideMat, sideMat, sideMat, sideMat, frontMat, sideMat];
  }


  // ── Draw 3×3 Box Border Lines ─────────────────────────────────
  // Creates bright line borders to visually separate the nine 3×3 boxes.
  _drawBoxBorders(totalSpan) {
    const material = new THREE.LineBasicMaterial({
      color: COLORS.boxLine,
      linewidth: 2,  // Note: linewidth > 1 only works on some systems
    });

    const halfSpan = totalSpan / 2;
    const z = CELL_DEPTH / 2 + 0.01;  // Slightly in front of cells

    // Draw vertical dividers at col=3 and col=6
    for (let boxCol of [1, 2]) {
      const xPos = this._boxBorderOffset(boxCol, totalSpan);
      const points = [
        new THREE.Vector3(xPos, -halfSpan, z),
        new THREE.Vector3(xPos,  halfSpan, z),
      ];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      this.scene.add(new THREE.Line(geometry, material));
    }

    // Draw horizontal dividers at row=3 and row=6
    for (let boxRow of [1, 2]) {
      const yPos = -this._boxBorderOffset(boxRow, totalSpan);
      const points = [
        new THREE.Vector3(-halfSpan, yPos, z),
        new THREE.Vector3( halfSpan, yPos, z),
      ];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      this.scene.add(new THREE.Line(geometry, material));
    }

    // Outer board border
    const borderGeo = new THREE.EdgesGeometry(
      new THREE.BoxGeometry(totalSpan + 0.1, totalSpan + 0.1, 0.05)
    );
    const borderMat = new THREE.LineBasicMaterial({ color: COLORS.gridLine });
    const border = new THREE.LineSegments(borderGeo, borderMat);
    border.position.z = z - 0.05;
    this.scene.add(border);
  }

  _boxBorderOffset(boxIndex, totalSpan) {
    const step = CELL_SIZE + CELL_GAP;
    return boxIndex * 3 * step + boxIndex * (BOX_GAP - CELL_GAP) - totalSpan / 2;
  }


  // ── Base Platform ─────────────────────────────────────────────
  // A flat glowing platform beneath the grid for aesthetics.
  _addBasePlatform(totalSpan) {
    const geo = new THREE.BoxGeometry(totalSpan + 0.6, totalSpan + 0.6, 0.12);
    const mat = new THREE.MeshStandardMaterial({
      color:     0x0a0a25,
      roughness: 0.9,
      metalness: 0.1,
      emissive:  new THREE.Color(0x0a0a35),
    });
    const platform = new THREE.Mesh(geo, mat);
    platform.position.z = -CELL_DEPTH / 2 - 0.06;
    platform.receiveShadow = true;
    this.scene.add(platform);
  }


  // ── Number Texture Factory ────────────────────────────────────
  // Three.js doesn't natively render text as 3D geometry easily, so
  // we draw the number onto an HTML <canvas> element and use it as
  // a texture map on the cell's front face.
  _makeNumberTexture(number, textColor) {
    const size = 128;  // Canvas resolution in pixels
    const canvas = document.createElement('canvas');
    canvas.width  = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');

    // Transparent background (lets cell colour show through)
    ctx.clearRect(0, 0, size, size);

    if (number > 0) {
      // Draw a subtle glow behind the number
      ctx.shadowColor = textColor;
      ctx.shadowBlur  = 20;

      ctx.fillStyle = textColor;
      ctx.font      = `bold ${Math.floor(size * 0.65)}px "Segoe UI", Arial, sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(number), size / 2, size / 2);
    }

    return canvas;
  }


  // ── Public: Update a single cell's display ────────────────────
  // Called by main.js whenever the algorithm tries / backtracks / solves.
  //
  //  state: 'default' | 'given' | 'trying' | 'backtrack' | 'solved'
  //  value: 0–9 (0 = empty)
  updateCell(row, col, value, state = 'default') {
    const mesh = this.cellMeshes[row][col];
    if (!mesh) return;

    mesh.userData.state = state;
    mesh.userData.value = value;

    // Choose colour based on state
    const colorMap = {
      default:   COLORS.default,
      given:     COLORS.given,
      trying:    COLORS.trying,
      backtrack: COLORS.backtrack,
      solved:    COLORS.solved,
      selected:  COLORS.selected,
    };
    const cellColor = colorMap[state] ?? COLORS.default;

    // Choose text colour
    const textColorMap = {
      given:     TEXT_COLORS.given,
      trying:    TEXT_COLORS.placed,
      backtrack: TEXT_COLORS.backtrack,
      solved:    TEXT_COLORS.solved,
      default:   TEXT_COLORS.placed,
      selected:  TEXT_COLORS.placed,
    };
    const textColor = textColorMap[state] ?? '#ffffff';

    // Rebuild the materials with the new colour and number texture
    const textCanvas = this._makeNumberTexture(value, textColor);
    const newMaterials = this._createCellMaterials(cellColor, value > 0 ? textCanvas : null);

    // Dispose of old textures to avoid GPU memory leaks
    mesh.material.forEach(m => {
      if (m.map) m.map.dispose();
      m.dispose();
    });

    mesh.material = newMaterials;

    // Small elevation animation: raise the cell when it's "active"
    const targetZ = (state === 'trying' || state === 'backtrack') ? 0.18 : 0;
    mesh.position.z = targetZ;
  }


  // ── Public: Update the full board at once ─────────────────────
  // Used after "Solve Instantly" to display the final board state.
  updateFullBoard(board, givenMask) {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const val = board[r][c];
        const state = val === 0
          ? 'default'
          : givenMask[r][c] ? 'given' : 'solved';
        this.updateCell(r, c, val, state);
      }
    }
  }


  // ── Public: Reset all cells to empty default ──────────────────
  resetBoard() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        this.updateCell(r, c, 0, 'default');
      }
    }
  }


  // ── Camera Preset Positions ────────────────────────────────────
  setCameraTop() {
    this._animateCamera(new THREE.Vector3(0, 0.01, 22), new THREE.Vector3(0, 0, 0));
  }

  setCameraAngle() {
    this._animateCamera(new THREE.Vector3(0, 16, 16), new THREE.Vector3(0, 0, 0));
  }

  setCameraFront() {
    this._animateCamera(new THREE.Vector3(0, 3, 20), new THREE.Vector3(0, 0, 0));
  }

  // Smoothly interpolate the camera to a new position
  _animateCamera(targetPos, targetLook) {
    const startPos  = this.camera.position.clone();
    const startTime = performance.now();
    const duration  = 800;  // milliseconds

    const animate = (now) => {
      const t = Math.min((now - startTime) / duration, 1);
      // Ease-in-out curve for smooth acceleration/deceleration
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      this.camera.position.lerpVectors(startPos, targetPos, ease);
      this.controls.target.lerp(targetLook, ease);
      this.controls.update();

      if (t < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }


  // ── Responsive Resize Handler ──────────────────────────────────
  _setupResizeHandler() {
    const onResize = () => {
      const { width, height } = this.container.getBoundingClientRect();
      if (width === 0 || height === 0) return;

      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    };

    window.addEventListener('resize', onResize);
    // Also observe container size changes (e.g., panel resizing)
    new ResizeObserver(onResize).observe(this.container);
  }


  // ── Render Loop ───────────────────────────────────────────────
  // Three.js requires continuously re-rendering the scene.
  // requestAnimationFrame syncs with the screen refresh rate (~60fps).
  _startRenderLoop() {
    const animate = () => {
      requestAnimationFrame(animate);

      // Update OrbitControls (needed for damping/inertia to work)
      this.controls.update();

      // Gently pulse the center point light for a living-board effect
      const t = performance.now() * 0.001;
      this.centerLight.intensity = 0.6 + 0.3 * Math.sin(t * 1.5);

      // Render the scene from the camera's perspective
      this.renderer.render(this.scene, this.camera);
    };

    animate();
  }

}
