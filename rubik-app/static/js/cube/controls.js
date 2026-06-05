/** Keyboard: face/slice/cube keys + Shift/Ctrl modifiers; number keys for macros. */

const MOVE_KEYS = {
  r: "R",
  l: "L",
  u: "U",
  d: "D",
  f: "F",
  b: "B",
  m: "M",
  x: "x",
  y: "y",
  z: "z",
};

export function bindControls(renderer, { macros = [], onMoveCount, onSolved }) {
  const moveFromEvent = (key, shift, ctrl) => {
    const token = MOVE_KEYS[key.toLowerCase()];
    if (!token) return null;
    if (ctrl) return token + "2";
    if (shift) return token + "'";
    return token;
  };

  document.addEventListener("keydown", async (e) => {
    if (e.target.matches("input, textarea, select")) return;

    const macro = macros.find((m) => m.key === e.key);
    if (macro && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      await renderer.runSequence(macro.moves);
      onMoveCount?.(renderer.state.moveCount);
      if (renderer.state.solved()) onSolved?.();
      return;
    }

    const move = moveFromEvent(e.key, e.shiftKey, e.ctrlKey);
    if (!move) return;
    e.preventDefault();
    await renderer.runMove(move);
    onMoveCount?.(renderer.state.moveCount);
    if (renderer.state.solved()) onSolved?.();
  });
}

export const MOVE_HELP = [
  { keys: "R L U D F B", desc: "clockwise face turn" },
  { keys: "M", desc: "middle slice (same direction as L)" },
  { keys: "x y z", desc: "whole-cube rotation (regrip)" },
  { keys: "Shift + key", desc: "counter-clockwise (prime)" },
  { keys: "Ctrl + key", desc: "half turn (180°)" },
  { keys: "1 – 6", desc: "algorithm macro (see panel)" },
  { keys: "drag", desc: "orbit camera around cube" },
];
