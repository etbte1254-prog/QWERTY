"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const world = { w: 1800, h: 1000 };
const camera = { x: 0, y: 0 };
const keys = Object.create(null);
const pointer = { down: false, x: 0, y: 0 };

const player = {
  x: world.w / 2, y: world.h / 2, r: 22, angle: 0,
  speed: 290, hp: 100, maxHp: 100, mp: 60, maxMp: 60,
  level: 1, xp: 0, nextXp: 100, gold: 0,
  attackCooldown: 0, skillCooldown: 0, invulnerable: 0,
  potions: 3
};

let enemies = [];
let projectiles = [];
let particles = [];
let texts = [];
let last = performance.now();
let gameTime = 0;
let spawnTimer = 0;
let shake = 0;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  canvas.style.width = innerWidth + "px";
  canvas.style.height = innerHeight + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);
resize();

addEventListener("keydown", e => { keys[e.key.toLowerCase()] = true; if (e.code === "Space") e.preventDefault(); });
addEventListener("keyup", e => { keys[e.key.toLowerCase()] = false; });
canvas.addEventListener("pointerdown", e => {
  pointer.down = true;
  updatePointer(e);
});
addEventListener("pointermove", updatePointer);
addEventListener("pointerup", () => pointer.down = false);

function updatePointer(e) {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
}

function spawnEnemy() {
  const side = Math.floor(Math.random() * 4);
  let x, y;
  if (side === 0) { x = camera.x - 60; y = camera.y + Math.random() * innerHeight; }
  if (side === 1) { x = camera.x + innerWidth + 60; y = camera.y + Math.random() * innerHeight; }
  if (side === 2) { x = camera.x + Math.random() * innerWidth; y = camera.y - 60; }
  if (side === 3) { x = camera.x + Math.random() * innerWidth; y = camera.y + innerHeight + 60; }
  x = Math.max(30, Math.min(world.w - 30, x));
  y = Math.max(30, Math.min(world.h - 30, y));
  const elite = enemies.length > 4 && Math.random() < 0.12;
  const hp = elite ? 95 + player.level * 12 : 35 + player.level * 6;
  enemies.push({ x, y, r: elite ? 31 : 20, hp, maxHp: hp, speed: elite ? 72 : 88 + Math.random() * 25, damage: elite ? 18 : 8 + player.level * 1.5, cooldown: 0, elite, angle: 0 });
}

for (let i = 0; i < 6; i++) spawnEnemy();

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function attack() {
  if (player.attackCooldown > 0) return;
  player.attackCooldown = 0.22;
  const sx = Math.cos(player.angle), sy = Math.sin(player.angle);
  projectiles.push({ x: player.x + sx * 30, y: player.y + sy * 30, vx: sx * 620, vy: sy * 620, r: 7, life: 0.75, damage: 18 + player.level * 3, friendly: true, color: "#ffe889" });
  for (let i = 0; i < 5; i++) particles.push({ x: player.x + sx * 32, y: player.y + sy * 32, vx: sx * (150 + i * 20) + (Math.random() - .5) * 90, vy: sy * (150 + i * 20) + (Math.random() - .5) * 90, life: .18, maxLife: .18, color: "#fff4a8", r: 3 });
}

function skill() {
  if (player.skillCooldown > 0 || player.mp < 22) return;
  player.mp -= 22;
  player.skillCooldown = 4;
  shake = 8;
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2;
    projectiles.push({ x: player.x, y: player.y, vx: Math.cos(a) * 390, vy: Math.sin(a) * 390, r: 9, life: 1.1, damage: 28 + player.level * 5, friendly: true, color: "#69d8ff" });
  }
}

function usePotion() {
  if (player.potions <= 0 || player.hp >= player.maxHp) return;
  player.potions--;
  player.hp = Math.min(player.maxHp, player.hp + 42);
  texts.push({ x: player.x, y: player.y - 40, text: "+물약", life: 1, color: "#77ff9d" });
}

function gainXp(amount) {
  player.xp += amount;
  if (player.xp >= player.nextXp) {
    player.xp -= player.nextXp;
    player.nextXp = Math.floor(player.nextXp * 1.28);
    player.level++;
    player.maxHp += 15;
    player.maxMp += 8;
    player.hp = player.maxHp;
    player.mp = player.maxMp;
    player.potions = Math.min(9, player.potions + 1);
    texts.push({ x: player.x, y: player.y - 55, text: `레벨 ${player.level}!`, life: 1.8, color: "#ffe66d" });
  }
}

