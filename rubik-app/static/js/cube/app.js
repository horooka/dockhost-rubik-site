import { CubeState } from "/cube/state.js";
import { CubeRenderer } from "/cube/renderer.js";
import { bindControls } from "/cube/controls.js";

function $(id) {
  return document.getElementById(id);
}

function renderMacros(macros) {
  const ul = $("macro-list");
  if (!ul) return;
  ul.innerHTML = macros
    .map((m) => `<li><kbd>${m.key}</kbd> ${m.label}: <code>${m.moves}</code></li>`)
    .join("");
}

async function init() {
  const cfg = window.RUBIK;
  if (!cfg) return;

  renderMacros(cfg.macros || []);

  $("scramble-text").textContent = cfg.scramble;
  $("difficulty-tag").textContent = cfg.difficulty;

  const state = new CubeState();
  const renderer = new CubeRenderer($("cube-view"), state);

  const updateMoves = (n) => {
    $("move-count").textContent = String(n);
    $("moves-input").value = String(n);
  };

  const submitSolve = () => {
    $("facelets-input").value = state.facelets;
    $("solve-form").submit();
  };

  bindControls(renderer, {
    macros: cfg.macros || [],
    onMoveCount: updateMoves,
    onSolved: () => {
      $("status").textContent = "Solved! Submitting…";
      $("status").classList.add("solved");
      submitSolve();
    },
  });

  $("status").textContent = "Scrambling…";
  await renderer.scramble(cfg.scramble);
  updateMoves(state.moveCount);
  $("status").textContent = "Go!";
}

init();
