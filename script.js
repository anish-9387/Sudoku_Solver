/* ================================================================
       SUDOKU SOLVER — complete logic + 2D board + 3D CSS board
    ================================================================ */

// ── Sample puzzles (5 total; includes 1 unsolvable) ─────────────
const SAMPLE_BOARDS = [
    {
        name: 'Sample 1 (Easy)',
        unsolvable: false,
        board: [
            [5, 3, 0, 0, 7, 0, 0, 0, 0],
            [6, 0, 0, 1, 9, 5, 0, 0, 0],
            [0, 9, 8, 0, 0, 0, 0, 6, 0],
            [8, 0, 0, 0, 6, 0, 0, 0, 3],
            [4, 0, 0, 8, 0, 3, 0, 0, 1],
            [7, 0, 0, 0, 2, 0, 0, 0, 6],
            [0, 6, 0, 0, 0, 0, 2, 8, 0],
            [0, 0, 0, 4, 1, 9, 0, 0, 5],
            [0, 0, 0, 0, 8, 0, 0, 7, 9]
        ]
    },
    {
        name: 'Sample 2 (Medium)',
        unsolvable: false,
        board: [
            [0, 0, 0, 2, 6, 0, 7, 0, 1],
            [6, 8, 0, 0, 7, 0, 0, 9, 0],
            [1, 9, 0, 0, 0, 4, 5, 0, 0],
            [8, 2, 0, 1, 0, 0, 0, 4, 0],
            [0, 0, 4, 6, 0, 2, 9, 0, 0],
            [0, 5, 0, 0, 0, 3, 0, 2, 8],
            [0, 0, 9, 3, 0, 0, 0, 7, 4],
            [0, 4, 0, 0, 5, 0, 0, 3, 6],
            [7, 0, 3, 0, 1, 8, 0, 0, 0]
        ]
    },
    {
        name: 'Sample 3 (Hard)',
        unsolvable: false,
        board: [
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 3, 0, 8, 5],
            [0, 0, 1, 0, 2, 0, 0, 0, 0],
            [0, 0, 0, 5, 0, 7, 0, 0, 0],
            [0, 0, 4, 0, 0, 0, 1, 0, 0],
            [0, 9, 0, 0, 0, 0, 0, 0, 0],
            [5, 0, 0, 0, 0, 0, 0, 7, 3],
            [0, 0, 2, 0, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 4, 0, 0, 0, 9]
        ]
    },
    {
        name: 'Sample 4 (Expert)',
        unsolvable: false,
        board: [
            [8, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 3, 6, 0, 0, 0, 0, 0],
            [0, 7, 0, 0, 9, 0, 2, 0, 0],
            [0, 5, 0, 0, 0, 7, 0, 0, 0],
            [0, 0, 0, 0, 4, 5, 7, 0, 0],
            [0, 0, 0, 1, 0, 0, 0, 3, 0],
            [0, 0, 1, 0, 0, 0, 0, 6, 8],
            [0, 0, 8, 5, 0, 0, 0, 1, 0],
            [0, 9, 0, 0, 0, 0, 4, 0, 0]
        ]
    },
    {
        name: 'Sample 5 (Unsolvable)',
        unsolvable: true,
        board: [
            [5, 5, 0, 0, 7, 0, 0, 0, 0],
            [6, 0, 0, 1, 9, 5, 0, 0, 0],
            [0, 9, 8, 0, 0, 0, 0, 6, 0],
            [8, 0, 0, 0, 6, 0, 0, 0, 3],
            [4, 0, 0, 8, 0, 3, 0, 0, 1],
            [7, 0, 0, 0, 2, 0, 0, 0, 6],
            [0, 6, 0, 0, 0, 0, 2, 8, 0],
            [0, 0, 0, 4, 1, 9, 0, 0, 5],
            [0, 0, 0, 0, 8, 0, 0, 7, 9]
        ]
    }
];

let sampleIndex = 0;

// ── State ────────────────────────────────────────────────────────
let board = Array.from({ length: 9 }, () => Array(9).fill(0));
let given = Array.from({ length: 9 }, () => Array(9).fill(false));
let stepCount = 0, backtrackCount = 0, filledCount = 0;
let solving = false, visualizing = false;
let paused = false;
let animSpeed = 5;
const pauseWaiters = [];

const cellKey = (r, c) => `${r},${c}`;

