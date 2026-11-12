/**
 * LocalStorage persistence for saved custom puzzles and active game state.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SudokuStorage = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CUSTOM_PUZZLES_KEY = 'sudoku_custom_puzzles_v1';
  const ACTIVE_GAME_KEY = 'sudoku_active_game_v1';

  function safeGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function safeSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (_) {
      return false;
    }
  }

  function loadCustomPuzzles() {
    const raw = safeGet(CUSTOM_PUZZLES_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function saveCustomPuzzle(entry) {
    const list = loadCustomPuzzles();
    const id = entry.id || `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const record = {
      id,
      name: entry.name || `Custom Puzzle #${list.length + 1}`,
      difficulty: entry.difficulty || 'medium',
      puzzleString: entry.puzzleString,
      clues: entry.clues,
      createdAt: entry.createdAt || new Date().toISOString()
    };
    const existingIdx = list.findIndex((p) => p.puzzleString === record.puzzleString);
    if (existingIdx >= 0) {
      list[existingIdx] = { ...list[existingIdx], ...record, id: list[existingIdx].id };
    } else {
      list.unshift(record);
    }
    safeSet(CUSTOM_PUZZLES_KEY, JSON.stringify(list));
    return record;
  }

  function deleteCustomPuzzle(id) {
    const list = loadCustomPuzzles().filter((p) => p.id !== id);
    safeSet(CUSTOM_PUZZLES_KEY, JSON.stringify(list));
    return list;
  }

  function saveActiveGame(state) {
    return safeSet(ACTIVE_GAME_KEY, JSON.stringify(state));
  }

  function loadActiveGame() {
    const raw = safeGet(ACTIVE_GAME_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function clearActiveGame() {
    try {
      window.localStorage.removeItem(ACTIVE_GAME_KEY);
    } catch (_) {
      // ignore
    }
  }

  return {
    loadCustomPuzzles,
    saveCustomPuzzle,
    deleteCustomPuzzle,
    saveActiveGame,
    loadActiveGame,
    clearActiveGame
  };
}));

