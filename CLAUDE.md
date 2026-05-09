# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Game

No build step. Open `index.html` directly in a browser or serve it:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

No package.json, no npm, no tests.

## Architecture

Pure vanilla HTML5/CSS3/JS — three files:

- `index.html` — two `<canvas>` elements (board 300×600, next-piece preview 120×120) plus a side panel for score/lines/level
- `style.css` — dark arcade theme, flexbox layout
- `game.js` — all game logic (~305 lines)

### game.js internals

**Board**: 20×10 grid (`ROWS=20`, `COLS=10`, `BLOCK=30`px). Each cell is `0` (empty) or `1–7` (piece color index).

**Game loop**: `requestAnimationFrame` + timestamp accumulator (`dropAccum += dt`). When `dropAccum >= dropInterval`, the piece drops one row or locks.

**Pieces**: 7 tetrominoes defined as 4×4 matrices. `randomPiece()` spawns at center-top. `rotateCW()` = transpose + row-reverse. `tryRotate()` applies 5-position wall-kick offsets (`0, -1, +1, -2, +2`).

**Scoring**: `LINE_SCORES = [0, 100, 300, 500, 800]` × level. Soft drop = 1pt/row, hard drop = 2pt/cell.

**Difficulty**: Level up every 10 lines. `dropInterval = max(100, 1000 - (level-1)×90)` ms.

**Ghost piece**: `ghostY()` projects landing row; rendered with alpha overlay.

**Controls**: Arrow keys (move/soft-drop), Space (hard drop), Up/X (rotate CW), P (pause).

### Flow

```
init() → createBoard() → spawn() → requestAnimationFrame(loop)
loop: accumulate dt → drop/lock → draw board + ghost + current piece
lockPiece() → clearLines() → updateScore() → spawn() → repeat
```
