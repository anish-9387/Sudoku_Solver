// ================================================================
// sudokuSolver.js
// ================================================================
//
// PURPOSE: Implements the Sudoku solving algorithm using two core
//          AI / computer-science concepts:
//
//    1. RECURSION    — a function that calls itself to break a big
//                      problem into smaller, identical sub-problems.
//
//    2. BACKTRACKING — when a partial solution leads to a dead end,
//                      we "undo" the last choice and try the next
//                      option. This is depth-first search (DFS) with
//                      pruning.
//
// HOW BACKTRACKING WORKS ON SUDOKU:
//
//   ┌─────────────────────────────────────────────────────┐
//   │  Find empty cell (row, col)                         │
//   │  For num = 1 to 9:                                  │
//   │    if isSafe(board, row, col, num):                 │
//   │      board[row][col] = num      ← place             │
//   │      if solveSudoku(board):     ← recurse           │
//   │        return true              ← success!          │
//   │      board[row][col] = 0        ← backtrack (undo)  │
//   │  return false  ← no number worked → backtrack above │
//   └─────────────────────────────────────────────────────┘
//
// ================================================================


// ────────────────────────────────────────────────────────────────
// UTILITY: Deep-copy a 9×9 board (2D array)
// We need this so the solver never mutates the original puzzle.
// ────────────────────────────────────────────────────────────────
export function cloneBoard(board) {
  return board.map(row => [...row]);
}


// ────────────────────────────────────────────────────────────────
// isSafe(board, row, col, num)
//
// RETURNS: true if placing `num` at (row, col) does NOT violate
//          any Sudoku rule.
//
// SUDOKU RULES (three constraints):
//   1. Every row must contain 1–9 exactly once.
//   2. Every column must contain 1–9 exactly once.
//   3. Every 3×3 box must contain 1–9 exactly once.
// ────────────────────────────────────────────────────────────────
export function isSafe(board, row, col, num) {

  // ── Constraint 1: Check the entire row ────────────────────────
  // If `num` already exists anywhere in the same row → not safe.
  for (let c = 0; c < 9; c++) {
    if (board[row][c] === num) return false;
  }

  // ── Constraint 2: Check the entire column ─────────────────────
  // If `num` already exists anywhere in the same column → not safe.
  for (let r = 0; r < 9; r++) {
    if (board[r][col] === num) return false;
  }

  // ── Constraint 3: Check the 3×3 sub-box ───────────────────────
  // Find the top-left corner of the 3×3 box this cell belongs to.
  // e.g. row=5, col=7  →  boxRow=3, boxCol=6
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;

  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if (board[r][c] === num) return false;
    }
  }

  // All three constraints passed → safe to place the number
  return true;
}


// ────────────────────────────────────────────────────────────────
// findEmpty(board)
//
// Scans the board left-to-right, top-to-bottom for the first
// cell that contains 0 (represents "empty").
//
// RETURNS: [row, col] of the first empty cell, or null if the
//          board is completely filled.
// ────────────────────────────────────────────────────────────────
export function findEmpty(board) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] === 0) return [r, c];
    }
  }
  return null;  // No empty cell found → board is complete
}


// ────────────────────────────────────────────────────────────────
// solveSudoku(board)
//
// THE MAIN RECURSIVE BACKTRACKING FUNCTION.
//
// This is the heart of the AI algorithm. It solves the board
// IN-PLACE by modifying the array directly.
//
// PARAMETERS:
//   board — 9×9 array where 0 = empty, 1-9 = filled
//
// RETURNS: true  → puzzle solved successfully
//          false → this branch has no solution (trigger backtrack)
// ────────────────────────────────────────────────────────────────
export function solveSudoku(board) {

  // ── BASE CASE ──────────────────────────────────────────────────
  // If there are no empty cells left, the puzzle is solved!
  // This is the termination condition for the recursion.
  const emptyCell = findEmpty(board);
  if (emptyCell === null) return true;   // ✅ SOLVED

  const [row, col] = emptyCell;

  // ── RECURSIVE CASE ─────────────────────────────────────────────
  // Try every number from 1 to 9 in the current empty cell.
  for (let num = 1; num <= 9; num++) {

    // Check if placing `num` here is valid (no rule violations)
    if (isSafe(board, row, col, num)) {

      // PLACE the number — tentative choice
      board[row][col] = num;

      // RECURSE — move on to the next empty cell.
      // If this eventually leads to a full solution, propagate true.
      if (solveSudoku(board)) return true;

      // BACKTRACK — the recursion above returned false, meaning
      // this choice of `num` led to a dead end.
      // Erase the number and try the next candidate.
      board[row][col] = 0;   // ← This is the "backtrack" step!
    }
  }

  // No number (1–9) worked for this cell → signal failure upward
  // so the caller can backtrack its own last choice.
  return false;
}


