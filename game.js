const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const enemiesEl = document.getElementById("enemies");
const overlayEl = document.getElementById("overlay");
const overlayTitleEl = document.getElementById("overlay-title");
const overlayTextEl = document.getElementById("overlay-text");

const TILE = 30;
const keys = new Set();
const walls = [];

const state = {
  score: 0,
  lives: 3,
  running: true,
  player: null,
  enemies: [],
  bullets: [],
  enemyCooldown: 0,
  lastTime: 0,
};

class Tank {
  constructor({ x, y, color, direction, speed, isPlayer = false }) {
    this.x = x;
    this.y = y;
    this.size = 34;
    this.color = color;
    this.direction = direction;
    this.speed = speed;
    this.isPlayer = isPlayer;
    this.reload = 0;
    this.hp = 1;
  }

  get rect() {
    return { x: this.x, y: this.y, w: this.size, h: this.size };
  }
}

class Bullet {
  constructor({ x, y, direction, speed, owner }) {
    this.x = x;
    this.y = y;
    this.direction = direction;
    this.speed = speed;
    this.owner = owner;
    this.radius = 4;
  }
}

function buildWalls() {
  walls.length = 0;
  const brickRows = [
    [5, 4], [6, 4], [17, 4], [18, 4],
    [8, 8], [9, 8], [20, 8], [21, 8],
    [4, 12], [5, 12], [23, 12], [24, 12],
    [10, 15], [11, 15], [18, 15], [19, 15],
  ];

  const steelRows = [
    [13, 6], [14, 6], [13, 7], [14, 7],
    [13, 10], [14, 10], [13, 11], [14, 11],
  ];

  for (const [gx, gy] of brickRows) {
    walls.push({ x: gx * TILE, y: gy * TILE, w: TILE, h: TILE, type: "brick", hp: 2 });
  }

  for (const [gx, gy] of steelRows) {
    walls.push({ x: gx * TILE, y: gy * TILE, w: TILE, h: TILE, type: "steel", hp: 999 });
  }
}

function resetGame() {
  state.score = 0;
  state.lives = 3;
  state.running = true;
  state.bullets = [];
  state.enemies = [];
  state.enemyCooldown = 0;
  state.player = new Tank({
    x: canvas.width / 2 - 17,
    y: canvas.height - 70,
    color: "#265c7c",
    direction: "up",
    speed: 180,
    isPlayer: true,
  });
  buildWalls();
  spawnEnemy();
  spawnEnemy();
  spawnEnemy();
  hideOverlay();
  syncStats();
}

function spawnEnemy() {
  const spawnPoints = [80, canvas.width / 2 - 17, canvas.width - 120];
  const x = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
  const overlap = state.enemies.some((enemy) => Math.abs(enemy.x - x) < 45 && enemy.y < 80);
  if (overlap) {
    return;
  }
  state.enemies.push(
    new Tank({
      x,
      y: 36,
      color: "#b9412f",
      direction: "down",
      speed: 110,
    })
  );
}

function syncStats() {
  scoreEl.textContent = String(state.score);
  livesEl.textContent = String(state.lives);
  enemiesEl.textContent = String(state.enemies.length);
}

function showOverlay(title, text) {
  overlayTitleEl.textContent = title;
  overlayTextEl.textContent = text;
  overlayEl.classList.remove("hidden");
}