function update(dt) {
  gameTime += dt;
  player.attackCooldown -= dt;
  player.skillCooldown -= dt;
  player.invulnerable -= dt;
  player.mp = Math.min(player.maxMp, player.mp + 5 * dt);
  shake *= 0.86;

  let dx = 0, dy = 0;
  if (keys.w || keys.arrowup) dy--;
  if (keys.s || keys.arrowdown) dy++;
  if (keys.a || keys.arrowleft) dx--;
  if (keys.d || keys.arrowright) dx++;
  if (dx || dy) {
    const l = Math.hypot(dx, dy);
    dx /= l; dy /= l;
    player.x = clamp(player.x + dx * player.speed * dt, 25, world.w - 25);
    player.y = clamp(player.y + dy * player.speed * dt, 25, world.h - 25);
  }

  const mx = pointer.x + camera.x, my = pointer.y + camera.y;
  player.angle = Math.atan2(my - player.y, mx - player.x);
  if (pointer.down) attack();
  if (keys[" "]) attack();
  if (keys.q) skill();
  if (keys.e) usePotion();

  spawnTimer -= dt;
  if (spawnTimer <= 0 && enemies.length < 10 + player.level) {
    spawnEnemy();
    spawnTimer = Math.max(0.5, 2.1 - player.level * .08);
  }

  for (const p of projectiles) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
  }

  for (const e of enemies) {
    e.cooldown -= dt;
    const a = Math.atan2(player.y - e.y, player.x - e.x);
    e.angle = a;
    e.x += Math.cos(a) * e.speed * dt;
    e.y += Math.sin(a) * e.speed * dt;
    if (dist(e, player) < e.r + player.r && e.cooldown <= 0 && player.invulnerable <= 0) {
      e.cooldown = 0.85;
      player.hp -= e.damage;
      player.invulnerable = 0.55;
      shake = 12;
      texts.push({ x: player.x, y: player.y - 38, text: `-${Math.round(e.damage)}`, life: .8, color: "#ff7272" });
      if (player.hp <= 0) {
        player.hp = player.maxHp;
        player.x = world.w / 2; player.y = world.h / 2;
        player.gold = Math.max(0, player.gold - 10);
        texts.push({ x: player.x, y: player.y - 55, text: "마을로 돌아왔어요", life: 2, color: "#fff" });
      }
    }
  }

  for (const p of projectiles) {
    if (!p.friendly) continue;
    for (const e of enemies) {
      if (p.life > 0 && dist(p, e) < p.r + e.r) {
        e.hp -= p.damage;
        p.life = 0;
        for (let i = 0; i < 7; i++) particles.push({ x: e.x, y: e.y, vx: (Math.random() - .5) * 180, vy: (Math.random() - .5) * 180, life: .35, maxLife: .35, color: e.elite ? "#bf82ff" : "#ff9d78", r: 3 + Math.random() * 3 });
      }
    }
  }

  const dead = enemies.filter(e => e.hp <= 0);
  for (const e of dead) {
    gainXp(e.elite ? 32 : 18);
    player.gold += e.elite ? 12 : 5;
    for (let i = 0; i < 14; i++) particles.push({ x: e.x, y: e.y, vx: (Math.random() - .5) * 220, vy: (Math.random() - .5) * 220, life: .55, maxLife: .55, color: e.elite ? "#d3a5ff" : "#8ee8a0", r: 3 + Math.random() * 4 });
  }
  enemies = enemies.filter(e => e.hp > 0);

  projectiles = projectiles.filter(p => p.life > 0);
  particles = particles.filter(p => (p.life -= dt) > 0);
  texts = texts.filter(t => (t.life -= dt) > 0);

  camera.x = clamp(player.x - innerWidth / 2, 0, Math.max(0, world.w - innerWidth));
  camera.y = clamp(player.y - innerHeight / 2, 0, Math.max(0, world.h - innerHeight));
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
}

