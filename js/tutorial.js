/**
 * Interactive Beginner Tutorial Controller
 * Demonstrates the 7-step method to find a number using Row, Column, and 3x3 Box logic.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SudokuTutorial = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Valid partial 9x9 grid derived from a unique Sudoku solution.
  // Target cell: Row 2, Column 7 (0-indexed: r=1, c=6, idx=15). Correct value = 3.
  const EXAMPLE_BOARD = [
    5, 3, 4,  6, 7, 8,  9, 1, 2,
    6, 7, 2,  0, 9, 5,  0, 0, 8,
    1, 9, 8,  3, 4, 2,  5, 6, 7,

    8, 5, 9,  7, 6, 1,  4, 2, 3,
    4, 2, 6,  8, 5, 3,  7, 9, 1,
    7, 1, 3,  9, 2, 4,  8, 5, 6,

    9, 6, 1,  5, 3, 7,  2, 8, 0,
    2, 8, 7,  4, 1, 9,  6, 3, 5,
    3, 4, 5,  2, 8, 6,  0, 7, 9
  ];

  const TARGET_INDEX = 15; // Row 2, Col 7 (1-based)
  const CORRECT_VALUE = 3;

  const STEPS = [
    {
      step: 1,
      title: 'Step 1: Look at the empty cells in Row 2',
      description: 'Focus on the highlighted empty cell in Row 2, Column 7. Notice the other numbers already placed in Row 2: 6, 7, 2, 9, 5, and 8.',
      highlightMode: 'row'
    },
    {
      step: 2,
      title: 'Step 2: Check which numbers from 1 to 9 are missing',
      description: 'Row 2 already contains 2, 5, 6, 7, 8, and 9. Therefore, the missing numbers for Row 2 are 1, 3, and 4.',
      highlightMode: 'row'
    },
    {
      step: 3,
      title: 'Step 3: Look at Column 7',
      description: 'Now look down Column 7. The number 4 is already placed in Row 4, Column 7 — so 4 cannot go in our target cell.',
      highlightMode: 'col'
    },
    {
      step: 4,
      title: 'Step 4: Check the 3×3 box',
      description: 'Next, look inside the top-right 3×3 box containing our target cell. The number 1 is already in this box (Row 1, Column 8) — so 1 cannot go here either.',
      highlightMode: 'box'
    },
    {
      step: 5,
      title: 'Step 5: Find the only remaining valid number',
      description: 'Out of the missing numbers (1, 3, 4), both 4 (in Column 7) and 1 (in the 3×3 box) are blocked. Only 3 is left!',
      highlightMode: 'all'
    },
    {
      step: 6,
      title: 'Step 6: Enter the number 3',
      description: 'Click 3 in the number buttons below (or try entering a number now) to complete this cell. Then repeat these steps for the next empty cell!',
      highlightMode: 'all'
    }
  ];

  function init(elements) {
    const {
      gridEl,
      stepTitleEl,
      stepDescEl,
      stepCounterEl,
      prevBtn,
      nextBtn,
      resetBtn,
      padEl,
      feedbackEl
    } = elements;

    if (!gridEl) return;

    let currentStep = 0; // 0..5
    let enteredValue = 0;
    let solved = false;

    function getHighlightClass(idx) {
      const r = Math.floor(idx / 9);
      const c = idx % 9;
      const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
      const mode = STEPS[currentStep].highlightMode;

      if (idx === TARGET_INDEX) return 'tut-target';
      if (mode === 'row' && r === 1) return 'tut-peer';
      if (mode === 'col' && c === 6) {
        return EXAMPLE_BOARD[idx] === 4 ? 'tut-blocker' : 'tut-peer';
      }
      if (mode === 'box' && b === 2) {
        return EXAMPLE_BOARD[idx] === 1 ? 'tut-blocker' : 'tut-peer';
      }
      if (mode === 'all') {
        if ((r === 1 || c === 6 || b === 2)) {
          if (idx === 33 || idx === 7) return 'tut-blocker';
          return 'tut-peer';
        }
      }
      return '';
    }

    function renderGrid() {
      gridEl.innerHTML = '';
      for (let i = 0; i < 81; i++) {
        const r = Math.floor(i / 9);
        const c = i % 9;
        const cell = document.createElement('div');
        cell.className = 'sudoku-cell tut-cell';
        if (c === 2 || c === 5) cell.classList.add('box-right');
        if (r === 2 || r === 5) cell.classList.add('box-bottom');

        const hl = getHighlightClass(i);
        if (hl) cell.classList.add(hl);

        const val = i === TARGET_INDEX ? enteredValue : EXAMPLE_BOARD[i];
        if (val !== 0) {
          cell.textContent = String(val);
          if (i === TARGET_INDEX) {
            cell.classList.add(solved ? 'tut-solved' : 'cell-error');
          } else {
            cell.classList.add('cell-given');
          }
        }
        gridEl.appendChild(cell);
      }
    }

    function renderStepInfo() {
      const stepData = STEPS[currentStep];
      stepCounterEl.textContent = `Walkthrough ${currentStep + 1} of ${STEPS.length}`;
      stepTitleEl.textContent = stepData.title;
      stepDescEl.textContent = stepData.description;
      prevBtn.disabled = currentStep === 0;
      nextBtn.disabled = currentStep === STEPS.length - 1;
    }

    function handleGuess(num) {
      enteredValue = num;
      if (num === CORRECT_VALUE) {
        solved = true;
        currentStep = STEPS.length - 1;
        feedbackEl.className = 'status-banner status-success';
        feedbackEl.textContent = 'Correct! 3 does not appear in Row 2, Column 7, or the top-right 3×3 box.';
      } else {
        solved = false;
        feedbackEl.className = 'status-banner status-error';
        if (num === 4) {
          feedbackEl.textContent = 'Not quite: 4 already appears in Column 7 (Row 4, Column 7).';
        } else if (num === 1) {
          feedbackEl.textContent = 'Not quite: 1 already appears in the top-right 3×3 box (Row 1, Column 8).';
        } else if ([2, 5, 6, 7, 8, 9].includes(num)) {
          feedbackEl.textContent = `Not quite: ${num} is already present in Row 2.`;
        } else {
          feedbackEl.textContent = `Not quite: check Row 2, Column 7, and the top-right 3×3 box again.`;
        }
      }
      renderStepInfo();
      renderGrid();
    }

    function renderPad() {
      padEl.innerHTML = '';
      for (let n = 1; n <= 9; n++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'num-btn';
        btn.textContent = String(n);
        btn.setAttribute('aria-label', `Try number ${n} in tutorial`);
        btn.addEventListener('click', () => handleGuess(n));
        padEl.appendChild(btn);
      }
    }

    prevBtn.addEventListener('click', () => {
      if (currentStep > 0) {
        currentStep--;
        renderStepInfo();
        renderGrid();
      }
    });

    nextBtn.addEventListener('click', () => {
      if (currentStep < STEPS.length - 1) {
        currentStep++;
        renderStepInfo();
        renderGrid();
      }
    });

    resetBtn.addEventListener('click', () => {
      currentStep = 0;
      enteredValue = 0;
      solved = false;
      feedbackEl.className = 'status-banner status-info';
      feedbackEl.textContent = 'Use "Next Step" to follow the logic, or select a number (1–9) to fill the highlighted cell.';
      renderStepInfo();
      renderGrid();
    });

    renderPad();
    renderStepInfo();
    renderGrid();
  }

  return { init, EXAMPLE_BOARD, TARGET_INDEX, CORRECT_VALUE };
}));