const statusTextEl = document.getElementById('status-text');
const statusBarEl = document.getElementById('status-bar');
const statusIconEl = document.getElementById('status-icon');
const stepCountEl = document.getElementById('step-count');
const backtrackCountEl = document.getElementById('backtrack-count');
const filledCountEl = document.getElementById('filled-count');
const tstatCellsEl = document.getElementById('tstat-cells');
const tstatEmptyEl = document.getElementById('tstat-empty');
const timelineFillEl = document.getElementById('timeline-fill');
const speedWrapEl = document.getElementById('speed-wrap');
const tstatStepsEl = document.getElementById('tstat-steps');

const STATUS_MAP = {
    idle: ['◉', 'idle'],
    solving: ['⟳', 'solving'],
    paused: ['⏸', 'idle'],
    solved: ['✔', 'solved'],
    error: ['✖', 'error']
};

// ── Build 2D Grid ────────────────────────────────────────────────
const grid2d = document.getElementById('sudoku-board');
const cells2d = [];

for (let r = 0; r < 9; r++) {
    cells2d[r] = [];
    for (let c = 0; c < 9; c++) {
        const inp = document.createElement('input');
        inp.type = 'text'; inp.maxLength = 1;
        inp.className = 'cell';
        inp.dataset.row = r; inp.dataset.col = c;
        inp.addEventListener('keydown', e => onCellKey(e, r, c));
        inp.addEventListener('input', e => onCellInput(e, r, c));
        grid2d.appendChild(inp);
        cells2d[r][c] = inp;
    }
}

function onCellKey(e, r, c) {
    const dirs = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (dirs[e.key]) {
        e.preventDefault();
        const [dr, dc] = dirs[e.key];
        const nr = (r + dr + 9) % 9, nc = (c + dc + 9) % 9;
        cells2d[nr][nc].focus();
    }
}

function onCellInput(e, r, c) {
    if (given[r][c]) return;
    const v = parseInt(e.target.value);
    board[r][c] = (isNaN(v) || v < 1 || v > 9) ? 0 : v;
    e.target.value = board[r][c] || '';
    updateCounters();
    sync3D();
}

// ── Build 3D Grid (CSS) ──────────────────────────────────────────
const board3d = document.getElementById('board-3d');
const cells3d = [];

for (let r = 0; r < 9; r++) {
    cells3d[r] = [];
    for (let c = 0; c < 9; c++) {
        const div = document.createElement('div');
        div.className = 'cell-3d';
        if (c === 2 || c === 5) div.classList.add('box-right');
        if (r === 2 || r === 5) div.classList.add('box-bottom');
        board3d.appendChild(div);
        cells3d[r][c] = div;
    }
}

// 3D drag-to-rotate
let isDragging = false, lastX = 0, lastY = 0;
let rotX = 35, rotZ = -10;

board3d.addEventListener('mousedown', e => { isDragging = true; lastX = e.clientX; lastY = e.clientY; });
document.addEventListener('mousemove', e => {
    if (!isDragging) return;
    rotZ += (e.clientX - lastX) * 0.4;
    rotX -= (e.clientY - lastY) * 0.3;
    rotX = Math.max(-10, Math.min(80, rotX));
    lastX = e.clientX; lastY = e.clientY;
    board3d.style.animation = 'none';
    board3d.style.transform = `rotateX(${rotX}deg) rotateZ(${rotZ}deg)`;
});
document.addEventListener('mouseup', () => { isDragging = false; });

// Camera presets
const camTopBtn = document.getElementById('cam-top');
const camAngleBtn = document.getElementById('cam-angle');
const camFrontBtn = document.getElementById('cam-front');
const cameraButtons = document.querySelectorAll('.camera-controls .btn-small');

camTopBtn.onclick = () => setCamera(80, 0, camTopBtn);
camAngleBtn.onclick = () => setCamera(35, -10, camAngleBtn);
camFrontBtn.onclick = () => setCamera(5, 0, camFrontBtn);

function setCamera(rx, rz, activeButton) {
    rotX = rx; rotZ = rz;
    board3d.style.animation = 'none';
    board3d.style.transform = `rotateX(${rotX}deg) rotateZ(${rotZ}deg)`;
    cameraButtons.forEach(b => b.classList.remove('active'));
    if (activeButton) activeButton.classList.add('active');
}

function markSolvedNonGiven(stateMap) {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (!given[r][c] && board[r][c]) stateMap[cellKey(r, c)] = 'solved';
        }
    }
}

