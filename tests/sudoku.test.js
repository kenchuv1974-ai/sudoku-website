const assert = require('assert');
const Engine = require('../js/sudoku-engine.js');
const Tutorial = require('../js/tutorial.js');

function runTests() {
  console.log('Running SudokuEngine unit tests...');

  // 1. Test generation across all three difficulty levels
  const difficulties = ['easy', 'medium', 'hard'];
  for (const diff of difficulties) {
    const start = Date.now();
    for (let i = 0; i < 3; i++) {
      const result = Engine.generatePuzzle(diff);
      assert.strictEqual(result.puzzle.length, 81, `${diff}: puzzle must have 81 cells`);
      assert.strictEqual(result.solution.length, 81, `${diff}: solution must have 81 cells`);

      const clues = Engine.countClues(result.puzzle);
      const cfg = Engine.DIFFICULTY_CONFIG[diff];
      assert(
        clues >= cfg.minClues && clues <= cfg.maxClues,
        `${diff}: clue count ${clues} outside [${cfg.minClues}, ${cfg.maxClues}]`
      );

      // Verify solution is complete and conflict-free
      assert.strictEqual(
        Engine.isBoardCompleteAndValid(result.solution),
        true,
        `${diff}: generated solution must be valid`
      );

      // Verify every clue matches the solution
      for (let idx = 0; idx < 81; idx++) {
        if (result.puzzle[idx] !== 0) {
          assert.strictEqual(
            result.puzzle[idx],
            result.solution[idx],
            `${diff}: clue mismatch at ${idx}`
          );
        }
      }

      // Verify unique solution
      assert.strictEqual(
        Engine.countSolutions(result.puzzle, 2),
        1,
        `${diff}: puzzle must have exactly 1 unique solution`
      );
    }
    console.log(`  [PASS] ${diff} generation (3 puzzles verified in ${Date.now() - start}ms)`);
  }

  // 2. Test clue count ordering: easy > medium > hard
  const easyPuzzle = Engine.generatePuzzle('easy');
  const medPuzzle = Engine.generatePuzzle('medium');
  const hardPuzzle = Engine.generatePuzzle('hard');
  assert(
    easyPuzzle.clues > medPuzzle.clues && medPuzzle.clues > hardPuzzle.clues,
    `Expected easy (${easyPuzzle.clues}) > medium (${medPuzzle.clues}) > hard (${hardPuzzle.clues})`
  );
  console.log(
    `  [PASS] difficulty clue progression: easy=${easyPuzzle.clues}, medium=${medPuzzle.clues}, hard=${hardPuzzle.clues}`
  );

  // 3. Test conflict detection (row, col, box)
  const conflictBoard = Engine.createEmptyBoard();
  conflictBoard[0] = 5;
  conflictBoard[4] = 5; // same row (row 1)
  conflictBoard[18] = 5; // same col (col 1) and same box (box 1)
  const conflicts = Engine.findConflicts(conflictBoard);
  assert.strictEqual(conflicts.isValid, false);
  assert(conflicts.conflictingIndices.has(0));
  assert(conflicts.conflictingIndices.has(4));
  assert(conflicts.conflictingIndices.has(18));
  assert(conflicts.messages.some((m) => m.includes('Row 1')));
  assert(conflicts.messages.some((m) => m.includes('Column 1')));
  assert(conflicts.messages.some((m) => m.includes('Box 1')));
  console.log('  [PASS] row, column, and 3x3 box conflict detection');

  // 4. Test custom puzzle validation
  // 4a. Empty board
  const emptyValidation = Engine.validateCustomPuzzle(Engine.createEmptyBoard());
  assert.strictEqual(emptyValidation.valid, false);
  assert.strictEqual(emptyValidation.status, 'empty');

  // 4b. Too few clues (< 17)
  const sparseBoard = Engine.createEmptyBoard();
  sparseBoard[0] = 1;
  sparseBoard[10] = 2;
  const sparseValidation = Engine.validateCustomPuzzle(sparseBoard);
  assert.strictEqual(sparseValidation.valid, false);
  assert.strictEqual(sparseValidation.status, 'multiple');

  // 4c. Multiple solutions (18 clues)
  const multiBoard = Engine.deserializeBoard(
    '530070000' +
    '600195000' +
    '098000060' +
    '800060003' +
    '400803001' +
    '700020006' +
    '060000280' +
    '000419005' +
    '000080079'
  );
  // Remove several clues so it has >= 17 clues but multiple solutions
  multiBoard[0] = 0;
  multiBoard[1] = 0;
  multiBoard[4] = 0;
  multiBoard[9] = 0;
  multiBoard[12] = 0;
  multiBoard[13] = 0;
  multiBoard[14] = 0;
  const multiValidation = Engine.validateCustomPuzzle(multiBoard);
  assert.strictEqual(multiValidation.valid, false);
  assert.strictEqual(multiValidation.status, 'multiple');

  // 4d. Unsolvable board (no direct duplicates, but dead-end)
  // Classic contradiction: Box 1 has 1..8 placed except 9, while row 1 col 3 has 9 blocked in all remaining cells
  const unsolvableBoard = Engine.deserializeBoard(
    '123456780' +
    '000000009' +
    '000000000' +
    '000000000' +
    '000000000' +
    '000000000' +
    '000000000' +
    '000000000' +
    '000000000'
  );
  // Fill enough valid non-conflicting cells to cross 17 clues where row 1 col 9 cannot be 9
  // Actually row 1 col 9 MUST be 9, and row 2 col 9 already has 9 -> conflict? Wait: col 9 has 9 at row 2, so col 9 can't have 9 at row 1, AND row 1 needs 9 in col 9 -> unsolvable with 0 direct conflicts!
  // Let's add 9 more valid clues without conflicts so clues >= 17:
  unsolvableBoard[27] = 2;
  unsolvableBoard[28] = 3;
  unsolvableBoard[29] = 4;
  unsolvableBoard[30] = 5;
  unsolvableBoard[31] = 6;
  unsolvableBoard[32] = 7;
  unsolvableBoard[33] = 8;
  unsolvableBoard[34] = 1;
  const unsolvableValidation = Engine.validateCustomPuzzle(unsolvableBoard);
  assert.strictEqual(unsolvableValidation.valid, false);
  assert.strictEqual(unsolvableValidation.status, 'unsolvable');

  // 4e. Known valid unique puzzle
  const validStr =
    '530070000' +
    '600195000' +
    '098000060' +
    '800060003' +
    '400803001' +
    '700020006' +
    '060000280' +
    '000419005' +
    '000080079';
  const validBoard = Engine.deserializeBoard(validStr);
  const validValidation = Engine.validateCustomPuzzle(validBoard);
  assert.strictEqual(validValidation.valid, true);
  assert.strictEqual(validValidation.status, 'valid');
  assert.strictEqual(Engine.isBoardCompleteAndValid(validValidation.solution), true);
  console.log('  [PASS] custom puzzle validation (empty, <17 clues, multiple, unsolvable, valid)');

  // 5. Test serialization roundtrip
  const serialized = Engine.serializeBoard(validBoard);
  assert.strictEqual(serialized, validStr);
  assert.deepStrictEqual(Engine.deserializeBoard(serialized), validBoard);
  assert.strictEqual(Engine.deserializeBoard('invalid'), null);
  console.log('  [PASS] serialization roundtrip');

  // 6. Test tutorial example board validity and target answer
  const tutValidation = Engine.validateCustomPuzzle(Tutorial.EXAMPLE_BOARD);
  assert.strictEqual(tutValidation.valid, true, 'Tutorial board must be valid and unique');
  assert.strictEqual(
    tutValidation.solution[Tutorial.TARGET_INDEX],
    Tutorial.CORRECT_VALUE,
    'Tutorial target answer must match unique solution'
  );
  console.log('  [PASS] tutorial interactive example board & target cell answer');

  console.log('All SudokuEngine tests passed!');
}

runTests();