function hideOverlay() {
  overlayEl.classList.add("hidden");
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function canMove(tank, nextX, nextY) {
  const nextRect = { x: nextX, y: nextY, w: tank.size, h: tank.size };

  if (nextRect.x < 0 || nextRect.y < 0 || nextRect.x + nextRect.w > canvas.width || nextRect.y + nextRect.h > canvas.height) {
    return false;
  }

  for (const wall of walls) {
    if (rectsOverlap(nextRect, wall)) {
      return false;
    }
  }

  const others = tank.isPlayer ? state.enemies : [state.player, ...state.enemies.filter((enemy) => enemy !== tank)];
  for (const other of others) {
    if (other && rectsOverlap(nextRect, other.rect)) {
      return false;
    }
  }

  return true;
}

function shoot(tank) {
  if (tank.reload > 0) {
    return;
  }

  const half = tank.size / 2;
  const bullet = new Bullet({
    x: tank.x + half,
    y: tank.y + half,
    direction: tank.direction,
    speed: tank.isPlayer ? 360 : 240,
    owner: tank,
  });

  if (tank.direction === "up") {
    bullet.y = tank.y;
  } else if (tank.direction === "down") {
    bullet.y = tank.y + tank.size;
  } else if (tank.direction === "left") {
    bullet.x = tank.x;
  } else {
    bullet.x = tank.x + tank.size;
  }

  state.bullets.push(bullet);
  tank.reload = tank.isPlayer ? 0.32 : 0.9 + Math.random() * 0.6;
}

function updatePlayer(dt) {
  const player = state.player;
  if (!player) {
    return;
  }

  let dx = 0;
  let dy = 0;

  if (keys.has("ArrowUp")) {
    dy -= player.speed * dt;
    player.direction = "up";
  } else if (keys.has("ArrowDown")) {
    dy += player.speed * dt;
    player.direction = "down";
  } else if (keys.has("ArrowLeft")) {
    dx -= player.speed * dt;
    player.direction = "left";
  } else if (keys.has("ArrowRight")) {
    dx += player.speed * dt;
    player.direction = "right";
  }

  if (dx !== 0 || dy !== 0) {
    const nextX = player.x + dx;
    const nextY = player.y + dy;
    if (canMove(player, nextX, nextY)) {
      player.x = nextX;
      player.y = nextY;
    }
  }

  if (keys.has("Space")) {
    shoot(player);
  }
}

function updateEnemies(dt) {
  for (const enemy of state.enemies) {
    enemy.reload = Math.max(0, enemy.reload - dt);

    if (Math.random() < 0.015) {
      enemy.direction = ["up", "down", "left", "right"][Math.floor(Math.random() * 4)];
    }

    let dx = 0;
    let dy = 0;
    if (enemy.direction === "up") dy = -enemy.speed * dt;
    if (enemy.direction === "down") dy = enemy.speed * dt;
    if (enemy.direction === "left") dx = -enemy.speed * dt;
    if (enemy.direction === "right") dx = enemy.speed * dt;

    const nextX = enemy.x + dx;
    const nextY = enemy.y + dy;
    if (canMove(enemy, nextX, nextY)) {
      enemy.x = nextX;
      enemy.y = nextY;
    } else {
      enemy.direction = ["up", "down", "left", "right"][Math.floor(Math.random() * 4)];
    }

    const player = state.player;
    if (player) {
      const alignedX = Math.abs(player.x - enemy.x) < 18;
      const alignedY = Math.abs(player.y - enemy.y) < 18;
      if (alignedX) {
        enemy.direction = player.y < enemy.y ? "up" : "down";
      } else if (alignedY) {
        enemy.direction = player.x < enemy.x ? "left" : "right";
      }
    }

    if (Math.random() < 0.02) {
      shoot(enemy);
    }
  }

  state.enemyCooldown -= dt;
  if (state.enemyCooldown <= 0 && state.enemies.length < 6) {
    spawnEnemy();
    state.enemyCooldown = 2.5;
  }
}

function damageWall(wall) {
  if (wall.type === "steel") {
    return false;
  }
  wall.hp -= 1;
  if (wall.hp <= 0) {
    const index = walls.indexOf(wall);
    if (index >= 0) {
      walls.splice(index, 1);
    }
  }
  return true;
}

function hitTank(tank) {
  if (tank.isPlayer) {
    state.lives -= 1;
    if (state.lives <= 0) {
      state.player = null;
      state.running = false;
      showOverlay("游戏结束", "按 R 重新开始");
    } else {
      state.player.x = canvas.width / 2 - 17;
      state.player.y = canvas.height - 70;
      state.player.direction = "up";
    }
  } else {
    const index = state.enemies.indexOf(tank);
    if (index >= 0) {
      state.enemies.splice(index, 1);
      state.score += 100;
    }
  }
  syncStats();
}

function updateBullets(dt) {
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = state.bullets[i];

    if (bullet.direction === "up") bullet.y -= bullet.speed * dt;
    if (bullet.direction === "down") bullet.y += bullet.speed * dt;
    if (bullet.direction === "left") bullet.x -= bullet.speed * dt;
    if (bullet.direction === "right") bullet.x += bullet.speed * dt;

    if (bullet.x < 0 || bullet.y < 0 || bullet.x > canvas.width || bullet.y > canvas.height) {
      state.bullets.splice(i, 1);
      continue;
    }

    let removed = false;
    for (const wall of walls) {
      if (bullet.x > wall.x && bullet.x < wall.x + wall.w && bullet.y > wall.y && bullet.y < wall.y + wall.h) {
        damageWall(wall);
        state.bullets.splice(i, 1);
        removed = true;
        break;
      }
    }
    if (removed) {
      continue;
    }

    const targets = bullet.owner.isPlayer ? state.enemies : state.player ? [state.player] : [];
    for (const target of targets) {
      if (
        bullet.x > target.x &&
        bullet.x < target.x + target.size &&
        bullet.y > target.y &&
        bullet.y < target.y + target.size
      ) {
        hitTank(target);
        state.bullets.splice(i, 1);
        removed = true;
        break;
      }
    }
    if (removed) {
      continue;
    }
  }
}