// ── Sync state → UI ──────────────────────────────────────────────
function syncBoards(stateMap = {}) {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const v = board[r][c];
            const key = cellKey(r, c);
            const state = stateMap[key];

            // 2D
            const el = cells2d[r][c];
            el.value = v || '';
            el.classList.remove('given', 'trying', 'backtrack', 'solved');
            if (given[r][c]) el.classList.add('given');
            else if (state === 'trying') el.classList.add('trying');
            else if (state === 'backtrack') el.classList.add('backtrack');
            else if (state === 'solved') el.classList.add('solved');
            el.disabled = given[r][c] || visualizing || solving;

            // 3D
            const e3 = cells3d[r][c];
            e3.textContent = v || '';
            e3.classList.remove('given-3d', 'trying-3d', 'back-3d', 'solved-3d');
            if (given[r][c]) e3.classList.add('given-3d');
            else if (state === 'trying') e3.classList.add('trying-3d');
            else if (state === 'backtrack') e3.classList.add('back-3d');
            else if (state === 'solved') e3.classList.add('solved-3d');
        }
    }
    updateCounters();
    updateTimeline();
}

function sync3D() {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const v = board[r][c];
            cells3d[r][c].textContent = v || '';
            cells3d[r][c].classList.toggle('given-3d', given[r][c]);
        }
    }
}

// ── Counters ─────────────────────────────────────────────────────
function updateCounters() {
    let count = 0;
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (board[r][c] !== 0) count++;
        }
    }
    filledCount = count;
    stepCountEl.textContent = stepCount;
    backtrackCountEl.textContent = backtrackCount;
    filledCountEl.textContent = filledCount;
    tstatCellsEl.textContent = filledCount;
    tstatEmptyEl.textContent = 81 - filledCount;
}

function updateTimeline() {
    const pct = (filledCount / 81) * 100;
    timelineFillEl.style.width = pct + '%';
}

// ── Status helpers ───────────────────────────────────────────────
function setStatus(msg, state = 'idle') {
    statusTextEl.textContent = msg;
    statusBarEl.className = 'status-bar';
    statusIconEl.className = 'status-icon';
    const [sym, cls] = STATUS_MAP[state] || STATUS_MAP.idle;
    statusIconEl.textContent = sym;
    statusIconEl.classList.add(cls);
    if (state === 'solving') statusBarEl.classList.add('status-solving');
    if (state === 'solved') statusBarEl.classList.add('status-solved');
    if (state === 'error') statusBarEl.classList.add('status-error');
}

// ── Validation ───────────────────────────────────────────────────
function isSafe(b, r, c, n) {
    for (let i = 0; i < 9; i++) {
        if (b[r][i] === n) return false;
        if (b[i][c] === n) return false;
    }
    const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
    for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++)
            if (b[br + i][bc + j] === n) return false;
    return true;
}

// ── Instant Solve ────────────────────────────────────────────────
function solveInstant(b) {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (b[r][c] === 0) {
                for (let n = 1; n <= 9; n++) {
                    if (isSafe(b, r, c, n)) {
                        b[r][c] = n;
                        if (solveInstant(b)) return true;
                        b[r][c] = 0;
                    }
                }
                return false;
            }
        }
    }
    return true;
}

// ── Visualize Solve ──────────────────────────────────────────────
async function solveVisualized(b, stateMap) {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (b[r][c] === 0) {
                for (let n = 1; n <= 9; n++) {
                    await waitIfPaused();
                    if (!visualizing) return false;
                    if (isSafe(b, r, c, n)) {
                        b[r][c] = n;
                        stateMap[cellKey(r, c)] = 'trying';
                        stepCount++;
                        board[r][c] = n;
                        syncBoards(stateMap);
                        await delay();

                        if (await solveVisualized(b, stateMap)) {
                            stateMap[cellKey(r, c)] = 'solved';
                            syncBoards(stateMap);
                            return true;
                        }

                        b[r][c] = 0;
                        board[r][c] = 0;
                        stateMap[cellKey(r, c)] = 'backtrack';
                        backtrackCount++;
                        syncBoards(stateMap);
                        await delay();
                        delete stateMap[cellKey(r, c)];
                        syncBoards(stateMap);
                    }
                }
                return false;
            }
        }
    }
    return true;
}

function delay() {
    const ms = Math.max(2, 120 - animSpeed * 11);
    return new Promise(r => setTimeout(r, ms));
}

function waitIfPaused() {
    if (!paused) return Promise.resolve();
    return new Promise(resolve => pauseWaiters.push(resolve));
}

function releasePauseWaiters() {
    while (pauseWaiters.length) {
        const resolve = pauseWaiters.shift();
        resolve();
    }
}

