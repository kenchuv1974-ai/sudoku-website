/**
 * Sudoku Engine
 * Handles generation, backtracking solving, unique solution verification,
 * conflict detection, and serialization.
 * Compatible with both browser (<script>) and Node.js (require).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SudokuEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SIZE = 9;
  const TOTAL_CELLS = 81;

  const DIFFICULTY_CONFIG = {
    easy: { label: 'Easy', minClues: 42, maxClues: 46, targetClues: 44 },
    medium: { label: 'Medium', minClues: 32, maxClues: 36, targetClues: 34 },
    hard: { label: 'Hard', minClues: 24, maxClues: 28, targetClues: 26 }
  };

  function cloneBoard(board) {
    return board.slice();
  }

  function createEmptyBoard() {
    return new Array(TOTAL_CELLS).fill(0);
  }

  function getRow(index) {
    return Math.floor(index / SIZE);
  }

  function getCol(index) {
    return index % SIZE;
  }

  function getBox(index) {
    const r = getRow(index);
    const c = getCol(index);
    return Math.floor(r / 3) * 3 + Math.floor(c / 3);
  }

  function getBoxName(boxIndex) {
    const rowNames = ['top', 'middle', 'bottom'];
    const colNames = ['left', 'center', 'right'];
    const br = Math.floor(boxIndex / 3);
    const bc = boxIndex % 3;
    return `${boxIndex + 1} (${rowNames[br]}-${colNames[bc]})`;
  }

  function countClues(board) {
    let count = 0;
    for (let i = 0; i < TOTAL_CELLS; i++) {
      if (board[i] >= 1 && board[i] <= 9) count++;
    }
    return count;
  }

  function shuffleArray(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  /**
   * Finds all duplicate conflicts in rows, columns, and 3x3 boxes.
   * Returns { isValid, conflictingIndices: Set<number>, messages: string[] }
   */
  function findConflicts(board) {
    const conflictingIndices = new Set();
    const messages = [];

    // Check rows
    for (let r = 0; r < SIZE; r++) {
      const seen = new Map();
      const dupNums = new Set();
      for (let c = 0; c < SIZE; c++) {
        const idx = r * SIZE + c;
        const val = board[idx];
        if (val < 1 || val > 9) continue;
        if (seen.has(val)) {
          conflictingIndices.add(seen.get(val));
          conflictingIndices.add(idx);
          dupNums.add(val);
        } else {
          seen.set(val, idx);
        }
      }
      dupNums.forEach((num) => {
        messages.push(`Row ${r + 1} has a duplicate ${num}.`);
      });
    }

    // Check columns
    for (let c = 0; c < SIZE; c++) {
      const seen = new Map();
      const dupNums = new Set();
      for (let r = 0; r < SIZE; r++) {
        const idx = r * SIZE + c;
        const val = board[idx];
        if (val < 1 || val > 9) continue;
        if (seen.has(val)) {
          conflictingIndices.add(seen.get(val));
          conflictingIndices.add(idx);
          dupNums.add(val);
        } else {
          seen.set(val, idx);
        }
      }
      dupNums.forEach((num) => {
        messages.push(`Column ${c + 1} has a duplicate ${num}.`);
      });
    }

    // Check 3x3 boxes
    for (let b = 0; b < SIZE; b++) {
      const seen = new Map();
      const dupNums = new Set();
      const startRow = Math.floor(b / 3) * 3;
      const startCol = (b % 3) * 3;
      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) {
          const idx = (startRow + dr) * SIZE + (startCol + dc);
          const val = board[idx];
          if (val < 1 || val > 9) continue;
          if (seen.has(val)) {
            conflictingIndices.add(seen.get(val));
            conflictingIndices.add(idx);
            dupNums.add(val);
          } else {
            seen.set(val, idx);
          }
        }
      }
      dupNums.forEach((num) => {
        messages.push(`3×3 Box ${getBoxName(b)} has a duplicate ${num}.`);
      });
    }

    return {
      isValid: conflictingIndices.size === 0,
      conflictingIndices,
      messages
    };
  }

  /**
   * Builds row, column, and box bitmasks from a board.
   * Returns null if there are any rule conflicts.
   */
  function buildMasks(board) {
    const rowMask = new Int32Array(SIZE);
    const colMask = new Int32Array(SIZE);
    const boxMask = new Int32Array(SIZE);

    for (let i = 0; i < TOTAL_CELLS; i++) {
      const val = board[i];
      if (val === 0) continue;
      if (val < 1 || val > 9) return null;
      const bit = 1 << val;
      const r = getRow(i);
      const c = getCol(i);
      const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
      if ((rowMask[r] & bit) || (colMask[c] & bit) || (boxMask[b] & bit)) {
        return null;
      }
      rowMask[r] |= bit;
      colMask[c] |= bit;
      boxMask[b] |= bit;
    }

    return { rowMask, colMask, boxMask };
  }

  function countBits(mask) {
    let count = 0;
    let m = mask;
    while (m) {
      m &= m - 1;
      count++;
    }
    return count;
  }

  /**
   * Solves the board using backtracking with Minimum Remaining Values (MRV).
   * Returns a solved 81-element array or null if unsolvable.
   */
  function solveBoard(board, randomize = false) {
    const working = cloneBoard(board);
    const masks = buildMasks(working);
    if (!masks) return null;

    const { rowMask, colMask, boxMask } = masks;
    const ALL_MASK = 0x3fe; // bits 1..9

    function backtrack() {
      let bestIdx = -1;
      let bestCandidates = 0;
      let minCount = 10;

      for (let i = 0; i < TOTAL_CELLS; i++) {
        if (working[i] !== 0) continue;
        const r = getRow(i);
        const c = getCol(i);
        const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
        const used = rowMask[r] | colMask[c] | boxMask[b];
        const available = ALL_MASK & ~used;
        const cnt = countBits(available);

        if (cnt === 0) return false;
        if (cnt < minCount) {
          minCount = cnt;
          bestIdx = i;
          bestCandidates = available;
          if (cnt === 1) break;
        }
      }

      if (bestIdx === -1) return true; // All cells filled

      const r = getRow(bestIdx);
      const c = getCol(bestIdx);
      const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);

      let nums = [];
      for (let n = 1; n <= 9; n++) {
        if (bestCandidates & (1 << n)) nums.push(n);
      }
      if (randomize && nums.length > 1) {
        nums = shuffleArray(nums);
      }

      for (let k = 0; k < nums.length; k++) {
        const num = nums[k];
        const bit = 1 << num;
        working[bestIdx] = num;
        rowMask[r] |= bit;
        colMask[c] |= bit;
        boxMask[b] |= bit;

        if (backtrack()) return true;

        working[bestIdx] = 0;
        rowMask[r] &= ~bit;
        colMask[c] &= ~bit;
        boxMask[b] &= ~bit;
      }

      return false;
    }

    return backtrack() ? working : null;
  }

  /**
   * Counts valid solutions up to `limit` (default 2) using MRV backtracking.
   * Returns 0 (invalid/unsolvable), 1 (unique), or `limit` (multiple).
   */
  function countSolutions(board, limit = 2) {
    const working = cloneBoard(board);
    const masks = buildMasks(working);
    if (!masks) return 0;

    const { rowMask, colMask, boxMask } = masks;
    const ALL_MASK = 0x3fe;
    let solutions = 0;
    let steps = 0;
    const MAX_STEPS = 400000;

    function search() {
      if (solutions >= limit || steps >= MAX_STEPS) return;
      steps++;

      let bestIdx = -1;
      let bestCandidates = 0;
      let minCount = 10;

      for (let i = 0; i < TOTAL_CELLS; i++) {
        if (working[i] !== 0) continue;
        const r = getRow(i);
        const c = getCol(i);
        const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
        const used = rowMask[r] | colMask[c] | boxMask[b];
        const available = ALL_MASK & ~used;
        const cnt = countBits(available);

        if (cnt === 0) return;
        if (cnt < minCount) {
          minCount = cnt;
          bestIdx = i;
          bestCandidates = available;
          if (cnt === 1) break;
        }
      }

      if (bestIdx === -1) {
        solutions++;
        return;
      }

      const r = getRow(bestIdx);
      const c = getCol(bestIdx);
      const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);

      for (let num = 1; num <= 9; num++) {
        const bit = 1 << num;
        if (!(bestCandidates & bit)) continue;

        working[bestIdx] = num;
        rowMask[r] |= bit;
        colMask[c] |= bit;
        boxMask[b] |= bit;

        search();

        working[bestIdx] = 0;
        rowMask[r] &= ~bit;
        colMask[c] &= ~bit;
        boxMask[b] &= ~bit;

        if (solutions >= limit || steps >= MAX_STEPS) return;
      }
    }

    search();
    return solutions;
  }

  /**
   * Checks if a puzzle can be solved purely with naked singles and hidden singles.
   * Useful to ensure Easy puzzles remain genuinely beginner-friendly.
   */
  function canSolveWithSingles(board) {
    const working = cloneBoard(board);
    const masks = buildMasks(working);
    if (!masks) return false;
    const { rowMask, colMask, boxMask } = masks;
    const ALL_MASK = 0x3fe;

    let progress = true;
    while (progress) {
      progress = false;

      // Naked singles
      for (let i = 0; i < TOTAL_CELLS; i++) {
        if (working[i] !== 0) continue;
        const r = getRow(i);
        const c = getCol(i);
        const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
        const available = ALL_MASK & ~(rowMask[r] | colMask[c] | boxMask[b]);
        if (available === 0) return false;
        if ((available & (available - 1)) === 0) {
          const num = Math.round(Math.log2(available));
          working[i] = num;
          rowMask[r] |= available;
          colMask[c] |= available;
          boxMask[b] |= available;
          progress = true;
        }
      }

      if (progress) continue;

      // Hidden singles in rows, cols, boxes
      const units = [];
      for (let r = 0; r < 9; r++) {
        const rowUnit = [];
        const colUnit = [];
        for (let k = 0; k < 9; k++) {
          rowUnit.push(r * 9 + k);
          colUnit.push(k * 9 + r);
        }
        units.push(rowUnit, colUnit);
      }
      for (let b = 0; b < 9; b++) {
        const boxUnit = [];
        const sr = Math.floor(b / 3) * 3;
        const sc = (b % 3) * 3;
        for (let dr = 0; dr < 3; dr++) {
          for (let dc = 0; dc < 3; dc++) {
            boxUnit.push((sr + dr) * 9 + (sc + dc));
          }
        }
        units.push(boxUnit);
      }

      for (let u = 0; u < units.length; u++) {
        const unit = units[u];
        for (let num = 1; num <= 9; num++) {
          const bit = 1 << num;
          let targetIdx = -1;
          let possibleCount = 0;
          let alreadyPlaced = false;

          for (let k = 0; k < 9; k++) {
            const idx = unit[k];
            if (working[idx] === num) {
              alreadyPlaced = true;
              break;
            }
            if (working[idx] !== 0) continue;
            const r = getRow(idx);
            const c = getCol(idx);
            const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
            if (!((rowMask[r] | colMask[c] | boxMask[b]) & bit)) {
              targetIdx = idx;
              possibleCount++;
            }
          }

          if (!alreadyPlaced && possibleCount === 1 && targetIdx !== -1) {
            const r = getRow(targetIdx);
            const c = getCol(targetIdx);
            const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
            working[targetIdx] = num;
            rowMask[r] |= bit;
            colMask[c] |= bit;
            boxMask[b] |= bit;
            progress = true;
          }
        }
      }
    }

    return countClues(working) === TOTAL_CELLS;
  }

  /**
   * Generates a Sudoku puzzle for the given difficulty ('easy', 'medium', 'hard').
   * Guarantees the generated puzzle has exactly one unique solution.
   * Returns { puzzle: number[], solution: number[], difficulty: string, clues: number }
   */
  function generatePuzzle(difficulty = 'easy') {
    const config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.easy;
    const maxAttempts = 8;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const solution = solveBoard(createEmptyBoard(), true);
      if (!solution) continue;

      const puzzle = cloneBoard(solution);
      const indices = shuffleArray(Array.from({ length: TOTAL_CELLS }, (_, i) => i));
      let clues = TOTAL_CELLS;

      for (let i = 0; i < indices.length; i++) {
        if (clues <= config.targetClues) break;
        const idx = indices[i];
        const backup = puzzle[idx];
        puzzle[idx] = 0;

        if (countSolutions(puzzle, 2) === 1) {
          clues--;
        } else {
          puzzle[idx] = backup;
        }
      }

      if (clues > config.maxClues) {
        continue;
      }

      if (difficulty === 'easy' && !canSolveWithSingles(puzzle)) {
        continue;
      }

      if (countSolutions(puzzle, 2) === 1) {
        return {
          puzzle,
          solution,
          difficulty,
          clues
        };
      }
    }

    // Fallback: guaranteed unique puzzle even if clue target or singles check needed relaxation
    const solution = solveBoard(createEmptyBoard(), true);
    const puzzle = cloneBoard(solution);
    const indices = shuffleArray(Array.from({ length: TOTAL_CELLS }, (_, i) => i));
    let clues = TOTAL_CELLS;

    for (let i = 0; i < indices.length; i++) {
      if (clues <= config.targetClues) break;
      const idx = indices[i];
      const backup = puzzle[idx];
      puzzle[idx] = 0;
      if (countSolutions(puzzle, 2) === 1) {
        clues--;
      } else {
        puzzle[idx] = backup;
      }
    }

    return {
      puzzle,
      solution,
      difficulty,
      clues
    };
  }

  /**
   * Validates a custom user-built Sudoku puzzle.
   * Checks rule conflicts, minimum/valid structure, and unique solution.
   * Returns { valid, status, errors, conflictingIndices, solution, clues }
   */
  function validateCustomPuzzle(board) {
    const clues = countClues(board);
    const conflicts = findConflicts(board);

    if (!conflicts.isValid) {
      return {
        valid: false,
        status: 'conflict',
        errors: conflicts.messages,
        conflictingIndices: conflicts.conflictingIndices,
        solution: null,
        clues
      };
    }

    if (clues === 0) {
      return {
        valid: false,
        status: 'empty',
        errors: ['The grid is empty. Please enter starting numbers before validating.'],
        conflictingIndices: new Set(),
        solution: null,
        clues
      };
    }

    // Mathematical lower bound for a unique Sudoku is 17 clues
    if (clues < 17) {
      return {
        valid: false,
        status: 'multiple',
        errors: [
          `This puzzle only has ${clues} numbers. A valid Sudoku with a unique solution needs at least 17 starting numbers.`
        ],
        conflictingIndices: new Set(),
        solution: null,
        clues
      };
    }

    const solCount = countSolutions(board, 2);
    if (solCount === 0) {
      return {
        valid: false,
        status: 'unsolvable',
        errors: [
          'This puzzle has no valid solution. Some numbers make it impossible to complete the grid.'
        ],
        conflictingIndices: new Set(),
        solution: null,
        clues
      };
    }

    if (solCount > 1) {
      return {
        valid: false,
        status: 'multiple',
        errors: [
          'This puzzle has more than one possible solution. Add a few more numbers so it has exactly one unique solution.'
        ],
        conflictingIndices: new Set(),
        solution: null,
        clues
      };
    }

    const solution = solveBoard(board, false);
    return {
      valid: true,
      status: 'valid',
      errors: [],
      conflictingIndices: new Set(),
      solution,
      clues
    };
  }

  function isBoardCompleteAndValid(board, solution) {
    for (let i = 0; i < TOTAL_CELLS; i++) {
      if (board[i] < 1 || board[i] > 9) return false;
      if (solution && board[i] !== solution[i]) return false;
    }
    return findConflicts(board).isValid;
  }

  function serializeBoard(board) {
    return board.map((n) => (n >= 1 && n <= 9 ? String(n) : '0')).join('');
  }

  function deserializeBoard(str) {
    if (typeof str !== 'string') return null;
    const cleaned = str.trim().replace(/\./g, '0').replace(/[^0-9]/g, '');
    if (cleaned.length !== TOTAL_CELLS) return null;
    const board = new Array(TOTAL_CELLS);
    for (let i = 0; i < TOTAL_CELLS; i++) {
      board[i] = Number(cleaned[i]);
    }
    return board;
  }

  return {
    SIZE,
    TOTAL_CELLS,
    DIFFICULTY_CONFIG,
    cloneBoard,
    createEmptyBoard,
    getRow,
    getCol,
    getBox,
    countClues,
    findConflicts,
    solveBoard,
    countSolutions,
    canSolveWithSingles,
    generatePuzzle,
    validateCustomPuzzle,
    isBoardCompleteAndValid,
    serializeBoard,
    deserializeBoard
  };
}));

