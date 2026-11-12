/**
 * End-to-end DOM & Application Integration Test for SUDOKU – Play & Create
 * Loads index.html structure (via lightweight DOM mock) and exercises js/app.js,
 * js/sudoku-engine.js, js/storage.js, and js/tutorial.js.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function createElement(tag) {
  const listeners = {};
  const classSet = new Set();
  const children = [];
  const attributes = {};
  const dataset = {};

  const el = {
    tagName: tag.toUpperCase(),
    id: '',
    value: '',
    textContent: '',
    hidden: false,
    disabled: false,
    style: {},
    dataset,
    children,
    set className(val) {
      classSet.clear();
      String(val)
        .split(/\s+/)
        .filter(Boolean)
        .forEach((c) => classSet.add(c));
    },
    get className() {
      return Array.from(classSet).join(' ');
    },
    classList: {
      add: (...cls) => cls.forEach((c) => classSet.add(c)),
      remove: (...cls) => cls.forEach((c) => classSet.delete(c)),
      toggle: (c, force) => {
        if (force === undefined) {
          if (classSet.has(c)) {
            classSet.delete(c);
            return false;
          }
          classSet.add(c);
          return true;
        }
        if (force) classSet.add(c);
        else classSet.delete(c);
        return force;
      },
      contains: (c) => classSet.has(c)
    },
    set innerHTML(val) {
      if (val === '') children.length = 0;
    },
    get innerHTML() {
      return children.map((c) => c.textContent || '').join('');
    },
    appendChild(child) {
      children.push(child);
      return child;
    },
    removeChild(child) {
      const idx = children.indexOf(child);
      if (idx >= 0) children.splice(idx, 1);
    },
    setAttribute(k, v) {
      attributes[k] = String(v);
      if (k.startsWith('data-')) {
        const key = k.slice(5).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
        dataset[key] = String(v);
      }
    },
    getAttribute(k) {
      return attributes[k] || null;
    },
    addEventListener(type, fn) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(fn);
    },
    dispatchEvent(event) {
      const list = listeners[event.type] || [];
      list.forEach((fn) => fn(event));
    },
    click() {
      this.dispatchEvent({ type: 'click', target: this, preventDefault() {} });
    },
    select() {}
  };
  return el;
}

function runIntegrationTests() {
  console.log('Running full application integration tests...');

  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

  // Extract all element IDs and data-nav / data-go elements from index.html
  const elementsById = {};
  const idMatches = [...html.matchAll(/id="([^"]+)"/g)];
  for (const m of idMatches) {
    const id = m[1];
    const tagMatch = html.slice(Math.max(0, m.index - 60), m.index).match(/<([a-z0-9]+)/i);
    elementsById[id] = createElement(tagMatch ? tagMatch[1] : 'div');
    elementsById[id].id = id;
  }

  // Ensure select defaults match index.html
  elementsById['play-difficulty'].value = 'easy';
  elementsById['create-difficulty'].value = 'medium';

  const navElements = [];
  for (const m of html.matchAll(/data-nav="([^"]+)"/g)) {
    const el = createElement('a');
    el.dataset.nav = m[1];
    el.className = 'nav-link';
    navElements.push(el);
  }
  const goElements = [];
  for (const m of html.matchAll(/data-go="([^"]+)"/g)) {
    const el = createElement('button');
    el.dataset.go = m[1];
    goElements.push(el);
  }

  const localStore = {};
  const windowListeners = {};
  const docListeners = {};

  const sandboxWindow = {
    localStorage: {
      getItem: (k) => (k in localStore ? localStore[k] : null),
      setItem: (k, v) => {
        localStore[k] = String(v);
      },
      removeItem: (k) => {
        delete localStore[k];
      }
    },
    location: {
      hash: '#home',
      href: 'http://localhost:8765/#home'
    },
    scrollTo: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    addEventListener: (t, fn) => {
      if (!windowListeners[t]) windowListeners[t] = [];
      windowListeners[t].push(fn);
    }
  };
  sandboxWindow.window = sandboxWindow;
  sandboxWindow.self = sandboxWindow;

  const sandboxDocument = {
    body: createElement('body'),
    activeElement: null,
    getElementById: (id) => elementsById[id] || null,
    createElement: (tag) => createElement(tag),
    querySelectorAll: (selector) => {
      if (selector === '.nav-link') return navElements;
      if (selector === '[data-nav]') return navElements;
      if (selector === '[data-go]') return goElements;
      return [];
    },
    addEventListener: (t, fn) => {
      if (!docListeners[t]) docListeners[t] = [];
      docListeners[t].push(fn);
    }
  };

  const context = vm.createContext({
    window: sandboxWindow,
    self: sandboxWindow,
    document: sandboxDocument,
    URLSearchParams,
    Blob: class {},
    URL: { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} },
    navigator: {},
    console,
    Math,
    Date,
    Array,
    Set,
    Map,
    Int32Array,
    Number,
    String,
    Boolean,
    JSON,
    encodeURIComponent
  });

  // Load scripts in exact browser order
  const scripts = ['sudoku-engine.js', 'storage.js', 'tutorial.js', 'app.js'];
  for (const file of scripts) {
    const code = fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8');
    vm.runInContext(code, context);
  }

  const Engine = sandboxWindow.SudokuEngine;

  // 1. Verify initial Play grid rendered 81 cells
  const playGrid = elementsById['play-grid'];
  assert.strictEqual(playGrid.children.length, 81, 'Play grid must render 81 cells');

  // Switch to Play view
  goElements.find((el) => el.dataset.go === 'play').click();
  assert.strictEqual(elementsById['view-play'].hidden, false);

  // 2. Test difficulty selector: Easy -> Medium -> Hard
  const diffSelect = elementsById['play-difficulty'];
  const countFilled = (grid) => grid.children.filter((c) => c.textContent !== '').length;

  const easyCount = countFilled(playGrid);
  diffSelect.value = 'medium';
  diffSelect.dispatchEvent({ type: 'change', target: diffSelect });
  const medCount = countFilled(playGrid);
  diffSelect.value = 'hard';
  diffSelect.dispatchEvent({ type: 'change', target: diffSelect });
  const hardCount = countFilled(playGrid);

  assert(easyCount >= 42 && easyCount <= 46, `Easy clues ${easyCount} out of range`);
  assert(medCount >= 32 && medCount <= 36, `Medium clues ${medCount} out of range`);
  assert(hardCount >= 24 && hardCount <= 28, `Hard clues ${hardCount} out of range`);
  console.log(`  [PASS] Play difficulty levels rendered (easy=${easyCount}, medium=${medCount}, hard=${hardCount})`);

  // 3. Test original given number cannot be changed
  const givenCellIdx = playGrid.children.findIndex((c) => c.classList.contains('cell-given'));
  const originalDigit = playGrid.children[givenCellIdx].textContent;
  const otherDigit = originalDigit === '1' ? '2' : '1';
  playGrid.children[givenCellIdx].click();
  elementsById['play-numpad'].children[Number(otherDigit) - 1].click();
  assert.strictEqual(playGrid.children[givenCellIdx].textContent, originalDigit, 'Given cell must remain locked');
  assert(elementsById['play-status'].textContent.includes('cannot be changed'));
  console.log('  [PASS] Original given cells are locked against modification');

  // 4. Test Hint with no empty cell selected (after Restart)
  elementsById['btn-restart-game'].click();
  elementsById['btn-play-hint'].click();
  assert(
    elementsById['play-status'].textContent.toLowerCase().includes('select an empty cell'),
    'Hint with no selection must ask user to select an empty cell'
  );
  assert.strictEqual(elementsById['play-hints-left'].textContent, '3');

  // 5. Test Hint on an empty cell
  const emptyCellIdx = playGrid.children.findIndex((c) => c.textContent === '');
  playGrid.children[emptyCellIdx].click();
  elementsById['btn-play-hint'].click();
  assert.notStrictEqual(playGrid.children[emptyCellIdx].textContent, '', 'Hint must reveal correct number');
  assert.strictEqual(elementsById['play-hints-left'].textContent, '2', 'Hints left must decrement to 2');
  console.log('  [PASS] Hint prompts when unselected and reveals 1 cell when selected');

  // 6. Test Mistake counter & incorrect entry & Erase
  const emptyIdx2 = playGrid.children.findIndex((c) => c.textContent === '');
  const r2 = Math.floor(emptyIdx2 / 9);
  // Find a digit already in the same row to force a rule conflict/mistake
  let conflictDigit = 1;
  for (let c = 0; c < 9; c++) {
    const val = Number(playGrid.children[r2 * 9 + c].textContent);
    if (val >= 1 && val <= 9) {
      conflictDigit = val;
      break;
    }
  }
  playGrid.children[emptyIdx2].click();
  elementsById['play-numpad'].children[conflictDigit - 1].click();
  assert.strictEqual(elementsById['play-mistakes'].textContent, '1', 'Mistake counter must increment');
  assert(playGrid.children[emptyIdx2].classList.contains('cell-error'), 'Incorrect cell must be flagged');
  elementsById['btn-play-erase'].click();
  assert.strictEqual(playGrid.children[emptyIdx2].textContent, '', 'Erase must clear incorrect user cell');
  console.log('  [PASS] Mistake counter, incorrect cell marking, and Erase');

  // 7. Test Pause & Resume
  elementsById['btn-pause-resume'].click();
  assert.strictEqual(elementsById['pause-overlay'].hidden, false, 'Pause must show overlay');
  assert.strictEqual(elementsById['btn-pause-resume'].textContent, 'Resume');
  elementsById['btn-overlay-resume'].click();
  assert.strictEqual(elementsById['pause-overlay'].hidden, true, 'Resume must hide overlay');
  assert.strictEqual(elementsById['btn-pause-resume'].textContent, 'Pause');
  console.log('  [PASS] Pause and Resume overlay behavior');

  // 8. Test Restart resets mistakes & hints
  elementsById['btn-restart-game'].click();
  assert.strictEqual(elementsById['play-mistakes'].textContent, '0');
  assert.strictEqual(elementsById['play-hints-left'].textContent, '3');
  console.log('  [PASS] Restart resets mistakes and hints');

  // 9. Test Create Your Own Sudoku: Conflict -> Clear -> Load Valid -> Save -> Play
  goElements.find((el) => el.dataset.go === 'create').click();
  assert.strictEqual(elementsById['view-create'].hidden, false);

  const createGrid = elementsById['create-grid'];
  assert.strictEqual(createGrid.children.length, 81);

  createGrid.children[0].click();
  elementsById['create-numpad'].children[4].click(); // 5
  createGrid.children[1].click();
  elementsById['create-numpad'].children[4].click(); // 5
  elementsById['btn-create-validate'].click();

  assert.strictEqual(elementsById['create-errors'].hidden, false, 'Duplicate must show error list');
  assert(createGrid.children[0].classList.contains('cell-error'));
  assert(createGrid.children[1].classList.contains('cell-error'));

  elementsById['btn-create-clear'].click();
  assert.strictEqual(elementsById['create-clue-count'].textContent, '0 / 81');

  const validCode =
    '530070000' +
    '600195000' +
    '098000060' +
    '800060003' +
    '400803001' +
    '700020006' +
    '060000280' +
    '000419005' +
    '000080079';
  elementsById['import-code-input'].value = validCode;
  elementsById['btn-import-code'].click();
  assert.strictEqual(elementsById['create-errors'].hidden, true, 'Valid puzzle must pass validation');
  assert(elementsById['create-status'].textContent.includes('Valid puzzle'));

  elementsById['create-puzzle-name'].value = 'Test Logic Grid';
  elementsById['btn-create-save'].click();
  assert.strictEqual(elementsById['saved-puzzles-list'].children.length, 1, 'Saved puzzle must appear in list');

  elementsById['btn-create-play'].click();
  assert.strictEqual(elementsById['view-play'].hidden, false, 'Play My Sudoku must switch to Play view');
  assert.strictEqual(elementsById['play-mode-badge'].hidden, false, 'Custom badge must be visible');
  assert.strictEqual(elementsById['play-mode-badge'].textContent, 'Test Logic Grid');
  // Verify starting cell 0 ('5') is locked
  playGrid.children[0].click();
  elementsById['play-numpad'].children[0].click(); // try 1
  assert.strictEqual(playGrid.children[0].textContent, '5', 'Custom starting clues must stay locked');
  console.log('  [PASS] Create Your Own Sudoku: conflict detection, clear, import, save, play locked');

  // 10. Test completing the custom puzzle using known solution via Hint/input -> Win Overlay
  const solvedCustom = Engine.solveBoard(Engine.deserializeBoard(validCode));
  for (let i = 0; i < 81; i++) {
    if (playGrid.children[i].textContent === '') {
      playGrid.children[i].click();
      elementsById['play-numpad'].children[solvedCustom[i] - 1].click();
    }
  }
  assert.strictEqual(elementsById['win-overlay'].hidden, false, 'Completing all 81 cells must trigger win overlay');
  console.log('  [PASS] Puzzle completion triggers congratulatory win overlay');

  // 11. Test Tutorial interactive example
  elementsById['tut-next-btn'].click();
  assert.strictEqual(elementsById['tut-step-counter'].textContent, 'Walkthrough 2 of 6');
  // Try wrong number 4 (blocker in column 7)
  elementsById['tut-pad'].children[3].click();
  assert(elementsById['tut-feedback'].className.includes('status-error'));
  // Try correct number 3
  elementsById['tut-pad'].children[2].click();
  assert(elementsById['tut-feedback'].className.includes('status-success'));
  console.log('  [PASS] Interactive beginner guide walkthrough & validation');

  console.log('All integration tests passed!');
}

runIntegrationTests();

