// ================================================================
// main.js  —  Application Entry Point & Orchestrator
// ================================================================
//
// This file ties everything together:
//   • Builds the 2D interactive HTML grid
//   • Initialises the Three.js 3D board
//   • Handles user input (clicks, keyboard, buttons)
//   • Runs the Sudoku solver (instant or animated)
//   • Synchronises the 2D grid and 3D board during visualization
//
// ================================================================

import { SudokuBoard3D }   from './board.js';
import {
  cloneBoard,
  isSafe,
  solveSudoku,
  collectSolveSteps,
  isValidBoard,
  SAMPLE_PUZZLES
} from './sudokuSolver.js';


// ════════════════════════════════════════════════════════════════
// STATE
// All mutable application state lives here — single source of truth.
// ════════════════════════════════════════════════════════════════

let board       = Array.from({ length: 9 }, () => Array(9).fill(0));  // Current 9×9 board
let givenMask   = Array.from({ length: 9 }, () => Array(9).fill(false)); // Which cells are "given" (locked)
let selectedCell = null;    // Currently focused [row, col]
let isVisualizing = false;  // True while animation is running
let animTimeout  = null;    // Reference to the active animation timeout
let stepCount    = 0;       // Total algorithm steps taken
let backtrackCount = 0;     // Number of backtracks

// Speed: steps per "batch" per animation frame.
// Higher = faster visualization.
let animSpeed = 5;


// ════════════════════════════════════════════════════════════════
// DOM REFERENCES
// ════════════════════════════════════════════════════════════════

const gridEl          = document.getElementById('sudoku-board');
const statusBar       = document.getElementById('status-bar');
const statusIcon      = document.getElementById('status-icon');
const statusText      = document.getElementById('status-text');
const stepCountEl     = document.getElementById('step-count');
const backtrackCountEl= document.getElementById('backtrack-count');
const stepCounterEl   = document.getElementById('step-counter');
const speedRange      = document.getElementById('speed-range');
const speedLabel      = document.getElementById('speed-label');
const speedControl    = document.getElementById('speed-control');

const btnSample    = document.getElementById('btn-sample');
const btnSolve     = document.getElementById('btn-solve');
const btnVisualize = document.getElementById('btn-visualize');
const btnReset     = document.getElementById('btn-reset');
const btnCamTop    = document.getElementById('cam-top');
const btnCamAngle  = document.getElementById('cam-angle');
const btnCamFront  = document.getElementById('cam-front');


// ════════════════════════════════════════════════════════════════
// INITIALISE THREE.JS 3D BOARD
// ════════════════════════════════════════════════════════════════

const container3D = document.getElementById('threejs-container');
const board3D = new SudokuBoard3D(container3D);


// ════════════════════════════════════════════════════════════════
// BUILD THE 2D HTML GRID
// Programmatically creates 81 <div> cells inside #sudoku-board.
// ════════════════════════════════════════════════════════════════

function buildGrid() {
  gridEl.innerHTML = '';  // Clear any existing cells

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {

      const cell = document.createElement('div');
      cell.className  = 'cell';
      cell.dataset.row = row;
      cell.dataset.col = col;
      cell.tabIndex   = 0;   // Make cells focusable via keyboard Tab

      // Click → select this cell
      cell.addEventListener('click', () => selectCell(row, col));

      // Keyboard navigation within the grid
      cell.addEventListener('keydown', (e) => handleKeydown(e, row, col));

      gridEl.appendChild(cell);
    }
  }
}


// ════════════════════════════════════════════════════════════════
// CELL SELECTION
// ════════════════════════════════════════════════════════════════

function selectCell(row, col) {
  if (isVisualizing) return;  // Disable interaction during animation

  // Deselect previous cell
  if (selectedCell) {
    const [pr, pc] = selectedCell;
    getCellEl(pr, pc).classList.remove('selected');
  }

  selectedCell = [row, col];
  const cell = getCellEl(row, col);
  cell.classList.add('selected');
  cell.focus();

  setStatus('fa-solid fa-lightbulb', `Cell (row ${row + 1}, col ${col + 1}) selected. Type a number 1–9, or press Delete/Backspace to clear.`);
}


// ════════════════════════════════════════════════════════════════
// KEYBOARD INPUT
// Handles number entry and arrow-key navigation in the grid.
// ════════════════════════════════════════════════════════════════