function drawWorld() {
  ctx.fillStyle = "#8bcf72"; ctx.fillRect(0, 0, world.w, world.h);
  ctx.fillStyle = "#76bc62";
  for (let y = 0; y < world.h; y += 80) for (let x = (y / 80 % 2) * 40; x < world.w; x += 80) {
    ctx.beginPath(); ctx.arc(x, y, 23, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = "#5fa758";
  for (let i = 0; i < 70; i++) {
    const x = (i * 197 + 83) % world.w, y = (i * 131 + 49) % world.h;
    ctx.beginPath(); ctx.arc(x, y, 5 + (i % 4), 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = "#745d43";
  ctx.fillRect(world.w / 2 - 100, world.h / 2 - 36, 200, 72);
  ctx.fillStyle = "#9f8054";
  ctx.beginPath(); ctx.moveTo(world.w / 2 - 130, world.h / 2 - 36); ctx.lineTo(world.w / 2, world.h / 2 - 105); ctx.lineTo(world.w / 2 + 130, world.h / 2 - 36); ctx.closePath(); ctx.fill();
}

function drawPlayer() {
  ctx.save(); ctx.translate(player.x, player.y); ctx.rotate(player.angle);
  ctx.fillStyle = "#d18d55"; ctx.beginPath(); ctx.arc(0, -5, 19, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#55476d"; ctx.beginPath(); ctx.moveTo(-21, 6); ctx.quadraticCurveTo(0, 25, 21, 6); ctx.lineTo(14, 30); ctx.lineTo(-14, 30); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(9, -8, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#695238"; ctx.beginPath(); ctx.arc(-2, -16, 20, Math.PI, 0); ctx.lineTo(18, -5); ctx.lineTo(-18, -5); ctx.fill();
  ctx.fillStyle = "#8a6542"; ctx.fillRect(18, -2, 24, 7);
  ctx.restore();
  ctx.fillStyle = "#263b54"; ctx.beginPath(); ctx.ellipse(player.x, player.y + 29, 24, 7, 0, 0, Math.PI * 2); ctx.fill();
}

function drawEnemy(e) {
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.angle);
  ctx.fillStyle = e.elite ? "#7860a8" : "#7d9b52";
  ctx.beginPath(); ctx.ellipse(0, 0, e.r, e.r * .85, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = e.elite ? "#c6a2ff" : "#bddb72";
  ctx.beginPath(); ctx.moveTo(-e.r * .7, -e.r * .5); ctx.lineTo(-e.r * .3, -e.r * 1.25); ctx.lineTo(0, -e.r * .55); ctx.lineTo(e.r * .65, -e.r * 1.18); ctx.lineTo(e.r * .7, -e.r * .45); ctx.fill();
  ctx.fillStyle = "#24253b"; ctx.beginPath(); ctx.arc(7, -3, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#422f32"; ctx.fillRect(e.x - e.r, e.y - e.r - 12, e.r * 2, 5);
  ctx.fillStyle = "#ea6a62"; ctx.fillRect(e.x - e.r, e.y - e.r - 12, e.r * 2 * Math.max(0, e.hp / e.maxHp), 5);
}

function draw() {
  ctx.save();
  ctx.translate(-camera.x + (Math.random() - .5) * shake, -camera.y + (Math.random() - .5) * shake);
  drawWorld();
  for (const e of enemies) drawEnemy(e);
  drawPlayer();
  for (const p of projectiles) { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
  for (const p of particles) { ctx.globalAlpha = p.life / p.maxLife; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
  ctx.textAlign = "center"; ctx.font = "bold 18px sans-serif";
  for (const t of texts) { ctx.globalAlpha = clamp(t.life, 0, 1); ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y); }
  ctx.globalAlpha = 1;
  ctx.restore();

  drawUI();
}

function drawUI() {
  const w = innerWidth, h = innerHeight;
  ctx.fillStyle = "rgba(27,35,55,.92)"; roundRect(16, 16, 230, 84, 14);
  ctx.fillStyle = "#fff"; ctx.font = "bold 16px sans-serif"; ctx.textAlign = "left"; ctx.fillText(`Lv.${player.level} 별빛 모험가`, 30, 42);
  ctx.fillStyle = "#412d36"; ctx.fillRect(30, 52, 202, 12); ctx.fillStyle = "#ef6b78"; ctx.fillRect(30, 52, 202 * player.hp / player.maxHp, 12);
  ctx.fillStyle = "#2d3a57"; ctx.fillRect(30, 68, 202, 10); ctx.fillStyle = "#61baf2"; ctx.fillRect(30, 68, 202 * player.mp / player.maxMp, 10);
  ctx.fillStyle = "#ffe78a"; ctx.font = "15px sans-serif"; ctx.fillText(`XP ${player.xp}/${player.nextXp}`, 30, 92);
  ctx.fillStyle = "rgba(27,35,55,.92)"; roundRect(w - 170, 16, 154, 46, 14); ctx.fillStyle = "#ffd76b"; ctx.font = "bold 16px sans-serif"; ctx.fillText(`◆ ${player.gold}`, w - 152, 46);

  ctx.textAlign = "center";
  if (innerWidth < 900) {
    ctx.fillStyle = "rgba(255,255,255,.14)"; ctx.beginPath(); ctx.arc(90, h - 90, 55, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.28)"; ctx.beginPath(); ctx.arc(w - 95, h - 95, 48, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 18px sans-serif"; ctx.fillText("공격", w - 95, h - 89);
  }

  ctx.fillStyle = "rgba(27,35,55,.92)"; roundRect(w - 260, h - 68, 74, 52, 12);
  ctx.fillStyle = "#75d7ff"; ctx.font = "bold 14px sans-serif"; ctx.fillText("Q 별빛", w - 223, h - 38);
  ctx.fillStyle = "rgba(27,35,55,.92)"; roundRect(w - 178, h - 68, 74, 52, 12);
  ctx.fillStyle = "#77ff9d"; ctx.fillText(`E 물약 ${player.potions}`, w - 141, h - 38);

  if (player.skillCooldown > 0) {
    ctx.fillStyle = "rgba(20,24,38,.72)"; ctx.beginPath(); ctx.arc(w - 223, h - 42, 24, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.fillText(player.skillCooldown.toFixed(1), w - 223, h - 36);
  }
}

function loop(now) {
  const dt = Math.min(.033, (now - last) / 1000); last = now;
  update(dt); draw(); requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