// ────────────────────────────────────────────────────────────────
// collectSolveSteps(board)
//
// VISUALIZATION HELPER
//
// Runs the same backtracking algorithm but RECORDS every single
// action (try / backtrack / solved) as a step object.
//
// These steps are played back one-by-one in the UI animation.
//
// STEP OBJECT SHAPE:
//   { type: 'try'|'backtrack'|'solved', row, col, num }
// ────────────────────────────────────────────────────────────────
export function collectSolveSteps(initialBoard) {
  const board = cloneBoard(initialBoard);
  const steps = [];

  // Inner recursive function — same algorithm, just adds logging
  function solve(board) {
    const emptyCell = findEmpty(board);
    if (emptyCell === null) {
      // Board is complete — record a solved step for every filled cell
      steps.push({ type: 'solved' });
      return true;
    }

    const [row, col] = emptyCell;

    for (let num = 1; num <= 9; num++) {
      if (isSafe(board, row, col, num)) {
        board[row][col] = num;

        // Record the "trying this number" action
        steps.push({ type: 'try', row, col, num });

        if (solve(board)) return true;

        // Record the "backtrack" action (erasing the number)
        steps.push({ type: 'backtrack', row, col, num: 0 });
        board[row][col] = 0;
      }
    }

    return false;
  }

  solve(board);
  return steps;
}


// ────────────────────────────────────────────────────────────────
// isValidBoard(board)
//
// Checks if the current (possibly partial) board has any conflicts.
// Used to validate user input before solving.
//
// RETURNS: true if no conflicts exist (even if board is incomplete)
// ────────────────────────────────────────────────────────────────
export function isValidBoard(board) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const num = board[r][c];
      if (num === 0) continue;     // Skip empty cells

      // Temporarily remove the value to check if it could be placed
      board[r][c] = 0;
      const safe = isSafe(board, r, c, num);
      board[r][c] = num;           // Restore the value

      if (!safe) return false;     // Conflict found!
    }
  }
  return true;
}


// ────────────────────────────────────────────────────────────────
// SAMPLE PUZZLES
//
// A collection of pre-built puzzles at different difficulty levels.
// 0 represents an empty cell.
// ────────────────────────────────────────────────────────────────
export const SAMPLE_PUZZLES = {
  easy: [
    [5,3,0, 0,7,0, 0,0,0],
    [6,0,0, 1,9,5, 0,0,0],
    [0,9,8, 0,0,0, 0,6,0],

    [8,0,0, 0,6,0, 0,0,3],
    [4,0,0, 8,0,3, 0,0,1],
    [7,0,0, 0,2,0, 0,0,6],

    [0,6,0, 0,0,0, 2,8,0],
    [0,0,0, 4,1,9, 0,0,5],
    [0,0,0, 0,8,0, 0,7,9]
  ],
  medium: [
    [0,0,0, 2,6,0, 7,0,1],
    [6,8,0, 0,7,0, 0,9,0],
    [1,9,0, 0,0,4, 5,0,0],

    [8,2,0, 1,0,0, 0,4,0],
    [0,0,4, 6,0,2, 9,0,0],
    [0,5,0, 0,0,3, 0,2,8],

    [0,0,9, 3,0,0, 0,7,4],
    [0,4,0, 0,5,0, 0,3,6],
    [7,0,3, 0,1,8, 0,0,0]
  ],
  hard: [
    [0,0,0, 0,0,0, 0,0,0],
    [0,0,0, 0,0,3, 0,8,5],
    [0,0,1, 0,2,0, 0,0,0],

    [0,0,0, 5,0,7, 0,0,0],
    [0,0,4, 0,0,0, 1,0,0],
    [0,9,0, 0,0,0, 0,0,0],

    [5,0,0, 0,0,0, 0,7,3],
    [0,0,2, 0,1,0, 0,0,0],
    [0,0,0, 0,4,0, 0,0,9]
  ]
};
