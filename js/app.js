/**
 * Main Application Controller for SUDOKU – Play & Create
 */
(function () {
  'use strict';

  const Engine = window.SudokuEngine;
  const Storage = window.SudokuStorage;
  const Tutorial = window.SudokuTutorial;

  const MAX_HINTS = 3;

  // =========================================================================
  // DOM References
  // =========================================================================
  const views = {
    home: document.getElementById('view-home'),
    play: document.getElementById('view-play'),
    create: document.getElementById('view-create'),
    rules: document.getElementById('view-rules'),
    guide: document.getElementById('view-guide')
  };

  const navLinks = Array.from(document.querySelectorAll('.nav-link'));
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mainNav = document.getElementById('main-nav');

  // Play View DOM
  const playGridEl = document.getElementById('play-grid');
  const playNumpadEl = document.getElementById('play-numpad');
  const playDifficultyEl = document.getElementById('play-difficulty');
  const playModeBadgeEl = document.getElementById('play-mode-badge');
  const playMistakesEl = document.getElementById('play-mistakes');
  const playHintsLeftEl = document.getElementById('play-hints-left');
  const playTimerEl = document.getElementById('play-timer');
  const playStatusEl = document.getElementById('play-status');
  const btnPauseResume = document.getElementById('btn-pause-resume');
  const btnOverlayResume = document.getElementById('btn-overlay-resume');
  const btnRestartGame = document.getElementById('btn-restart-game');
  const btnNewGame = document.getElementById('btn-new-game');
  const btnPlayErase = document.getElementById('btn-play-erase');
  const btnPlayHint = document.getElementById('btn-play-hint');
  const pauseOverlayEl = document.getElementById('pause-overlay');
  const winOverlayEl = document.getElementById('win-overlay');
  const winSummaryEl = document.getElementById('win-summary');
  const btnWinNewGame = document.getElementById('btn-win-new-game');
  const btnWinClose = document.getElementById('btn-win-close');

  // Create View DOM
  const createGridEl = document.getElementById('create-grid');
  const createNumpadEl = document.getElementById('create-numpad');
  const createNameEl = document.getElementById('create-puzzle-name');
  const createDifficultyEl = document.getElementById('create-difficulty');
  const createClueCountEl = document.getElementById('create-clue-count');
  const createStatusEl = document.getElementById('create-status');
  const createErrorsEl = document.getElementById('create-errors');
  const btnCreateErase = document.getElementById('btn-create-erase');
  const btnCreateClear = document.getElementById('btn-create-clear');
  const btnCreateValidate = document.getElementById('btn-create-validate');
  const btnCreateSave = document.getElementById('btn-create-save');
  const btnCreatePlay = document.getElementById('btn-create-play');
  const btnExportCode = document.getElementById('btn-export-code');
  const btnExportLink = document.getElementById('btn-export-link');
  const btnExportFile = document.getElementById('btn-export-file');
  const importCodeInputEl = document.getElementById('import-code-input');
  const btnImportCode = document.getElementById('btn-import-code');
  const savedPuzzlesListEl = document.getElementById('saved-puzzles-list');

  // =========================================================================
  // Application State
  // =========================================================================
  let activeView = 'home';

  const playState = {
    initialBoard: Engine.createEmptyBoard(),
    userBoard: Engine.createEmptyBoard(),
    solution: Engine.createEmptyBoard(),
    difficulty: 'easy',
    isCustom: false,
    customName: '',
    selectedIndex: null,
    mistakes: 0,
    hintsLeft: MAX_HINTS,
    hintedCells: new Set(),
    errorCells: new Set(),
    elapsedSeconds: 0,
    paused: false,
    completed: false,
    timerId: null
  };

  const createState = {
    board: Engine.createEmptyBoard(),
    selectedIndex: null,
    conflictingIndices: new Set()
  };

  // =========================================================================
  // Utility Helpers
  // =========================================================================
  function formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function setStatus(el, type, message) {
    el.className = `status-banner status-${type}`;
    el.textContent = message;
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(() => true).catch(() => fallbackCopy(text));
    }
    return Promise.resolve(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch (_) {
      return false;
    }
  }

  // =========================================================================
  // Navigation & Routing
  // =========================================================================
  function switchView(viewName, updateHash = true) {
    if (!views[viewName]) viewName = 'home';
    activeView = viewName;

    Object.keys(views).forEach((key) => {
      const isTarget = key === viewName;
      views[key].hidden = !isTarget;
      views[key].classList.toggle('active', isTarget);
    });

    navLinks.forEach((link) => {
      link.classList.toggle('active', link.dataset.nav === viewName);
    });

    if (mainNav.classList.contains('open')) {
      mainNav.classList.remove('open');
      mobileMenuBtn.setAttribute('aria-expanded', 'false');
    }

    if (updateHash && window.location.hash !== `#${viewName}`) {
      window.location.hash = `#${viewName}`;
    }

    if (viewName === 'play') {
      if (!playState.paused && !playState.completed) {
        startTimer();
      }
    } else {
      stopTimer();
    }

    if (viewName === 'create') {
      renderSavedPuzzles();
    }

    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function handleHashRoute() {
    const rawHash = window.location.hash || '#home';
    const [routePart, queryPart] = rawHash.slice(1).split('?');
    const targetView = views[routePart] ? routePart : 'home';

    if (targetView === 'play' && queryPart) {
      const params = new URLSearchParams(queryPart);
      const customCode = params.get('custom');
      const customDiff = params.get('diff') || 'medium';
      if (customCode) {
        const board = Engine.deserializeBoard(customCode);
        if (board) {
          const validation = Engine.validateCustomPuzzle(board);
          if (validation.valid) {
            loadCustomIntoPlay(board, validation.solution, customDiff, 'Shared Custom Puzzle');
            switchView('play', false);
            return;
          }
        }
      }
    }

    switchView(targetView, false);
  }

  // =========================================================================
  // Play Sudoku Logic
  // =========================================================================
  function startTimer() {
    if (playState.timerId !== null) return;
    playState.timerId = window.setInterval(() => {
      if (!playState.paused && !playState.completed && activeView === 'play') {
        playState.elapsedSeconds++;
        playTimerEl.textContent = formatTime(playState.elapsedSeconds);
        persistPlayState();
      }
    }, 1000);
  }

  function stopTimer() {
    if (playState.timerId !== null) {
      window.clearInterval(playState.timerId);
      playState.timerId = null;
    }
  }

  function persistPlayState() {
    Storage.saveActiveGame({
      initialBoard: playState.initialBoard,
      userBoard: playState.userBoard,
      solution: playState.solution,
      difficulty: playState.difficulty,
      isCustom: playState.isCustom,
      customName: playState.customName,
      mistakes: playState.mistakes,
      hintsLeft: playState.hintsLeft,
      hintedCells: Array.from(playState.hintedCells),
      errorCells: Array.from(playState.errorCells),
      elapsedSeconds: playState.elapsedSeconds,
      completed: playState.completed
    });
  }

  function startNewGeneratedGame(difficulty) {
    const diff = Engine.DIFFICULTY_CONFIG[difficulty] ? difficulty : 'easy';
    const generated = Engine.generatePuzzle(diff);

    playState.initialBoard = generated.puzzle;
    playState.userBoard = Engine.cloneBoard(generated.puzzle);
    playState.solution = generated.solution;
    playState.difficulty = diff;
    playState.isCustom = false;
    playState.customName = '';
    playState.selectedIndex = null;
    playState.mistakes = 0;
    playState.hintsLeft = MAX_HINTS;
    playState.hintedCells = new Set();
    playState.errorCells = new Set();
    playState.elapsedSeconds = 0;
    playState.paused = false;
    playState.completed = false;

    playDifficultyEl.value = diff;
    setStatus(
      playStatusEl,
      'info',
      `New ${Engine.DIFFICULTY_CONFIG[diff].label} puzzle ready (${generated.clues} starting numbers). Select an empty cell to begin.`
    );
    renderPlayView();
    persistPlayState();
    if (activeView === 'play') startTimer();
  }

  function loadCustomIntoPlay(board, solution, difficulty, name) {
    playState.initialBoard = Engine.cloneBoard(board);
    playState.userBoard = Engine.cloneBoard(board);
    playState.solution = Engine.cloneBoard(solution);
    playState.difficulty = Engine.DIFFICULTY_CONFIG[difficulty] ? difficulty : 'medium';
    playState.isCustom = true;
    playState.customName = name || 'Custom Puzzle';
    playState.selectedIndex = null;
    playState.mistakes = 0;
    playState.hintsLeft = MAX_HINTS;
    playState.hintedCells = new Set();
    playState.errorCells = new Set();
    playState.elapsedSeconds = 0;
    playState.paused = false;
    playState.completed = false;

    playDifficultyEl.value = playState.difficulty;
    setStatus(
      playStatusEl,
      'info',
      `Playing "${playState.customName}". Your starting numbers are locked.`
    );
    renderPlayView();
    persistPlayState();
    if (activeView === 'play') startTimer();
  }

  function restartCurrentGame() {
    playState.userBoard = Engine.cloneBoard(playState.initialBoard);
    playState.selectedIndex = null;
    playState.mistakes = 0;
    playState.hintsLeft = MAX_HINTS;
    playState.hintedCells = new Set();
    playState.errorCells = new Set();
    playState.elapsedSeconds = 0;
    playState.paused = false;
    playState.completed = false;

    setStatus(playStatusEl, 'info', 'Puzzle restarted. Good luck!');
    renderPlayView();
    persistPlayState();
    if (activeView === 'play') startTimer();
  }

  function togglePause() {
    if (playState.completed) return;
    playState.paused = !playState.paused;
    renderPlayMeta();
  }

  function selectPlayCell(index) {
    if (playState.paused) return;
    playState.selectedIndex = index;
    renderPlayGrid();
  }

  function hasRuleConflictAt(board, index, value) {
    const r = Engine.getRow(index);
    const c = Engine.getCol(index);
    const b = Engine.getBox(index);
    for (let i = 0; i < 81; i++) {
      if (i === index) continue;
      if (board[i] !== value) continue;
      if (Engine.getRow(i) === r || Engine.getCol(i) === c || Engine.getBox(i) === b) {
        return true;
      }
    }
    return false;
  }

  function handlePlayNumberInput(num) {
    if (playState.paused || playState.completed) return;
    const idx = playState.selectedIndex;
    if (idx === null) {
      setStatus(playStatusEl, 'info', 'Please select an empty cell first.');
      return;
    }
    if (playState.initialBoard[idx] !== 0) {
      setStatus(playStatusEl, 'error', 'Original given numbers cannot be changed.');
      return;
    }
    if (playState.hintedCells.has(idx)) {
      setStatus(playStatusEl, 'info', 'This cell was revealed by a hint and is already correct.');
      return;
    }

    const previousVal = playState.userBoard[idx];
    if (previousVal === num) return;

    playState.userBoard[idx] = num;

    if (num !== playState.solution[idx]) {
      playState.errorCells.add(idx);
      playState.mistakes++;

      if (hasRuleConflictAt(playState.userBoard, idx, num)) {
        setStatus(
          playStatusEl,
          'error',
          `Incorrect entry: ${num} already appears in this row, column, or 3×3 box.`
        );
      } else {
        setStatus(
          playStatusEl,
          'error',
          `Incorrect entry for this cell. Check the row, column, and 3×3 box using logic.`
        );
      }
    } else {
      playState.errorCells.delete(idx);
      setStatus(playStatusEl, 'info', `Entered ${num}.`);
    }

    checkPlayCompletion();
    renderPlayView();
    persistPlayState();
  }

  function handlePlayErase() {
    if (playState.paused || playState.completed) return;
    const idx = playState.selectedIndex;
    if (idx === null) {
      setStatus(playStatusEl, 'info', 'Select a cell to erase.');
      return;
    }
    if (playState.initialBoard[idx] !== 0) {
      setStatus(playStatusEl, 'error', 'Original given numbers cannot be erased.');
      return;
    }
    if (playState.hintedCells.has(idx)) {
      setStatus(playStatusEl, 'info', 'Hinted numbers are locked because they are already correct.');
      return;
    }
    if (playState.userBoard[idx] === 0) return;

    playState.userBoard[idx] = 0;
    playState.errorCells.delete(idx);
    setStatus(playStatusEl, 'info', 'Cell cleared.');
    renderPlayView();
    persistPlayState();
  }

  function handlePlayHint() {
    if (playState.paused || playState.completed) return;
    if (playState.hintsLeft <= 0) {
      setStatus(playStatusEl, 'error', 'No hints remaining for this puzzle.');
      return;
    }

    const idx = playState.selectedIndex;
    if (idx === null) {
      setStatus(playStatusEl, 'info', 'Please select an empty cell first before clicking Hint.');
      return;
    }
    if (playState.initialBoard[idx] !== 0 || playState.hintedCells.has(idx)) {
      setStatus(playStatusEl, 'info', 'This cell is already filled. Please select an empty cell.');
      return;
    }
    if (playState.userBoard[idx] !== 0 && !playState.errorCells.has(idx)) {
      setStatus(playStatusEl, 'info', 'This cell already has the correct number. Select an empty cell for a hint.');
      return;
    }

    const correctNum = playState.solution[idx];
    playState.userBoard[idx] = correctNum;
    playState.errorCells.delete(idx);
    playState.hintedCells.add(idx);
    playState.hintsLeft--;

    setStatus(
      playStatusEl,
      'success',
      `Hint used: revealed ${correctNum} at Row ${Engine.getRow(idx) + 1}, Column ${Engine.getCol(idx) + 1}.`
    );

    checkPlayCompletion();
    renderPlayView();
    persistPlayState();
  }

  function checkPlayCompletion() {
    if (Engine.isBoardCompleteAndValid(playState.userBoard, playState.solution)) {
      playState.completed = true;
      stopTimer();
      const hintsUsed = MAX_HINTS - playState.hintsLeft;
      const diffLabel = Engine.DIFFICULTY_CONFIG[playState.difficulty].label;
      const modeLabel = playState.isCustom ? `Custom (${diffLabel})` : diffLabel;
      winSummaryEl.textContent =
        `Difficulty: ${modeLabel} | Time: ${formatTime(playState.elapsedSeconds)} | Mistakes: ${playState.mistakes} | Hints used: ${hintsUsed}`;
      setStatus(playStatusEl, 'success', 'Congratulations! You completed the Sudoku puzzle correctly!');
      winOverlayEl.hidden = false;
    }
  }

  function renderPlayMeta() {
    playMistakesEl.textContent = String(playState.mistakes);
    playHintsLeftEl.textContent = String(playState.hintsLeft);
    playTimerEl.textContent = formatTime(playState.elapsedSeconds);
    btnPlayHint.textContent = `Hint (${playState.hintsLeft} left)`;
    btnPlayHint.disabled = playState.hintsLeft <= 0 || playState.completed || playState.paused;

    btnPauseResume.textContent = playState.paused ? 'Resume' : 'Pause';
    btnPauseResume.disabled = playState.completed;
    pauseOverlayEl.hidden = !playState.paused;
    winOverlayEl.hidden = !playState.completed;

    if (playState.isCustom) {
      playModeBadgeEl.hidden = false;
      playModeBadgeEl.textContent = playState.customName || 'Custom Puzzle';
    } else {
      playModeBadgeEl.hidden = true;
    }
  }

  function renderPlayGrid() {
    const sel = playState.selectedIndex;
    const selRow = sel !== null ? Engine.getRow(sel) : -1;
    const selCol = sel !== null ? Engine.getCol(sel) : -1;
    const selBox = sel !== null ? Engine.getBox(sel) : -1;
    const selVal = sel !== null ? playState.userBoard[sel] : 0;

    playGridEl.innerHTML = '';

    for (let i = 0; i < 81; i++) {
      const r = Engine.getRow(i);
      const c = Engine.getCol(i);
      const b = Engine.getBox(i);
      const val = playState.userBoard[i];
      const isGiven = playState.initialBoard[i] !== 0;
      const isHinted = playState.hintedCells.has(i);
      const isError = playState.errorCells.has(i);

      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'sudoku-cell';
      cell.setAttribute('role', 'gridcell');
      cell.dataset.index = String(i);
      cell.setAttribute(
        'aria-label',
        `Row ${r + 1} Column ${c + 1}, ${val ? `value ${val}` : 'empty'}${isGiven ? ', locked given' : ''}`
      );

      if (c === 2 || c === 5) cell.classList.add('box-right');
      if (r === 2 || r === 5) cell.classList.add('box-bottom');

      if (i === sel) {
        cell.classList.add('cell-selected');
      } else if (selVal !== 0 && val === selVal) {
        cell.classList.add('cell-match');
      } else if (sel !== null && (r === selRow || c === selCol || b === selBox)) {
        cell.classList.add('cell-peer');
      }

      if (isGiven) {
        cell.classList.add('cell-given');
      } else if (isHinted) {
        cell.classList.add('cell-hint');
      } else if (val !== 0) {
        cell.classList.add('cell-user');
      }

      if (isError) {
        cell.classList.add('cell-error');
      }

      cell.textContent = val !== 0 ? String(val) : '';
      cell.addEventListener('click', () => selectPlayCell(i));
      playGridEl.appendChild(cell);
    }
  }

  function renderPlayView() {
    renderPlayMeta();
    renderPlayGrid();
  }

  // =========================================================================
  // Create Your Own Sudoku Logic
  // =========================================================================
  function clearValidationDisplay() {
    createState.conflictingIndices = new Set();
    createErrorsEl.hidden = true;
    createErrorsEl.innerHTML = '';
  }

  function updateCreatorClueCount() {
    const clues = Engine.countClues(createState.board);
    createClueCountEl.textContent = `${clues} / 81`;
  }

  function handleCreateNumberInput(num) {
    const idx = createState.selectedIndex;
    if (idx === null) {
      setStatus(createStatusEl, 'info', 'Select a cell on the grid first.');
      return;
    }
    createState.board[idx] = num;
    clearValidationDisplay();
    updateCreatorClueCount();
    setStatus(createStatusEl, 'info', `Placed ${num}. Click "Validate Puzzle" when finished.`);
    renderCreateGrid();
  }

  function handleCreateErase() {
    const idx = createState.selectedIndex;
    if (idx === null) {
      setStatus(createStatusEl, 'info', 'Select a cell on the grid to erase.');
      return;
    }
    createState.board[idx] = 0;
    clearValidationDisplay();
    updateCreatorClueCount();
    setStatus(createStatusEl, 'info', 'Cell cleared.');
    renderCreateGrid();
  }

  function handleCreateClearGrid() {
    createState.board = Engine.createEmptyBoard();
    createState.selectedIndex = null;
    clearValidationDisplay();
    updateCreatorClueCount();
    setStatus(createStatusEl, 'info', 'Grid cleared. Enter numbers from 1 to 9 to build your puzzle.');
    renderCreateGrid();
  }

  function runCreatorValidation() {
    const result = Engine.validateCustomPuzzle(createState.board);
    createState.conflictingIndices = result.conflictingIndices;

    if (!result.valid) {
      setStatus(createStatusEl, 'error', 'Validation failed. Please fix the issue(s) listed below:');
      createErrorsEl.innerHTML = '';
      result.errors.forEach((msg) => {
        const li = document.createElement('li');
        li.textContent = msg;
        createErrorsEl.appendChild(li);
      });
      createErrorsEl.hidden = false;
      renderCreateGrid();
      return result;
    }

    createErrorsEl.hidden = true;
    createErrorsEl.innerHTML = '';
    setStatus(
      createStatusEl,
      'success',
      `Valid puzzle! All rows, columns, and 3×3 boxes follow Sudoku rules and it has exactly one unique solution (${result.clues} clues).`
    );
    renderCreateGrid();
    return result;
  }

  function handleSaveCustomPuzzle() {
    const validation = runCreatorValidation();
    if (!validation.valid) return;

    const nameInput = createNameEl.value.trim();
    const saved = Storage.saveCustomPuzzle({
      name: nameInput || undefined,
      difficulty: createDifficultyEl.value,
      puzzleString: Engine.serializeBoard(createState.board),
      clues: validation.clues
    });

    setStatus(createStatusEl, 'success', `Saved "${saved.name}" locally! You can play or export it anytime.`);
    renderSavedPuzzles();
  }

  function handlePlayCustomPuzzle() {
    const validation = runCreatorValidation();
    if (!validation.valid) return;

    const name = createNameEl.value.trim() || 'My Custom Sudoku';
    loadCustomIntoPlay(createState.board, validation.solution, createDifficultyEl.value, name);
    switchView('play');
  }

  function handleExportCode() {
    const code = Engine.serializeBoard(createState.board);
    copyToClipboard(code).then((ok) => {
      if (ok) {
        setStatus(createStatusEl, 'success', `Copied 81-digit puzzle code to clipboard: ${code}`);
      } else {
        setStatus(createStatusEl, 'info', `Puzzle code: ${code}`);
      }
    });
  }

  function handleExportLink() {
    const validation = runCreatorValidation();
    if (!validation.valid) return;
    const code = Engine.serializeBoard(createState.board);
    const diff = createDifficultyEl.value;
    const base = window.location.href.split('#')[0];
    const shareUrl = `${base}#play?custom=${code}&diff=${encodeURIComponent(diff)}`;

    copyToClipboard(shareUrl).then((ok) => {
      if (ok) {
        setStatus(createStatusEl, 'success', 'Shareable puzzle link copied to clipboard!');
      } else {
        setStatus(createStatusEl, 'info', `Share link: ${shareUrl}`);
      }
    });
  }

  function handleExportFile() {
    const code = Engine.serializeBoard(createState.board);
    const name = (createNameEl.value.trim() || 'custom-sudoku').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase();
    const lines = [
      `SUDOKU Puzzle: ${createNameEl.value.trim() || 'Custom Puzzle'}`,
      `Difficulty: ${createDifficultyEl.value}`,
      `Clues: ${Engine.countClues(createState.board)}`,
      `Code: ${code}`,
      ''
    ];
    for (let r = 0; r < 9; r++) {
      const rowSlice = createState.board.slice(r * 9, r * 9 + 9).map((n) => (n === 0 ? '.' : String(n)));
      lines.push(
        `${rowSlice.slice(0, 3).join(' ')} | ${rowSlice.slice(3, 6).join(' ')} | ${rowSlice.slice(6, 9).join(' ')}`
      );
      if (r === 2 || r === 5) lines.push('------+-------+------');
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatus(createStatusEl, 'success', `Downloaded ${name}.txt.`);
  }

  function handleImportCode() {
    const raw = importCodeInputEl.value.trim();
    const board = Engine.deserializeBoard(raw);
    if (!board) {
      setStatus(
        createStatusEl,
        'error',
        'Invalid code. Please enter exactly 81 digits (use 0 or . for empty cells).'
      );
      return;
    }
    createState.board = board;
    createState.selectedIndex = null;
    updateCreatorClueCount();
    runCreatorValidation();
  }

  function renderCreateGrid() {
    const sel = createState.selectedIndex;
    const selRow = sel !== null ? Engine.getRow(sel) : -1;
    const selCol = sel !== null ? Engine.getCol(sel) : -1;
    const selBox = sel !== null ? Engine.getBox(sel) : -1;
    const selVal = sel !== null ? createState.board[sel] : 0;

    createGridEl.innerHTML = '';

    for (let i = 0; i < 81; i++) {
      const r = Engine.getRow(i);
      const c = Engine.getCol(i);
      const b = Engine.getBox(i);
      const val = createState.board[i];
      const isConflict = createState.conflictingIndices.has(i);

      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'sudoku-cell';
      cell.setAttribute('role', 'gridcell');
      cell.dataset.index = String(i);
      cell.setAttribute(
        'aria-label',
        `Creator Row ${r + 1} Column ${c + 1}, ${val ? `value ${val}` : 'empty'}`
      );

      if (c === 2 || c === 5) cell.classList.add('box-right');
      if (r === 2 || r === 5) cell.classList.add('box-bottom');

      if (i === sel) {
        cell.classList.add('cell-selected');
      } else if (selVal !== 0 && val === selVal) {
        cell.classList.add('cell-match');
      } else if (sel !== null && (r === selRow || c === selCol || b === selBox)) {
        cell.classList.add('cell-peer');
      }

      if (val !== 0) {
        cell.classList.add('cell-given');
      }
      if (isConflict) {
        cell.classList.add('cell-error');
      }

      cell.textContent = val !== 0 ? String(val) : '';
      cell.addEventListener('click', () => {
        createState.selectedIndex = i;
        renderCreateGrid();
      });
      createGridEl.appendChild(cell);
    }
  }

  function renderSavedPuzzles() {
    const list = Storage.loadCustomPuzzles();
    savedPuzzlesListEl.innerHTML = '';

    if (list.length === 0) {
      const p = document.createElement('p');
      p.className = 'saved-empty';
      p.textContent = 'No saved custom puzzles yet. Create and validate a puzzle above, then click "Save Puzzle".';
      savedPuzzlesListEl.appendChild(p);
      return;
    }

    list.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'saved-card';

      const top = document.createElement('div');
      top.className = 'saved-card-top';

      const title = document.createElement('h3');
      title.className = 'saved-card-title';
      title.textContent = item.name;

      const badge = document.createElement('span');
      badge.className = 'badge badge-gold';
      badge.textContent = Engine.DIFFICULTY_CONFIG[item.difficulty]
        ? Engine.DIFFICULTY_CONFIG[item.difficulty].label
        : item.difficulty;

      top.appendChild(title);
      top.appendChild(badge);

      const meta = document.createElement('p');
      meta.className = 'saved-card-meta';
      const dateLabel = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '';
      meta.textContent = `${item.clues || '?'} clues${dateLabel ? ` • Saved ${dateLabel}` : ''}`;

      const actions = document.createElement('div');
      actions.className = 'saved-card-actions';

      const playBtn = document.createElement('button');
      playBtn.type = 'button';
      playBtn.className = 'btn btn-primary btn-sm';
      playBtn.textContent = 'Play';
      playBtn.addEventListener('click', () => {
        const board = Engine.deserializeBoard(item.puzzleString);
        const validation = board ? Engine.validateCustomPuzzle(board) : null;
        if (validation && validation.valid) {
          loadCustomIntoPlay(board, validation.solution, item.difficulty, item.name);
          switchView('play');
        }
      });

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn btn-outline btn-sm';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => {
        const board = Engine.deserializeBoard(item.puzzleString);
        if (board) {
          createState.board = board;
          createState.selectedIndex = null;
          createNameEl.value = item.name;
          if (Engine.DIFFICULTY_CONFIG[item.difficulty]) {
            createDifficultyEl.value = item.difficulty;
          }
          clearValidationDisplay();
          updateCreatorClueCount();
          renderCreateGrid();
          setStatus(createStatusEl, 'info', `Loaded "${item.name}" into the editor.`);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn btn-danger-outline btn-sm';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => {
        Storage.deleteCustomPuzzle(item.id);
        renderSavedPuzzles();
      });

      actions.appendChild(playBtn);
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);

      card.appendChild(top);
      card.appendChild(meta);
      card.appendChild(actions);
      savedPuzzlesListEl.appendChild(card);
    });
  }

  // =========================================================================
  // Shared Numpad & Keyboard Controls
  // =========================================================================
  function buildNumpad(containerEl, onDigitClick) {
    containerEl.innerHTML = '';
    for (let n = 1; n <= 9; n++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'num-btn';
      btn.textContent = String(n);
      btn.setAttribute('aria-label', `Number ${n}`);
      btn.addEventListener('click', () => onDigitClick(n));
      containerEl.appendChild(btn);
    }
  }

  function handleKeyboard(e) {
    if (activeView !== 'play' && activeView !== 'create') return;

    const tag = document.activeElement ? document.activeElement.tagName : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    const isPlay = activeView === 'play';
    if (isPlay && playState.paused) return;

    if (e.key >= '1' && e.key <= '9') {
      e.preventDefault();
      const num = Number(e.key);
      if (isPlay) handlePlayNumberInput(num);
      else handleCreateNumberInput(num);
      return;
    }

    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
      e.preventDefault();
      if (isPlay) handlePlayErase();
      else handleCreateErase();
      return;
    }

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      const current = isPlay ? playState.selectedIndex : createState.selectedIndex;
      let next = current === null ? 0 : current;
      let r = Engine.getRow(next);
      let c = Engine.getCol(next);

      if (e.key === 'ArrowUp') r = (r + 8) % 9;
      if (e.key === 'ArrowDown') r = (r + 1) % 9;
      if (e.key === 'ArrowLeft') c = (c + 8) % 9;
      if (e.key === 'ArrowRight') c = (c + 1) % 9;

      next = r * 9 + c;
      if (isPlay) {
        selectPlayCell(next);
      } else {
        createState.selectedIndex = next;
        renderCreateGrid();
      }
    }
  }

  // =========================================================================
  // Initialization
  // =========================================================================
  function initPlayStateFromStorageOrNew() {
    const saved = Storage.loadActiveGame();
    if (
      saved &&
      Array.isArray(saved.initialBoard) &&
      saved.initialBoard.length === 81 &&
      Array.isArray(saved.userBoard) &&
      saved.userBoard.length === 81 &&
      Array.isArray(saved.solution) &&
      saved.solution.length === 81 &&
      !saved.completed
    ) {
      playState.initialBoard = saved.initialBoard;
      playState.userBoard = saved.userBoard;
      playState.solution = saved.solution;
      playState.difficulty = Engine.DIFFICULTY_CONFIG[saved.difficulty] ? saved.difficulty : 'easy';
      playState.isCustom = Boolean(saved.isCustom);
      playState.customName = saved.customName || '';
      playState.mistakes = Number(saved.mistakes) || 0;
      playState.hintsLeft = typeof saved.hintsLeft === 'number' ? saved.hintsLeft : MAX_HINTS;
      playState.hintedCells = new Set(Array.isArray(saved.hintedCells) ? saved.hintedCells : []);
      playState.errorCells = new Set(Array.isArray(saved.errorCells) ? saved.errorCells : []);
      playState.elapsedSeconds = Number(saved.elapsedSeconds) || 0;
      playState.paused = false;
      playState.completed = false;

      playDifficultyEl.value = playState.difficulty;
      setStatus(playStatusEl, 'info', 'Resumed your previous puzzle. Select a cell to continue.');
      renderPlayView();
    } else {
      startNewGeneratedGame('easy');
    }
  }

  function bindEvents() {
    // Navigation links & CTA buttons
    document.querySelectorAll('[data-nav]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        switchView(el.dataset.nav);
      });
    });

    document.querySelectorAll('[data-go]').forEach((el) => {
      el.addEventListener('click', () => {
        switchView(el.dataset.go);
      });
    });

    mobileMenuBtn.addEventListener('click', () => {
      const isOpen = mainNav.classList.toggle('open');
      mobileMenuBtn.setAttribute('aria-expanded', String(isOpen));
    });

    window.addEventListener('hashchange', handleHashRoute);
    document.addEventListener('keydown', handleKeyboard);

    // Play Controls
    playDifficultyEl.addEventListener('change', (e) => {
      startNewGeneratedGame(e.target.value);
    });
    btnNewGame.addEventListener('click', () => {
      startNewGeneratedGame(playDifficultyEl.value);
    });
    btnWinNewGame.addEventListener('click', () => {
      startNewGeneratedGame(playDifficultyEl.value);
    });
    btnWinClose.addEventListener('click', () => {
      winOverlayEl.hidden = true;
    });
    btnRestartGame.addEventListener('click', restartCurrentGame);
    btnPauseResume.addEventListener('click', togglePause);
    btnOverlayResume.addEventListener('click', togglePause);
    btnPlayErase.addEventListener('click', handlePlayErase);
    btnPlayHint.addEventListener('click', handlePlayHint);

    // Create Controls
    btnCreateErase.addEventListener('click', handleCreateErase);
    btnCreateClear.addEventListener('click', handleCreateClearGrid);
    btnCreateValidate.addEventListener('click', runCreatorValidation);
    btnCreateSave.addEventListener('click', handleSaveCustomPuzzle);
    btnCreatePlay.addEventListener('click', handlePlayCustomPuzzle);
    btnExportCode.addEventListener('click', handleExportCode);
    btnExportLink.addEventListener('click', handleExportLink);
    btnExportFile.addEventListener('click', handleExportFile);
    btnImportCode.addEventListener('click', handleImportCode);
  }

  function init() {
    buildNumpad(playNumpadEl, handlePlayNumberInput);
    buildNumpad(createNumpadEl, handleCreateNumberInput);

    initPlayStateFromStorageOrNew();
    renderCreateGrid();
    updateCreatorClueCount();
    renderSavedPuzzles();

    if (Tutorial && typeof Tutorial.init === 'function') {
      Tutorial.init({
        gridEl: document.getElementById('tut-grid'),
        stepTitleEl: document.getElementById('tut-step-title'),
        stepDescEl: document.getElementById('tut-step-desc'),
        stepCounterEl: document.getElementById('tut-step-counter'),
        prevBtn: document.getElementById('tut-prev-btn'),
        nextBtn: document.getElementById('tut-next-btn'),
        resetBtn: document.getElementById('tut-reset-btn'),
        padEl: document.getElementById('tut-pad'),
        feedbackEl: document.getElementById('tut-feedback')
      });
    }

    bindEvents();
    handleHashRoute();
  }

  init();
})();