function updateReloads(dt) {
  if (state.player) {
    state.player.reload = Math.max(0, state.player.reload - dt);
  }
}

function checkWinCondition() {
  if (state.score >= 1200 && state.running) {
    state.running = false;
    showOverlay("胜利", "你已经击退了这一波敌军，按 R 再来一局");
  }
}

function drawTank(tank) {
  ctx.save();
  ctx.translate(tank.x + tank.size / 2, tank.y + tank.size / 2);

  const angleMap = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };
  ctx.rotate(angleMap[tank.direction]);

  ctx.fillStyle = tank.color;
  ctx.fillRect(-tank.size / 2, -tank.size / 2, tank.size, tank.size);
  ctx.fillStyle = "#f4e6c9";
  ctx.fillRect(-6, -tank.size / 2 - 12, 12, 18);
  ctx.fillRect(-12, -8, 24, 16);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(-tank.size / 2 + 4, -tank.size / 2 + 4, tank.size - 8, 7);

  ctx.restore();
}

function drawWalls() {
  for (const wall of walls) {
    if (wall.type === "brick") {
      ctx.fillStyle = "#8c4f2f";
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      ctx.strokeStyle = "rgba(255, 220, 190, 0.25)";
      ctx.strokeRect(wall.x + 2, wall.y + 2, wall.w - 4, wall.h - 4);
    } else {
      ctx.fillStyle = "#75808b";
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.strokeRect(wall.x + 3, wall.y + 3, wall.w - 6, wall.h - 6);
    }
  }
}

function drawBullets() {
  ctx.fillStyle = "#f8f0d8";
  for (const bullet of state.bullets) {
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGrid() {
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  for (let x = 0; x <= canvas.width; x += TILE) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += TILE) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawWalls();
  if (state.player) {
    drawTank(state.player);
  }
  for (const enemy of state.enemies) {
    drawTank(enemy);
  }
  drawBullets();
}

function loop(timestamp) {
  const dt = Math.min((timestamp - state.lastTime) / 1000 || 0, 0.032);
  state.lastTime = timestamp;

  if (state.running) {
    updateReloads(dt);
    updatePlayer(dt);
    updateEnemies(dt);
    updateBullets(dt);
    syncStats();
    checkWinCondition();
  }

  render();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
    event.preventDefault();
    keys.add(event.code === "Space" ? "Space" : event.key);
  }

  if (event.key.toLowerCase() === "r") {
    resetGame();
  }
});

window.addEventListener("keyup", (event) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
    keys.delete(event.code === "Space" ? "Space" : event.key);
  }
});

resetGame();
requestAnimationFrame(loop);
