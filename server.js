/**
 * ✈️ AIRPLANE GAME SERVER
 * Kelompok Triple W - Multiplayer Backend
 * 
 * Deploy ke: Render, Railway, atau Heroku
 * Frontend deploy ke: Vercel (static)
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Serve static files (fallback untuk deploy monolith)
app.use(express.static(path.join(__dirname, 'public')));

// ═══════════════════════════════════════════════════
//  GAME STATE
// ═══════════════════════════════════════════════════

const rooms = new Map();        // roomId -> roomData
const players = new Map();      // socketId -> { roomId, playerData }

const ROOM_MAX_PLAYERS = 4;
const GAME_FPS = 60;
const TICK_RATE = 1000 / GAME_FPS;

// Enemy types
const ENEMY_TYPES = {
  BASIC:  { hp: 1, speed: 2.6, score: 10, color: '#cc2244', w: 36, h: 36 },
  FAST:   { hp: 1, speed: 4.5, score: 15, color: '#ffcc00', w: 30, h: 30 },
  TANK:   { hp: 3, speed: 1.8, score: 30, color: '#4488ff', w: 48, h: 48 },
  ZIGZAG: { hp: 2, speed: 3.2, score: 25, color: '#44ff88', w: 34, h: 34 },
};

function createRoom(roomId, hostName) {
  return {
    id: roomId,
    host: hostName,
    players: new Map(),      // socketId -> player
    enemies: [],
    bullets: [],
    powerups: [],
    particles: [],
    score: 0,
    highScore: 0,
    level: 1,
    lives: 3,
    maxLives: 3,
    gameState: 'waiting',    // waiting, playing, gameover
    frame: 0,
    enemySpawnRate: 36,
    enemySpeed: 2.6,
    difficulty: 1,
    spawnCooldown: 0,
    bossActive: false,
    boss: null,
    messages: [],            // chat history
    lastActivity: Date.now()
  };
}

function createPlayer(socketId, name, skin = 0) {
  return {
    id: socketId,
    name: name || 'Pilot',
    skin: skin,
    x: 400,
    y: 510,
    w: 70,
    h: 70,
    speed: 5.5,
    alive: true,
    invincible: false,
    invincibleTimer: 0,
    fireCooldown: 0,
    fireRate: 12,
    laserActive: false,
    laserTimer: 0,
    laserCooldown: 0,
    score: 0,
    combo: 0,
    comboTimer: 0,
    kills: 0
  };
}

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ═══════════════════════════════════════════════════
//  GAME LOOP
// ═══════════════════════════════════════════════════

function spawnEnemy(room) {
  const types = Object.keys(ENEMY_TYPES);
  const typeKey = types[Math.floor(Math.random() * types.length)];
  const template = ENEMY_TYPES[typeKey];

  const w = template.w + Math.random() * 10;
  const h = template.h + Math.random() * 10;
  const x = 30 + Math.random() * (800 - 60 - w);
  const y = -h - 10;
  const speed = template.speed + (Math.random() - 0.5) * 0.6 + (room.difficulty * 0.15);

  room.enemies.push({
    id: Math.random().toString(36).substring(2, 9),
    x, y, w, h,
    speed: Math.max(1.2, speed),
    hp: template.hp + Math.floor(room.difficulty / 4),
    maxHp: template.hp + Math.floor(room.difficulty / 4),
    type: typeKey,
    color: template.color,
    score: template.score,
    zigzagDir: Math.random() > 0.5 ? 1 : -1,
    zigzagTimer: 0
  });
}

function spawnBoss(room) {
  if (room.bossActive) return;
  room.bossActive = true;
  room.boss = {
    id: 'boss_' + Date.now(),
    x: 400,
    y: -100,
    w: 120,
    h: 100,
    speed: 1.2,
    hp: 20 + room.difficulty * 5,
    maxHp: 20 + room.difficulty * 5,
    color: '#ff0066',
    score: 200,
    phase: 0,
    timer: 0
  };
}

function spawnPowerUp(room) {
  const types = ['shield', 'rapid', 'bomb', 'speed'];
  const type = types[Math.floor(Math.random() * types.length)];
  room.powerups.push({
    id: Math.random().toString(36).substring(2, 9),
    x: 40 + Math.random() * 720,
    y: -30,
    w: 30,
    h: 30,
    type: type,
    speed: 1.5,
    life: 600
  });
}

function rectCollide(a, b) {
  return a.x - a.w/2 < b.x + b.w/2 &&
         a.x + a.w/2 > b.x - b.w/2 &&
         a.y - a.h/2 < b.y + b.h/2 &&
         a.y + a.h/2 > b.y - b.h/2;
}

function updateRoom(room) {
  if (room.gameState !== 'playing') return;

  room.frame++;
  room.lastActivity = Date.now();

  const alivePlayers = Array.from(room.players.values()).filter(p => p.alive);
  if (alivePlayers.length === 0) {
    room.gameState = 'gameover';
    broadcastRoomState(room);
    return;
  }

  // Update players
  room.players.forEach(p => {
    if (!p.alive) return;

    if (p.invincible) {
      p.invincibleTimer--;
      if (p.invincibleTimer <= 0) p.invincible = false;
    }
    if (p.fireCooldown > 0) p.fireCooldown--;
    if (p.laserCooldown > 0) p.laserCooldown--;
    if (p.laserActive) {
      p.laserTimer--;
      if (p.laserTimer <= 0) {
        p.laserActive = false;
      }
    }
    if (p.comboTimer > 0) {
      p.comboTimer--;
      if (p.comboTimer <= 0) p.combo = 0;
    }

    // Clamp position
    p.x = Math.max(p.w/2 + 6, Math.min(800 - p.w/2 - 6, p.x));
    p.y = Math.max(p.h/2 + 6, Math.min(600 - p.h/2 - 6, p.y));
  });

  // Spawn enemies
  if (room.spawnCooldown > 0) {
    room.spawnCooldown--;
  } else {
    const rate = Math.max(12, room.enemySpawnRate - room.difficulty * 1.2);
    if (room.frame % Math.floor(rate) === 0) {
      spawnEnemy(room);
      if (room.difficulty > 3 && Math.random() < 0.3) spawnEnemy(room);
      if (room.difficulty > 6 && Math.random() < 0.15) spawnEnemy(room);
    }
  }

  // Boss spawn
  if (room.score > 0 && room.score % 500 < 50 && room.score > room.difficulty * 400 && !room.bossActive) {
    spawnBoss(room);
  }

  // Power-up spawn
  if (room.frame % 400 === 0 && Math.random() < 0.4) {
    spawnPowerUp(room);
  }

  // Update bullets
  for (let i = room.bullets.length - 1; i >= 0; i--) {
    const b = room.bullets[i];
    b.y -= b.speed;
    if (b.y < -20) {
      room.bullets.splice(i, 1);
    }
  }

  // Update enemies
  for (let i = room.enemies.length - 1; i >= 0; i--) {
    const e = room.enemies[i];
    e.y += e.speed;

    // Zigzag movement
    if (e.type === 'ZIGZAG') {
      e.zigzagTimer++;
      e.x += Math.sin(e.zigzagTimer * 0.05) * 2 * e.zigzagDir;
      e.x = Math.max(e.w/2, Math.min(800 - e.w/2, e.x));
    }

    if (e.y > 650) {
      room.enemies.splice(i, 1);
      room.score += 5;
      continue;
    }

    // Collision with players
    alivePlayers.forEach(p => {
      if (p.invincible) return;
      if (rectCollide(p, e)) {
        room.enemies.splice(i, 1);
        hitPlayer(room, p);
      }
    });

    // Collision with bullets
    for (let j = room.bullets.length - 1; j >= 0; j--) {
      const b = room.bullets[j];
      if (rectCollide(b, e)) {
        e.hp--;
        room.bullets.splice(j, 1);
        if (e.hp <= 0) {
          room.enemies.splice(i, 1);
          const shooter = room.players.get(b.playerId);
          if (shooter) {
            shooter.combo++;
            shooter.comboTimer = 120;
            const comboBonus = Math.min(shooter.combo * 2, 20);
            shooter.score += e.score + comboBonus;
            shooter.kills++;
          }
          room.score += e.score;
        }
        break;
      }
    }
  }

  // Update boss
  if (room.bossActive && room.boss) {
    const b = room.boss;
    b.timer++;
    b.y = Math.min(b.y + b.speed, 150);
    b.x += Math.sin(b.timer * 0.02) * 2;
    b.x = Math.max(b.w/2, Math.min(800 - b.w/2, b.x));

    alivePlayers.forEach(p => {
      if (p.invincible) return;
      if (rectCollide(p, b)) {
        hitPlayer(room, p);
      }
    });

    for (let j = room.bullets.length - 1; j >= 0; j--) {
      const bullet = room.bullets[j];
      if (rectCollide(bullet, b)) {
        b.hp--;
        room.bullets.splice(j, 1);
        if (b.hp <= 0) {
          room.bossActive = false;
          room.boss = null;
          room.score += b.score;
          const shooter = room.players.get(bullet.playerId);
          if (shooter) {
            shooter.score += b.score;
            shooter.kills++;
          }
        }
        break;
      }
    }

    if (b.y > 650) {
      room.bossActive = false;
      room.boss = null;
    }
  }

  // Laser collision
  alivePlayers.forEach(p => {
    if (!p.laserActive) return;
    const beamX = p.x;
    const beamY = p.y - p.h/2 - 4;
    const beamWidth = 16;

    for (let i = room.enemies.length - 1; i >= 0; i--) {
      const e = room.enemies[i];
      if (e.x > beamX - beamWidth/2 && e.x < beamX + beamWidth/2) {
        if (e.y + e.h/2 > beamY - 500 && e.y - e.h/2 < beamY) {
          e.hp--;
          if (e.hp <= 0) {
            room.enemies.splice(i, 1);
            p.combo++;
            p.comboTimer = 120;
            const comboBonus = Math.min(p.combo * 2, 20);
            p.score += e.score + comboBonus;
            p.kills++;
            room.score += e.score;
          }
        }
      }
    }

    if (room.bossActive && room.boss) {
      const b = room.boss;
      if (b.x > beamX - beamWidth/2 && b.x < beamX + beamWidth/2) {
        if (b.y + b.h/2 > beamY - 500 && b.y - b.h/2 < beamY) {
          b.hp -= 0.2;
          if (b.hp <= 0) {
            room.bossActive = false;
            p.score += b.score;
            room.score += b.score;
            room.boss = null;
          }
        }
      }
    }
  });

  // Update power-ups
  for (let i = room.powerups.length - 1; i >= 0; i--) {
    const pu = room.powerups[i];
    pu.y += pu.speed;
    pu.life--;

    if (pu.life <= 0 || pu.y > 650) {
      room.powerups.splice(i, 1);
      continue;
    }

    alivePlayers.forEach(p => {
      if (rectCollide(p, pu)) {
        applyPowerUp(p, pu.type);
        room.powerups.splice(i, 1);
        io.to(room.id).emit('powerup_collected', { playerId: p.id, type: pu.type, x: pu.x, y: pu.y });
      }
    });
  }

  // Difficulty
  room.difficulty = 1 + Math.floor(room.score / 150);
  room.enemySpeed = Math.min(6.5, 2.6 + room.difficulty * 0.25);

  // Check game over
  const anyAlive = Array.from(room.players.values()).some(p => p.alive);
  if (!anyAlive && room.gameState === 'playing') {
    room.gameState = 'gameover';
  }

  broadcastRoomState(room);
}

function hitPlayer(room, player) {
  if (player.invincible || !player.alive) return;

  room.lives--;
  player.alive = false;
  player.combo = 0;

  io.to(room.id).emit('player_hit', { playerId: player.id, lives: room.lives });

  if (room.lives <= 0) {
    room.gameState = 'gameover';
    return;
  }

  // Respawn after delay
  setTimeout(() => {
    if (room.players.has(player.id) && room.gameState === 'playing') {
      player.alive = true;
      player.x = 400;
      player.y = 510;
      player.invincible = true;
      player.invincibleTimer = 90;
      io.to(room.id).emit('player_respawn', { playerId: player.id, x: player.x, y: player.y });
    }
  }, 1500);
}

function applyPowerUp(player, type) {
  switch(type) {
    case 'shield':
      player.invincible = true;
      player.invincibleTimer = 300;
      break;
    case 'rapid':
      player.fireRate = 4;
      setTimeout(() => { player.fireRate = 12; }, 5000);
      break;
    case 'speed':
      player.speed = 9;
      setTimeout(() => { player.speed = 5.5; }, 5000);
      break;
    case 'bomb':
      // Handled client-side or server broadcast
      break;
  }
}

function broadcastRoomState(room) {
  const state = {
    players: Array.from(room.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      skin: p.skin,
      x: p.x,
      y: p.y,
      alive: p.alive,
      invincible: p.invincible,
      laserActive: p.laserActive,
      score: p.score,
      combo: p.combo,
      kills: p.kills
    })),
    enemies: room.enemies,
    bullets: room.bullets,
    powerups: room.powerups,
    boss: room.boss,
    bossActive: room.bossActive,
    score: room.score,
    level: room.difficulty,
    lives: room.lives,
    gameState: room.gameState,
    frame: room.frame
  };
  io.to(room.id).emit('game_state', state);
}

// ═══════════════════════════════════════════════════
//  SOCKET.IO HANDLERS
// ═══════════════════════════════════════════════════

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // Create Room
  socket.on('create_room', ({ playerName, skin }) => {
    const roomId = generateRoomId();
    const room = createRoom(roomId, playerName);
    const player = createPlayer(socket.id, playerName, skin);

    room.players.set(socket.id, player);
    rooms.set(roomId, room);

    socket.join(roomId);
    players.set(socket.id, { roomId, player });

    socket.emit('room_created', { roomId, playerId: socket.id });
    broadcastLobby(room);
  });

  // Join Room
  socket.on('join_room', ({ roomId, playerName, skin }) => {
    const room = rooms.get(roomId.toUpperCase());
    if (!room) {
      socket.emit('error', { message: 'Room tidak ditemukan!' });
      return;
    }
    if (room.gameState !== 'waiting') {
      socket.emit('error', { message: 'Game sudah dimulai!' });
      return;
    }
    if (room.players.size >= ROOM_MAX_PLAYERS) {
      socket.emit('error', { message: 'Room penuh! (Max 4 pemain)' });
      return;
    }

    const player = createPlayer(socket.id, playerName, skin);
    // Spread spawn positions
    const idx = room.players.size;
    player.x = 200 + idx * 150;

    room.players.set(socket.id, player);
    socket.join(roomId);
    players.set(socket.id, { roomId, player });

    socket.emit('room_joined', { roomId, playerId: socket.id });
    broadcastLobby(room);

    socket.to(roomId).emit('player_joined', {
      id: socket.id,
      name: playerName,
      skin: skin
    });
  });

  // Start Game
  socket.on('start_game', () => {
    const data = players.get(socket.id);
    if (!data) return;
    const room = rooms.get(data.roomId);
    if (!room || room.host !== data.player.name) return;

    room.gameState = 'playing';
    room.lives = room.players.size * 3; // 3 lives per player
    room.maxLives = room.lives;
    room.spawnCooldown = 30;

    io.to(room.id).emit('game_started', {
      lives: room.lives,
      playerCount: room.players.size
    });

    // Start game loop for this room
    if (!room.loopInterval) {
      room.loopInterval = setInterval(() => updateRoom(room), TICK_RATE);
    }
  });

  // Player Input
  socket.on('player_input', (input) => {
    const data = players.get(socket.id);
    if (!data) return;
    const room = rooms.get(data.roomId);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (!player || !player.alive) return;

    if (input.left) player.x -= player.speed;
    if (input.right) player.x += player.speed;
    if (input.up) player.y -= player.speed;
    if (input.down) player.y += player.speed;

    if (input.fire && player.fireCooldown === 0) {
      room.bullets.push({
        id: Math.random().toString(36).substring(2, 9),
        x: player.x,
        y: player.y - player.h/2 - 6,
        w: 6,
        h: 16,
        speed: 8,
        playerId: socket.id
      });
      player.fireCooldown = player.fireRate;
    }

    if (input.laser && player.laserCooldown === 0 && !player.laserActive) {
      player.laserActive = true;
      player.laserTimer = 25;
      player.laserCooldown = 35;
    }

    if (input.bomb) {
      // Destroy all enemies on screen
      room.enemies = [];
      if (room.bossActive && room.boss) {
        room.boss.hp -= 5;
      }
      io.to(room.id).emit('bomb_used', { playerId: socket.id });
    }
  });

  // Chat
  socket.on('chat_message', (message) => {
    const data = players.get(socket.id);
    if (!data) return;
    const room = rooms.get(data.roomId);
    if (!room) return;

    const chatData = {
      id: Math.random().toString(36).substring(2, 9),
      playerId: socket.id,
      name: data.player.name,
      message: message.substring(0, 100),
      time: Date.now()
    };
    room.messages.push(chatData);
    if (room.messages.length > 50) room.messages.shift();

    io.to(room.id).emit('chat_message', chatData);
  });

  // Restart Game
  socket.on('restart_game', () => {
    const data = players.get(socket.id);
    if (!data) return;
    const room = rooms.get(data.roomId);
    if (!room) return;

    room.enemies = [];
    room.bullets = [];
    room.powerups = [];
    room.boss = null;
    room.bossActive = false;
    room.score = 0;
    room.difficulty = 1;
    room.frame = 0;
    room.gameState = 'playing';
    room.lives = room.players.size * 3;
    room.spawnCooldown = 30;

    room.players.forEach(p => {
      p.alive = true;
      p.x = 400;
      p.y = 510;
      p.score = 0;
      p.combo = 0;
      p.kills = 0;
      p.invincible = true;
      p.invincibleTimer = 90;
    });

    io.to(room.id).emit('game_restarted', { lives: room.lives });
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    const data = players.get(socket.id);
    if (data) {
      const room = rooms.get(data.roomId);
      if (room) {
        room.players.delete(socket.id);
        socket.to(room.id).emit('player_left', { playerId: socket.id });

        if (room.players.size === 0) {
          if (room.loopInterval) clearInterval(room.loopInterval);
          rooms.delete(data.roomId);
        } else {
          broadcastLobby(room);
        }
      }
    }
    players.delete(socket.id);
  });
});

function broadcastLobby(room) {
  const lobby = Array.from(room.players.values()).map(p => ({
    id: p.id,
    name: p.name,
    skin: p.skin,
    ready: true
  }));
  io.to(room.id).emit('lobby_update', { players: lobby, host: room.host });
}

// Cleanup inactive rooms
setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of rooms) {
    if (now - room.lastActivity > 30 * 60 * 1000) { // 30 minutes
      if (room.loopInterval) clearInterval(room.loopInterval);
      rooms.delete(roomId);
      console.log('Cleaned up inactive room:', roomId);
    }
  }
}, 5 * 60 * 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Airplane Game Server running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
});