function handleKeydown(event, row, col) {
  if (isVisualizing) return;

  const key = event.key;

  // ── Number input (1–9) ────────────────────────────────────────
  if (key >= '1' && key <= '9') {
    if (givenMask[row][col]) return;  // Can't overwrite given cells

    const num = parseInt(key, 10);

    // Validate: does this number conflict with existing cells?
    if (!isSafe(board, row, col, num)) {
      getCellEl(row, col).classList.add('invalid');
      setTimeout(() => getCellEl(row, col).classList.remove('invalid'), 400);
      setStatus('fa-solid fa-triangle-exclamation', `${num} conflicts with the row, column, or 3×3 box!`, 'backtrack');
      return;
    }

    board[row][col] = num;
    renderCell(row, col, num, 'default');
    board3D.updateCell(row, col, num, 'default');
    setStatus('fa-solid fa-circle-check', `Placed ${num} at (row ${row + 1}, col ${col + 1}).`);
  }

  // ── Clear cell (Delete / Backspace / 0) ───────────────────────
  else if (key === 'Delete' || key === 'Backspace' || key === '0') {
    if (givenMask[row][col]) return;
    board[row][col] = 0;
    renderCell(row, col, 0, 'default');
    board3D.updateCell(row, col, 0, 'default');
  }

  // ── Arrow key navigation ──────────────────────────────────────
  else if (key === 'ArrowUp'    && row > 0) selectCell(row - 1, col);
  else if (key === 'ArrowDown'  && row < 8) selectCell(row + 1, col);
  else if (key === 'ArrowLeft'  && col > 0) selectCell(row, col - 1);
  else if (key === 'ArrowRight' && col < 8) selectCell(row, col + 1);
}


// ════════════════════════════════════════════════════════════════
// RENDER HELPERS
// ════════════════════════════════════════════════════════════════

// Get the DOM element for a cell at (row, col)
function getCellEl(row, col) {
  return gridEl.querySelector(`[data-row="${row}"][data-col="${col}"]`);
}

// Update a single cell's appearance in the 2D HTML grid
function renderCell(row, col, value, state) {
  const cell = getCellEl(row, col);
  if (!cell) return;

  // Remove all state classes, then apply the correct one
  cell.classList.remove('given', 'trying', 'backtracking', 'solved-cell', 'selected');
  cell.textContent = value > 0 ? value : '';

  if (state === 'given')     cell.classList.add('given');
  if (state === 'trying')    cell.classList.add('trying');
  if (state === 'backtrack') cell.classList.add('backtracking');
  if (state === 'solved')    cell.classList.add('solved-cell');
}

// Render the complete 9×9 board (used after load/reset)
function renderFullBoard() {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const val   = board[r][c];
      const state = givenMask[r][c] ? 'given' : (val > 0 ? 'default' : 'default');
      renderCell(r, c, val, state);
    }
  }
  board3D.updateFullBoard(board, givenMask);
}


// ════════════════════════════════════════════════════════════════
// STATUS BAR HELPER
// ════════════════════════════════════════════════════════════════

function setStatus(iconClass, text, type = '') {
  statusIcon.className   = iconClass;
  statusText.textContent = text;
  statusBar.className    = 'status-bar ' + type;
  // Pop animation only when not in rapid visualization loop
  if (!isVisualizing) {
    statusIcon.classList.remove('icon-pop');
    void statusIcon.offsetWidth; // force reflow to restart animation
    statusIcon.classList.add('icon-pop');
  }
}


// ════════════════════════════════════════════════════════════════
// BUTTON: Load Sample Puzzle
// Cycles through Easy → Medium → Hard puzzles
// ════════════════════════════════════════════════════════════════

let puzzleIndex = 0;
const puzzleKeys = ['easy', 'medium', 'hard'];

btnSample.addEventListener('click', () => {
  if (isVisualizing) return;

  const key = puzzleKeys[puzzleIndex % 3];
  puzzleIndex++;

  // Load the puzzle into our board state
  board     = cloneBoard(SAMPLE_PUZZLES[key]);
  givenMask = board.map(row => row.map(v => v !== 0));

  renderFullBoard();
  setStatus('fa-solid fa-clipboard-list', `Loaded ${key.charAt(0).toUpperCase() + key.slice(1)} puzzle. Click "Solve" or "Visualize"!`);
});


// ════════════════════════════════════════════════════════════════
// BUTTON: Solve Instantly
// Runs the full backtracking algorithm at once (no animation).
// ════════════════════════════════════════════════════════════════