// ── Button handlers ──────────────────────────────────────────────
document.getElementById('btn-sample').onclick = loadSample;
document.getElementById('btn-solve').onclick = doSolve;
document.getElementById('btn-visualize').onclick = doVisualize;
document.getElementById('btn-reset').onclick = doReset;

document.getElementById('speed-range').oninput = function () {
    animSpeed = +this.value;
    document.getElementById('speed-label').textContent = animSpeed + '×';
};

function loadSample() {
    if (solving || visualizing) return;
    const sample = SAMPLE_BOARDS[sampleIndex % SAMPLE_BOARDS.length];
    sampleIndex++;

    board = sample.board.map(r => [...r]);
    given = sample.board.map(r => r.map(v => v !== 0));
    stepCount = backtrackCount = 0;
    tstatStepsEl.textContent = '—';
    syncBoards();
    if (sample.unsolvable) {
        setStatus(`${sample.name} loaded (intentionally unsolvable). Try Solve to see failure case.`, 'idle');
    } else {
        setStatus(`${sample.name} loaded. Press Solve or Visualize.`, 'idle');
    }
}

function doSolve() {
    if (solving || visualizing) return;
    solving = true;
    setStatus('Solving instantly…', 'solving');
    const copy = board.map(r => [...r]);
    const start = performance.now();
    const ok = solveInstant(copy);
    const elapsed = (performance.now() - start).toFixed(1);
    solving = false;
    if (ok) {
        board = copy;
        tstatStepsEl.textContent = elapsed + 'ms';
        const stateMap = {};
        markSolvedNonGiven(stateMap);
        syncBoards(stateMap);
        setStatus(`Solved in ${elapsed}ms ✔`, 'solved');
    } else {
        syncBoards();
        setStatus('No solution exists for this puzzle.', 'error');
    }
}

async function doVisualize() {
    if (solving) return;

    if (visualizing) {
        if (!paused) {
            paused = true;
            document.getElementById('btn-visualize').textContent = '▶ Resume';
            setStatus('Visualization paused. Press Resume to continue.', 'paused');
        } else {
            paused = false;
            document.getElementById('btn-visualize').textContent = '⏸ Pause';
            releasePauseWaiters();
            setStatus('Visualization resumed…', 'solving');
        }
        return;
    }

    visualizing = true;
    paused = false;
    stepCount = backtrackCount = 0;
    speedWrapEl.style.display = 'flex';
    document.getElementById('btn-visualize').textContent = '⏸ Pause';
    setStatus('Visualizing…', 'solving');

    const copy = board.map(r => [...r]);
    const stateMap = {};
    syncBoards(stateMap);

    const ok = await solveVisualized(copy, stateMap);
    visualizing = false;
    paused = false;
    releasePauseWaiters();
    speedWrapEl.style.display = 'none';
    document.getElementById('btn-visualize').textContent = '▶ Visualize';

    if (ok) {
        board = copy;
        const finalMap = {};
        markSolvedNonGiven(finalMap);
        syncBoards(finalMap);
        tstatStepsEl.textContent = stepCount;
        setStatus(`Solved! ${stepCount} steps · ${backtrackCount} backtracks ✔`, 'solved');
    } else {
        setStatus('Visualization stopped or no solution found.', 'error');
    }
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) cells2d[r][c].disabled = given[r][c];
}

function doReset() {
    visualizing = false; solving = false; paused = false;
    releasePauseWaiters();
    board = Array.from({ length: 9 }, () => Array(9).fill(0));
    given = Array.from({ length: 9 }, () => Array(9).fill(false));
    stepCount = backtrackCount = 0;
    speedWrapEl.style.display = 'none';
    document.getElementById('btn-visualize').textContent = '▶ Visualize';
    tstatStepsEl.textContent = '—';
    syncBoards();
    setStatus('Board cleared. Enter a puzzle or load a sample.', 'idle');
}

// ── Logo animation ───────────────────────────────────────────────
const dots = document.querySelectorAll('.logo-dot');
const patterns = [
    [0, 2, 4, 6, 8], [1, 3, 5, 7], [0, 1, 2, 3, 5, 6, 7, 8], [0, 4, 8], [2, 4, 6]
];
let pi = 0;
setInterval(() => {
    pi = (pi + 1) % patterns.length;
    dots.forEach((d, i) => d.classList.toggle('lit', patterns[pi].includes(i)));
}, 1200);

// ── Init ─────────────────────────────────────────────────────────
syncBoards();
setStatus('Enter a puzzle or load a sample, then press Solve.', 'idle');