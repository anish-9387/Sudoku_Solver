export function cloneBoard(board) {
  return board.map(row => [...row]);
}

export function isSafe(board, row, col, num) {
  for (let c = 0; c < 9; c++) {
    if (board[row][c] === num) return false;
  }

  for (let r = 0; r < 9; r++) {
    if (board[r][col] === num) return false;
  }

  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;

  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if (board[r][c] === num) return false;
    }
  }
  return true;
}

export function findEmpty(board) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] === 0) return [r, c];
    }
  }
  return null;  // No empty cell found → board is complete
}

export function solveSudoku(board) {
  const emptyCell = findEmpty(board);
  if (emptyCell === null) return true;

  const [row, col] = emptyCell;

  for (let num = 1; num <= 9; num++) {
    if (isSafe(board, row, col, num)) {

      board[row][col] = num;

      if (solveSudoku(board)) return true;

      board[row][col] = 0;   // This is the "backtrack" step!
    }
  }
  return false;
}

export function collectSolveSteps(initialBoard) {
  const board = cloneBoard(initialBoard);
  const steps = [];

  function solve(board) {
    const emptyCell = findEmpty(board);
    if (emptyCell === null) {
      steps.push({ type: 'solved' });
      return true;
    }

    const [row, col] = emptyCell;

    for (let num = 1; num <= 9; num++) {
      if (isSafe(board, row, col, num)) {
        board[row][col] = num;

        steps.push({ type: 'try', row, col, num });

        if (solve(board)) return true;

        steps.push({ type: 'backtrack', row, col, num: 0 });
        board[row][col] = 0;
      }
    }

    return false;
  }

  solve(board);
  return steps;
}

export function isValidBoard(board) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const num = board[r][c];
      if (num === 0) continue;     // Skip empty cells

      // Temporarily remove the value to check if it could be placed
      board[r][c] = 0;
      const safe = isSafe(board, r, c, num);
      board[r][c] = num;           // Restore the value

      if (!safe) return false;     // Conflict found
    }
  }
  return true;
}