btnSolve.addEventListener('click', () => {
  if (isVisualizing) return;
  stopVisualization();

  // Validate the board has no conflicts before solving
  if (!isValidBoard(board)) {
    setStatus('fa-solid fa-circle-xmark', 'The board has conflicts! Fix them before solving.', 'backtrack');
    return;
  }

  const boardCopy = cloneBoard(board);  // Don't mutate the original

  setStatus('fa-solid fa-bolt', 'Solving...');

  const solved = solveSudoku(boardCopy);

  if (solved) {
    board = boardCopy;
    renderFullBoard();
    board3D.updateFullBoard(board, givenMask);

    // Animate a "wave" across all solved cells for visual flair
    animateSolvedWave();
    setStatus('fa-solid fa-star', 'Puzzle solved! The backtracking algorithm found a solution.', 'solved');
  } else {
    setStatus('fa-solid fa-circle-xmark', 'No solution exists for this puzzle. Try a different one.', 'backtrack');
  }
});


// ════════════════════════════════════════════════════════════════
// BUTTON: Visualize Solving (Step-by-Step Animation)
// ════════════════════════════════════════════════════════════════

btnVisualize.addEventListener('click', () => {
  if (isVisualizing) {
    // If already running, pressing again stops it
    stopVisualization();
    setStatus('fa-solid fa-stop', 'Visualization stopped.');
    return;
  }

  if (!isValidBoard(board)) {
    setStatus('fa-solid fa-circle-xmark', 'Board has conflicts! Fix them before visualizing.', 'backtrack');
    return;
  }

  // Collect every step the algorithm takes (try + backtrack actions)
  const steps = collectSolveSteps(cloneBoard(board));

  if (steps.length === 0) {
    setStatus('fa-solid fa-circle-xmark', 'No solution possible for this puzzle.', 'backtrack');
    return;
  }

  // Switch button text to "Stop"
  btnVisualize.innerHTML = '<i class="fa-solid fa-stop"></i> Stop Visualizing';
  isVisualizing = true;

  // Show step counters
  stepCount = 0;
  backtrackCount = 0;
  stepCountEl.textContent      = 0;
  backtrackCountEl.textContent = 0;
  stepCounterEl.classList.add('is-visible');
  speedControl.classList.add('is-visible');

  // Disable other buttons during visualization
  setBtnsDisabled(true);

  // Start playing back the steps
  playSteps(steps, 0);
});


// ── Play Steps One-by-One ─────────────────────────────────────
// This function processes `animSpeed` steps per call, then schedules
// itself for the next frame using setTimeout (non-blocking).
//
// Using setTimeout instead of a synchronous loop allows the browser
// to repaint the DOM between batches, making the animation visible.

function playSteps(steps, index) {
  if (!isVisualizing) return;  // Stopped externally

  // Process multiple steps per frame (controlled by speed slider)
  for (let i = 0; i < animSpeed && index < steps.length; i++, index++) {
    const step = steps[index];
    applyStep(step);
  }

  // Update counters in DOM
  stepCountEl.textContent      = stepCount;
  backtrackCountEl.textContent = backtrackCount;

  if (index < steps.length) {
    // Schedule next batch — delay decreases as speed increases
    const delay = Math.max(1, Math.floor(120 / animSpeed));
    animTimeout = setTimeout(() => playSteps(steps, index), delay);
  } else {
    // All steps completed → solving done!
    finishVisualization();
  }
}


// ── Apply a Single Algorithm Step to the UI ───────────────────
function applyStep(step) {
  if (step.type === 'solved') return;  // Final marker, no UI action needed

  const { row, col, num, type } = step;

  // Update the data model
  board[row][col] = num;
  stepCount++;

  if (type === 'try') {
    // The algorithm is TRYING to place this number
    renderCell(row, col, num, 'trying');
    board3D.updateCell(row, col, num, 'trying');
    setStatus('fa-solid fa-magnifying-glass', `Trying ${num} at (row ${row + 1}, col ${col + 1})`, 'trying');

  } else if (type === 'backtrack') {
    // The algorithm is BACKTRACKING — erasing a bad choice
    backtrackCount++;
    renderCell(row, col, 0, 'backtrack');
    board3D.updateCell(row, col, 0, 'backtrack');
    setStatus('fa-solid fa-rotate-left', `Backtracking at (row ${row + 1}, col ${col + 1}) — no valid number found`, 'backtrack');
  }
}


// ── Finish Visualization ──────────────────────────────────────
function finishVisualization() {
  isVisualizing = false;
  btnVisualize.innerHTML = '<i class="fa-solid fa-film"></i> Visualize Solving';
  setBtnsDisabled(false);

  // Mark all non-given cells as solved
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (!givenMask[r][c] && board[r][c] > 0) {
        renderCell(r, c, board[r][c], 'solved');
        board3D.updateCell(r, c, board[r][c], 'solved');
      }
    }
  }

  animateSolvedWave();
  setStatus(
    'fa-solid fa-trophy',
    `Solved! ${stepCount} steps, ${backtrackCount} backtracks. Algorithm: Recursion + Backtracking.`,
    'solved'
  );
}


