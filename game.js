'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const SKINS = {
  retro: {
    name: 'Retro',
    colors: [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#90caf9', '#ffb74d'],
    gridColor: null,
    drawBlock(ctx, x, y, ci, size, alpha) {
      if (!ci) return;
      ctx.globalAlpha = alpha ?? 1;
      ctx.fillStyle = this.colors[ci];
      ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x * size + 1, y * size + 1, size - 2, 4);
      ctx.globalAlpha = 1;
    }
  },
  neon: {
    name: 'Neon',
    colors: [null, '#00ffff', '#ffff00', '#ff00ff', '#00ff88', '#ff3366', '#4499ff', '#ff8800'],
    gridColor: '#080810',
    drawBlock(ctx, x, y, ci, size, alpha) {
      if (!ci) return;
      const color = this.colors[ci];
      const ghost = alpha !== undefined && alpha < 1;
      ctx.globalAlpha = alpha ?? 1;
      if (!ghost) { ctx.shadowColor = color; ctx.shadowBlur = 12; }
      ctx.fillStyle = color;
      ctx.fillRect(x * size + 2, y * size + 2, size - 4, size - 4);
      ctx.shadowBlur = 0;
      if (!ghost) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(x * size + 5, y * size + 5, size - 14, size - 14);
      }
      ctx.globalAlpha = 1;
    }
  },
  pastel: {
    name: 'Pastel',
    colors: [null, '#80d8e8', '#ffe082', '#ce93d8', '#a5d6a7', '#ef9a9a', '#90caf9', '#ffcc80'],
    gridColor: '#ddd4ec',
    drawBlock(ctx, x, y, ci, size, alpha) {
      if (!ci) return;
      const m = 2, r = 6;
      const px = x * size + m, py = y * size + m;
      const w = size - m * 2, h = size - m * 2;
      ctx.globalAlpha = alpha ?? 1;
      ctx.fillStyle = this.colors[ci];
      ctx.beginPath();
      ctx.moveTo(px + r, py);
      ctx.arcTo(px + w, py,     px + w, py + h, r);
      ctx.arcTo(px + w, py + h, px,     py + h, r);
      ctx.arcTo(px,     py + h, px,     py,     r);
      ctx.arcTo(px,     py,     px + w, py,     r);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(px + 3, py + 3, w - 6, 4);
      ctx.globalAlpha = 1;
    }
  },
  pixel: {
    name: 'Pixel',
    colors: [null, '#58b8d0', '#e0c040', '#9858b0', '#50a850', '#c04040', '#4870b0', '#d07820'],
    gridColor: '#181824',
    drawBlock(ctx, x, y, ci, size, alpha) {
      if (!ci) return;
      ctx.globalAlpha = alpha ?? 1;
      ctx.fillStyle = this.colors[ci];
      ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(x * size + 1,      y * size + size - 5, size - 2, 4);
      ctx.fillRect(x * size + size - 5, y * size + 1,      4,        size - 6);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(x * size + 1, y * size + 1, size - 2, 4);
      ctx.fillRect(x * size + 1, y * size + 5, 4,        size - 6);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let dy = 8; dy < size - 5; dy += 7)
        for (let dx = 8; dx < size - 5; dx += 7)
          ctx.fillRect(x * size + dx, y * size + dy, 2, 2);
      ctx.globalAlpha = 1;
    }
  }
};

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let currentSkin = SKINS.retro;

function applySkin(name) {
  currentSkin = SKINS[name] || SKINS.retro;
  localStorage.setItem('tetris-skin', name);
  document.documentElement.setAttribute('data-skin', name);
  document.querySelectorAll('.skin-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.skin === name);
  });
  if (board) { draw(); drawNext(); }
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  currentSkin.drawBlock(context, x, y, colorIndex, size, alpha);
}

function drawGrid() {
  let gridColor;
  if (currentSkin === SKINS.retro) {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    gridColor = isLight ? '#d0d4e0' : '#22222e';
  } else {
    gridColor = currentSkin.gridColor;
  }
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  if (gameOver) return;
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
      if (gameOver) return;
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

document.getElementById('theme-chk').addEventListener('change', e => {
  if (e.target.checked) {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
});

document.getElementById('skin-picker').addEventListener('click', e => {
  const btn = e.target.closest('.skin-btn');
  if (btn) applySkin(btn.dataset.skin);
});

applySkin(localStorage.getItem('tetris-skin') || 'retro');
init();