// ── Stop / Cancel Visualization ───────────────────────────────
function stopVisualization() {
  isVisualizing = false;
  if (animTimeout) {
    clearTimeout(animTimeout);
    animTimeout = null;
  }
  btnVisualize.innerHTML = '<i class="fa-solid fa-film"></i> Visualize Solving';
  setBtnsDisabled(false);
  stepCounterEl.classList.remove('is-visible');
  speedControl.classList.remove('is-visible');
}


// ════════════════════════════════════════════════════════════════
// BUTTON: Reset
// Clears the entire board and resets all state.
// ════════════════════════════════════════════════════════════════

btnReset.addEventListener('click', () => {
  stopVisualization();

  board      = Array.from({ length: 9 }, () => Array(9).fill(0));
  givenMask  = Array.from({ length: 9 }, () => Array(9).fill(false));
  selectedCell = null;
  stepCount  = 0;
  backtrackCount = 0;

  // Clear the 2D grid DOM
  gridEl.querySelectorAll('.cell').forEach(cell => {
    cell.textContent = '';
    cell.className   = 'cell';
  });

  // Clear the 3D board
  board3D.resetBoard();

  stepCounterEl.classList.remove('is-visible');
  speedControl.classList.remove('is-visible');
  setStatus('fa-solid fa-rotate', 'Board cleared. Enter a puzzle or load a sample!');
});


// ════════════════════════════════════════════════════════════════
// SPEED SLIDER
// ════════════════════════════════════════════════════════════════

speedRange.addEventListener('input', () => {
  animSpeed = parseInt(speedRange.value, 10);
  speedLabel.textContent = animSpeed + 'x';
});


// ════════════════════════════════════════════════════════════════
// CAMERA CONTROL BUTTONS
// ════════════════════════════════════════════════════════════════

btnCamTop.addEventListener('click',   () => board3D.setCameraTop());
btnCamAngle.addEventListener('click', () => board3D.setCameraAngle());
btnCamFront.addEventListener('click', () => board3D.setCameraFront());


// ════════════════════════════════════════════════════════════════
// SOLVED WAVE ANIMATION
// After solving, cells light up in a cascading wave pattern.
// ════════════════════════════════════════════════════════════════

function animateSolvedWave() {
  // Iterate cells in diagonal order for a nicer visual sweep
  for (let d = 0; d < 17; d++) {
    for (let r = 0; r < 9; r++) {
      const c = d - r;
      if (c < 0 || c >= 9) continue;
      if (givenMask[r][c] || board[r][c] === 0) continue;

      const delay = d * 40;  // ms delay proportional to diagonal index
      setTimeout(() => {
        const cell = getCellEl(r, c);
        if (cell) {
          cell.style.transition = 'background 0.3s ease';
          cell.classList.add('solved-cell');
        }
      }, delay);
    }
  }
}


// ════════════════════════════════════════════════════════════════
// UTILITY: Enable / Disable buttons during animation
// ════════════════════════════════════════════════════════════════

function setBtnsDisabled(disabled) {
  [btnSample, btnSolve, btnReset].forEach(btn => (btn.disabled = disabled));
}


// ════════════════════════════════════════════════════════════════
// INITIALISE
// Build the grid and load a sample puzzle on startup so the user
// immediately sees a working demo.
// ════════════════════════════════════════════════════════════════

buildGrid();

// Auto-load the easy puzzle so the page feels alive immediately
board     = cloneBoard(SAMPLE_PUZZLES.easy);
givenMask = board.map(row => row.map(v => v !== 0));
renderFullBoard();

setStatus('fa-solid fa-hand', 'Welcome! A sample puzzle is loaded. Click "Solve" or "Visualize Solving" to see the AI algorithm in action!');

// ── Final console message for developers / students ───────────
console.log(`
╔══════════════════════════════════════════════════════╗
║        AI Sudoku Solver — Academic Project           ║
║  Algorithm: Recursion + Backtracking (DFS)           ║
║  Tech: Vite.js + Three.js                            ║
╠══════════════════════════════════════════════════════╣
║  Key files:                                          ║
║    sudokuSolver.js  → backtracking algorithm         ║
║    board.js         → Three.js 3D rendering          ║
║    main.js          → UI orchestration               ║
╚══════════════════════════════════════════════════════╝
`);
