const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');

const WIDTH = 960;
const HEIGHT = 540;
canvas.width = WIDTH;
canvas.height = HEIGHT;

let score = 0;
let lives = 3;
let currentLevel = 1;
const totalLevels = 5;

let started = false; // becomes true after first player input so deaths don't happen before play

const keys = {left:false,right:false,up:false,down:false,jump:false};

let scorePopTimeout = null;
let retryPressed = false;
let advancingLevel = false; // flag to prevent advancing twice
// Camera for smooth following
let cam = {x:0,y:0};
let camTarget = {x:0,y:0};
const CAM_LERP = 0.12;
// Particles for pickups
let particles = [];

// Transition state for level fades
let transition = {state:'none', alpha:0, speed:0.06};

// Simple WebAudio for lightweight SFX
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
function ensureAudio(){ if(!audioCtx){ audioCtx = new AudioCtx(); }}

function playPop(){
  try{ ensureAudio(); const t = audioCtx.currentTime; const o = audioCtx.createOscillator(); const g = audioCtx.createGain(); o.type='sine'; o.frequency.setValueAtTime(880, t); o.frequency.exponentialRampToValueAtTime(1320, t+0.08); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.12,t+0.01); g.gain.exponentialRampToValueAtTime(0.0001,t+0.25); o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t+0.26);}catch(e){}
}

function playOuch(){
  try{ ensureAudio(); const t = audioCtx.currentTime; const o = audioCtx.createOscillator(); const g = audioCtx.createGain(); o.type='triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(120, t+0.18); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.18,t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+0.35); o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t+0.36);}catch(e){}
}

function playWhoosh(){
  try{ ensureAudio(); const t = audioCtx.currentTime; const b = audioCtx.createBufferSource(); const sr = audioCtx.sampleRate; const len = sr * 0.08; const buffer = audioCtx.createBuffer(1,len,sr); const data = buffer.getChannelData(0); for(let i=0;i<len;i++){ data[i] = (Math.random()*2-1) * (1 - i/len) * 0.25; } b.buffer = buffer; const g = audioCtx.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.12,t+0.01); g.gain.exponentialRampToValueAtTime(0.0001,t+0.08); b.connect(g); g.connect(audioCtx.destination); b.start(t); }catch(e){}
}

const player = {x:80,y:260,w:40,h:56,vx:0,vy:0,onGround:false,climbing:false,spawn:{x:80,y:380}};
// simple animation state
player.frame = 0; // 0..3
player.frameTimer = 0;

const gravity = 0.7;
const friction = 0.85;

// Level definitions (platforms, ladders, collectibles per level)
const levels = [
  // Level 1: Easy intro
  {
    platforms: [
      {x:0,y:500,w:960,h:40},
      {x:140,y:410,w:160,h:18},
      {x:340,y:330,w:140,h:18},
      {x:540,y:250,w:180,h:18},
      {x:780,y:180,w:120,h:18},
      {x:260,y:200,w:90,h:18}
    ],
    ladders: [
      {x:620,y:270,w:36,h:220},
      {x:270,y:220,w:28,h:100}
    ],
    collectibles: [
      {x:180,y:370,collected:false},
      {x:380,y:290,collected:false},
      {x:620,y:210,collected:false},
      {x:820,y:150,collected:false},
      {x:300,y:170,collected:false}
    ]
  },
  // Level 2: More platforms
  {
    platforms: [
      {x:0,y:500,w:960,h:40},
      {x:50,y:400,w:140,h:18},
      {x:220,y:340,w:120,h:18},
      {x:420,y:280,w:140,h:18},
      {x:650,y:320,w:150,h:18},
      {x:800,y:240,w:140,h:18},
      {x:400,y:200,w:100,h:18}
    ],
    ladders: [
      {x:350,y:300,w:36,h:180},
      {x:720,y:340,w:28,h:140}
    ],
    collectibles: [
      {x:110,y:360,collected:false},
      {x:280,y:300,collected:false},
      {x:490,y:240,collected:false},
      {x:730,y:280,collected:false},
      {x:850,y:200,collected:false},
      {x:450,y:160,collected:false}
    ]
  },
  // Level 3: Challenging gaps
  {
    platforms: [
      {x:0,y:500,w:960,h:40},
      {x:80,y:420,w:100,h:18},
      {x:230,y:360,w:100,h:18},
      {x:380,y:300,w:80,h:18},
      {x:520,y:250,w:100,h:18},
      {x:680,y:320,w:140,h:18},
      {x:820,y:220,w:100,h:18},
      {x:350,y:150,w:120,h:18}
    ],
    ladders: [
      {x:600,y:280,w:36,h:200},
      {x:150,y:380,w:28,h:100}
    ],
    collectibles: [
      {x:130,y:380,collected:false},
      {x:280,y:320,collected:false},
      {x:420,y:260,collected:false},
      {x:570,y:210,collected:false},
      {x:750,y:280,collected:false},
      {x:870,y:180,collected:false},
      {x:410,y:110,collected:false}
    ],
    enemies: [
      {x:450,y:250,speed:1.5,minY:120,maxY:280,dir:1}
    ]
  },
  // Level 4: Complex layout
  {
    platforms: [
      {x:0,y:500,w:960,h:40},
      {x:60,y:420,w:90,h:18},
      {x:200,y:380,w:80,h:18},
      {x:340,y:340,w:70,h:18},
      {x:490,y:300,w:80,h:18},
      {x:640,y:260,w:90,h:18},
      {x:780,y:200,w:100,h:18},
      {x:200,y:240,w:100,h:18},
      {x:500,y:180,w:80,h:18}
    ],
    ladders: [
      {x:750,y:280,w:36,h:190},
      {x:400,y:360,w:28,h:120},
      {x:250,y:300,w:28,h:80}
    ],
    collectibles: [
      {x:105,y:380,collected:false},
      {x:240,y:340,collected:false},
      {x:375,y:300,collected:false},
      {x:530,y:260,collected:false},
      {x:690,y:220,collected:false},
      {x:830,y:160,collected:false},
      {x:250,y:200,collected:false},
      {x:540,y:140,collected:false}
    ],
    enemies: [
      {x:300,y:250,speed:1.8,minY:150,maxY:350,dir:1},
      {x:700,y:300,speed:1.5,minY:200,maxY:380,dir:-1}
    ]
  },
  // Level 5: Expert challenge
  {
    platforms: [
      {x:0,y:500,w:960,h:40},
      {x:40,y:430,w:80,h:18},
      {x:170,y:380,w:70,h:18},
      {x:310,y:330,w:60,h:18},
      {x:450,y:280,w:70,h:18},
      {x:600,y:240,w:80,h:18},
      {x:750,y:190,w:70,h:18},
      {x:860,y:140,w:80,h:18},
      {x:250,y:260,w:60,h:18},
      {x:550,y:150,w:70,h:18}
    ],
    ladders: [
      {x:700,y:260,w:36,h:200},
      {x:400,y:340,w:28,h:120},
      {x:150,y:400,w:28,h:80}
    ],
    collectibles: [
      {x:80,y:390,collected:false},
      {x:205,y:340,collected:false},
      {x:340,y:290,collected:false},
      {x:485,y:240,collected:false},
      {x:640,y:200,collected:false},
      {x:785,y:150,collected:false},
      {x:900,y:100,collected:false},
      {x:280,y:220,collected:false},
      {x:585,y:110,collected:false}
    ],
    enemies: [
      {x:200,y:280,speed:2.0,minY:150,maxY:380,dir:1},
      {x:550,y:250,speed:1.7,minY:120,maxY:340,dir:1},
      {x:800,y:200,speed:1.9,minY:80,maxY:280,dir:-1}
    ]
  }
];

let platforms = [];
let ladders = [];
let collectibles = [];
let enemies = [];

let gameOver = false;
let isDeathScreen = false;

function loadLevel(levelNum){
  const levelData = levels[levelNum - 1];
  platforms = JSON.parse(JSON.stringify(levelData.platforms));
  ladders = JSON.parse(JSON.stringify(levelData.ladders));
  collectibles = JSON.parse(JSON.stringify(levelData.collectibles));
  enemies = levelData.enemies ? JSON.parse(JSON.stringify(levelData.enemies)) : [];
  player.x = 80;
  player.y = 380;
  player.vx = 0;
  player.vy = 0;
  player.onGround = false;
  player.climbing = false;
  started = false;
  gameOver = false;
  isDeathScreen = false;
  particles = [];
  advancingLevel = false;
  cam = {x:0, y:0};
  camTarget = {x:0, y:0};
}

function retry(){
  gameOver = false;
  isDeathScreen = false;
  loadLevel(currentLevel);
  levelEl.textContent = currentLevel;
  loop();
}

function allCollectiblesCollected(){
  return collectibles.every(c => c.collected);
}

function advanceLevel(){
  // Start fade out transition; actual level increment happens when fade reaches full
  if(currentLevel < totalLevels){
    transition.state = 'fadeOut'; transition.alpha = 0;
  } else {
    gameOver = true;
    setTimeout(()=>{
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fillRect(0,0,WIDTH,HEIGHT);
      ctx.fillStyle = '#5c4b4b';
      ctx.font = '32px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('🎉 You Won! 🎉', WIDTH/2, HEIGHT/2 - 20);
      ctx.font = '20px system-ui';
      ctx.fillText('All 5 levels complete! Refresh to play again', WIDTH/2, HEIGHT/2 + 30);
    }, 200);
  }
}

function rectIntersect(a,b){
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function update(){
  if(gameOver) return;

  // -- Platformer mode --
  if(keys.left) player.vx -= 0.5;
  if(keys.right) player.vx += 0.5;
  // clamp speed
  const maxSpeed = 4.8;
  if(player.vx > maxSpeed) player.vx = maxSpeed;
  if(player.vx < -maxSpeed) player.vx = -maxSpeed;
  // apply friction
  player.vx *= 0.85;

  // check ladder overlap
  let onLadder = null;
  for(let l of ladders){
    if(player.x + player.w > l.x && player.x < l.x + l.w && player.y + player.h > l.y && player.y < l.y + l.h){
      onLadder = l; break;
    }
  }

  // if on ladder, keep climbing (don't fall)
  if(onLadder){
    player.climbing = true;
    if(keys.up) player.vy = -2.6;
    else if(keys.down) player.vy = 2.6;
    else player.vy = 0; // suspended on ladder
  } else {
    player.climbing = false;
  }

  if(!player.climbing) player.vy += gravity;

  player.x += player.vx;
  player.y += player.vy;

  // platform collision
  player.onGround = false;
  for(let p of platforms){
    if(player.x + player.w > p.x && player.x < p.x + p.w && player.y + player.h > p.y && player.y + player.h < p.y + p.h + 20 && player.vy >= 0){
      player.y = p.y - player.h;
      player.vy = 0;
      player.onGround = true;
      player.climbing = false;
    }
  }

  // ladder top collision (land on top of ladder like a platform)
  for(let l of ladders){
    if(player.x + player.w > l.x && player.x < l.x + l.w && player.y + player.h > l.y && player.y + player.h < l.y + 20 && player.vy >= 0){
      player.y = l.y - player.h;
      player.vy = 0;
      player.onGround = true;
      player.climbing = false;
    }
  }

  // jump (Up) or jump off ladder
  if(keys.jump){ started = true; }
  if(keys.jump && player.onGround){
    player.vy = -13; keys.jump = false; player.onGround = false;
  } else if(keys.jump && player.climbing){
    player.climbing = false; player.vy = -13; keys.jump = false;
  }

  // clamp
  if(player.x < -100) player.x = -100;
  if(player.x > WIDTH - player.w + 100) player.x = WIDTH - player.w + 100;

  // collectibles (bounding box)
  for(let c of collectibles){
    if(!c.collected){
      const hw = 18;
      if(player.x < c.x + hw && player.x + player.w > c.x - hw && player.y < c.y + hw && player.y + player.h > c.y - hw){
        c.collected = true;
        score += 10;
        scoreEl.textContent = score;
        // score pop animation (DOM)
        if(scorePopTimeout) clearTimeout(scorePopTimeout);
        scoreEl.classList.add('pop');
        scorePopTimeout = setTimeout(()=>{ scoreEl.classList.remove('pop'); scorePopTimeout = null; }, 220);
        // spawn particles at collectible location (world coords)
        spawnParticles(c.x, c.y, 12);
        playPop();
      }
    }
  }

  // Check if all collectibles collected to advance level
  if(allCollectiblesCollected() && !advancingLevel){
    advancingLevel = true;
    advanceLevel();
  }

  // Update enemies (vertical movement)
  for(let e of enemies){
    e.y += e.speed * e.dir;
    if(e.y <= e.minY || e.y >= e.maxY){
      e.dir *= -1; // reverse direction
    }
    // Collision with owl
    if(rectIntersect(player, {x:e.x-10, y:e.y-12, w:20, h:24})){
      if(started){ endGame(); }
      return;
    }
  }

  if(player.y > HEIGHT + 120){
    if(started){
      playOuch(); endGame();
    } else {
      respawn();
    }
  }

  // Camera target: center player, with small vertical bias
  camTarget.x = player.x + player.w/2 - WIDTH/2;
  camTarget.y = player.y + player.h/2 - HEIGHT/2 + 40; // slight downward bias
  // clamp to world bounds (assume world width >= WIDTH)
  if(camTarget.x < 0) camTarget.x = 0;
  // vertical clamp (don't go negative too)
  if(camTarget.y < 0) camTarget.y = 0;
  // smooth lerp
  cam.x += (camTarget.x - cam.x) * CAM_LERP;
  cam.y += (camTarget.y - cam.y) * CAM_LERP;

  // update particles
  updateParticles();

  // handle transition fades
  if(transition.state === 'fadeOut'){
    transition.alpha += transition.speed;
    console.log('Fade out:', transition.alpha);
    if(transition.alpha >= 1){
      transition.alpha = 1;
      // actually advance level now
      if(currentLevel < totalLevels){
        currentLevel++;
        console.log('Loading level:', currentLevel);
        loadLevel(currentLevel);
        levelEl.textContent = currentLevel;
        playWhoosh();
      } else {
        // victory: show simple overlay
        gameOver = true;
        console.log('Game won!');
        setTimeout(()=>{},200);
      }
      transition.state = 'fadeIn';
    }
  } else if(transition.state === 'fadeIn'){
    transition.alpha -= transition.speed;
    if(transition.alpha <= 0){ transition.alpha = 0; transition.state = 'none'; console.log('Fade complete'); }
  }
}


function respawn(){
  player.x = player.spawn.x; player.y = player.spawn.y; player.vx = 0; player.vy = 0; player.climbing = false;
}

function endGame(){
  gameOver = true;
  isDeathScreen = true;
}

function drawRoundedRect(x,y,w,h,r,fill){
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
}

// particles
function spawnParticles(x,y,count){
  for(let i=0;i<count;i++){
    particles.push({x:x + (Math.random()-0.5)*10, y:y + (Math.random()-0.5)*10, vx:(Math.random()-0.5)*3, vy:(Math.random()-0.9)*-3, life: 40 + Math.random()*20, size: 2 + Math.random()*3, col: (Math.random()>0.5? '#ffd28a' : '#ffb36b')});
  }


}

function updateParticles(){
  for(let i=particles.length-1;i>=0;i--){
    const p = particles[i];
    p.vy += 0.12; p.x += p.vx; p.y += p.vy; p.life -= 1;
    p.vx *= 0.99; p.vy *= 0.995;
    if(p.life <= 0) particles.splice(i,1);
  }
}

function drawParticles(){
  for(const p of particles){
    ctx.fillStyle = p.col; ctx.beginPath(); ctx.globalAlpha = Math.max(0, p.life/60); ctx.ellipse(p.x, p.y, p.size, p.size, 0, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1;
  }
}

function drawCarrot(x,y,size,color){
  // carrot body (triangle) and green leaves
  ctx.save();
  ctx.translate(x,y);
  ctx.rotate(-0.25);
  ctx.beginPath();
  ctx.moveTo(0, -size*0.45);
  ctx.lineTo(size*0.5, size*0.2);
  ctx.lineTo(-size*0.5, size*0.2);
  ctx.closePath();
  ctx.fillStyle = color || '#ff8c42';
  ctx.fill();
  // highlight
  ctx.beginPath(); ctx.moveTo(-size*0.1, -size*0.25); ctx.lineTo(size*0.2, -size*0.05); ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5; ctx.stroke();
  // leaves
  ctx.rotate(0.25);
  ctx.fillStyle = '#6fbf4a';
  ctx.beginPath(); ctx.ellipse(0 - size*0.2, -size*0.6, size*0.22, size*0.12, -0.6, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0 + size*0.18, -size*0.6, size*0.22, size*0.12, 0.6, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawOwl(x,y,playerX,playerY){
  ctx.save();
  ctx.translate(x,y);
  // body (brown ellipse)
  ctx.fillStyle = '#8b6f47';
  ctx.beginPath();
  ctx.ellipse(0, 0, 12, 14, 0, 0, Math.PI*2);
  ctx.fill();
  // wings
  ctx.fillStyle = '#704020';
  ctx.beginPath();
  ctx.ellipse(-14, -2, 6, 10, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(14, -2, 6, 10, 0, 0, Math.PI*2);
  ctx.fill();
  // head
  ctx.fillStyle = '#8b6f47';
  ctx.beginPath();
  ctx.ellipse(0, -8, 10, 8, 0, 0, Math.PI*2);
  ctx.fill();
  // eyes (large owl eyes with pupils looking at player)
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(-5, -8, 4, 5, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(5, -8, 4, 5, 0, 0, Math.PI*2);
  ctx.fill();
  
  // Calculate gaze direction to player
  const dxLeft = (playerX - 10) - (x - 5);
  const dyLeft = (playerY + 10) - (y - 8);
  const distLeft = Math.sqrt(dxLeft*dxLeft + dyLeft*dyLeft) || 1;
  const pupilOffsetX_L = (dxLeft / distLeft) * 1.5;
  const pupilOffsetY_L = (dyLeft / distLeft) * 1.5;
  
  const dxRight = (playerX - 10) - (x + 5);
  const dyRight = (playerY + 10) - (y - 8);
  const distRight = Math.sqrt(dxRight*dxRight + dyRight*dyRight) || 1;
  const pupilOffsetX_R = (dxRight / distRight) * 1.5;
  const pupilOffsetY_R = (dyRight / distRight) * 1.5;
  
  // pupils following player
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(-5 + pupilOffsetX_L, -8 + pupilOffsetY_L, 2, 0, Math.PI*2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(5 + pupilOffsetX_R, -8 + pupilOffsetY_R, 2, 0, Math.PI*2);
  ctx.fill();
  
  // beak
  ctx.fillStyle = '#ffb347';
  ctx.beginPath();
  ctx.moveTo(0, -4);
  ctx.lineTo(-2, 0);
  ctx.lineTo(2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawLadder(l){
  ctx.fillStyle = '#b07b55'; ctx.fillRect(l.x, l.y, l.w, l.h);
  ctx.fillStyle = '#d6b38b';
  const rungCount = Math.floor(l.h / 20);
  for(let i=0;i<rungCount;i++){
    const ry = l.y + 6 + i*20;
    ctx.fillRect(l.x + 4, ry, l.w - 8, 4);
  }
}

// (Flappy mode removed) no pipe drawing

function drawCharacter(px,py){
  const cx = px + player.w/2; const cy = py + player.h/2;
  ctx.save();
  
  // Animated fluffy tail (round circle, bobs up/down)
  const tailBob = Math.sin(player.frameTimer * 0.3) * 2;
  ctx.fillStyle = '#fff1e6';
  ctx.beginPath();
  ctx.arc(px + player.w + 6, cy + 14 + tailBob, 11, 0, Math.PI*2);
  ctx.fill();
  // tail shadow/inner fluff
  ctx.fillStyle = '#f0e6d6';
  ctx.beginPath();
  ctx.arc(px + player.w + 6, cy + 14 + tailBob, 7, 0, Math.PI*2);
  ctx.fill();
  
  // Back legs (thick, fluffy bunny legs)
  ctx.fillStyle = '#ffffff';
  const backLegOffset = (player.frame % 2 === 0) ? 3 : -3;
  // left back leg
  ctx.beginPath();
  ctx.ellipse(px + 10, py + 44, 6, 14, 0, 0, Math.PI*2);
  ctx.fill();
  // right back leg
  ctx.beginPath();
  ctx.ellipse(px + 30, py + 44, 6, 14, 0, 0, Math.PI*2);
  ctx.fill();
  
  // Main body (large ellipse)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, 16, 20, 0, 0, Math.PI*2);
  ctx.fill();
  
  // Front legs (thick bunny feet, animated)
  const legOffset = (Math.abs(player.vx) > 0.5 && player.onGround) ? ((player.frame % 2 === 0) ? 2 : -2) : 0;
  ctx.fillStyle = '#ffffff';
  // left front leg
  ctx.beginPath();
  ctx.ellipse(px + 12, py + 38 + legOffset, 5, 12, 0, 0, Math.PI*2);
  ctx.fill();
  // right front leg
  ctx.beginPath();
  ctx.ellipse(px + 28, py + 38 - legOffset, 5, 12, 0, 0, Math.PI*2);
  ctx.fill();
  
  // Bunny feet (small pads at end of legs)
  ctx.fillStyle = '#ffb6c1';
  ctx.beginPath();
  ctx.ellipse(px + 12, py + 49 + legOffset, 4, 3, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(px + 28, py + 49 - legOffset, 4, 3, 0, 0, Math.PI*2);
  ctx.fill();
  
  // Belly patch
  ctx.fillStyle = 'rgba(255, 240, 245, 0.6)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 6, 10, 14, 0, 0, Math.PI*2);
  ctx.fill();
  
  // Head
  ctx.fillStyle = '#fff1e6';
  ctx.beginPath();
  ctx.arc(cx, cy - 16, 13, 0, Math.PI*2);
  ctx.fill();
  
  // Ears (animated slight wiggle)
  const earOffset = (player.frame % 2 === 0) ? -1 : 1;
  ctx.fillStyle = '#fff1e6';
  ctx.beginPath();
  ctx.ellipse(cx - 10 + earOffset, cy - 34, 5, 14, -0.5, 0, Math.PI*2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 10 - earOffset, cy - 34, 5, 14, 0.5, 0, Math.PI*2);
  ctx.fill();
  
  // Inner ears (pink)
  ctx.fillStyle = '#ffb6c1';
  ctx.beginPath();
  ctx.ellipse(cx - 10 + earOffset, cy - 32, 2.5, 9, -0.5, 0, Math.PI*2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 10 - earOffset, cy - 32, 2.5, 9, 0.5, 0, Math.PI*2);
  ctx.fill();
  
  // Eyes
  ctx.fillStyle = '#5c4b4b';
  ctx.beginPath();
  ctx.arc(cx - 5, cy - 18, 2, 0, Math.PI*2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 5, cy - 18, 2, 0, Math.PI*2);
  ctx.fill();
  
  // Nose (pink circle)
  ctx.fillStyle = '#ffb6c1';
  ctx.beginPath();
  ctx.arc(cx, cy - 10, 2.5, 0, Math.PI*2);
  ctx.fill();
  
  // Whiskers
  ctx.strokeStyle = '#c07b7b';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(cx - 13, cy - 12);
  ctx.lineTo(cx - 20, cy - 12);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 13, cy - 8);
  ctx.lineTo(cx - 20, cy - 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 13, cy - 12);
  ctx.lineTo(cx + 20, cy - 12);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 13, cy - 8);
  ctx.lineTo(cx + 20, cy - 8);
  ctx.stroke();
  
  ctx.restore();
}

function draw(){
  ctx.clearRect(0,0,WIDTH,HEIGHT);
  // sky top
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,WIDTH,120);

  // Parallax far layer
  ctx.save();
  ctx.translate(-cam.x * 0.2, -cam.y * 0.05);
  ctx.fillStyle = 'rgba(203,231,214,0.9)';
  ctx.beginPath(); ctx.ellipse(200,420,340,120,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(720,460,300,100,0,0,Math.PI*2); ctx.fill();
  ctx.restore();

  // Parallax near layer
  ctx.save();
  ctx.translate(-cam.x * 0.5, 0);
  ctx.fillStyle = 'rgba(220,240,230,0.95)';
  ctx.beginPath(); ctx.ellipse(500,480,500,140,0,0,Math.PI*2); ctx.fill();
  ctx.restore();

  // World (translated by camera)
  ctx.save();
  ctx.translate(-Math.floor(cam.x), -Math.floor(cam.y));

  for(let p of platforms){
    drawRoundedRect(p.x,p.y,p.w,p.h,8,'#dff3e6');
    ctx.fillStyle = '#9bd6a8'; ctx.fillRect(p.x+6,p.y+2,p.w-12,6);
  }

  for(let l of ladders) drawLadder(l);

  for(let c of collectibles){ if(!c.collected) drawCarrot(c.x, c.y, 16, '#ff8c42'); }

  // Draw owls (enemies) - eyes follow the bunny
  for(let e of enemies){ drawOwl(e.x, e.y, player.x + player.w/2, player.y + player.h/2); }

  // Draw character LAST so it appears on top of platforms
  drawCharacter(player.x, player.y);
  ctx.restore();

  // no Flappy pipes in platformer mode

  // Draw death screen if died
  if(isDeathScreen){
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0,0,WIDTH,HEIGHT);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('You Died!', WIDTH/2, HEIGHT/2 - 60);
    
    // Draw retry button (show pressed state)
    const btnX = WIDTH/2 - 80;
    const btnY = HEIGHT/2 + 20;
    const btnW = 160;
    const btnH = 50;
    const pressOffset = retryPressed ? 4 : 0;
    const btnColor = retryPressed ? '#e85b5b' : '#ff6b6b';
    ctx.fillStyle = btnColor;
    ctx.fillRect(btnX, btnY + pressOffset, btnW, btnH - pressOffset);
    ctx.strokeStyle = '#c92a2a';
    ctx.lineWidth = 3;
    ctx.strokeRect(btnX, btnY + pressOffset, btnW, btnH - pressOffset);
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px system-ui';
    ctx.fillText('RETRY', WIDTH/2, btnY + 35 - (pressOffset/2));
  }

  // draw particles in world space (particles created in world coords)
  ctx.save();
  ctx.translate(-Math.floor(cam.x), -Math.floor(cam.y));
  drawParticles();
  ctx.restore();

  // draw transition overlay if active
  if(transition.state !== 'none' || transition.alpha > 0){
    ctx.fillStyle = `rgba(0,0,0,${transition.alpha})`;
    ctx.fillRect(0,0,WIDTH,HEIGHT);
  }

  if(!gameOver){ requestAnimationFrame(loop); }
}

function loop(){ update(); animateFrame(); draw(); }

// animate frames: increment frame timer and advance frame
function animateFrame(){
  // Only animate legs if moving on ground
  if(Math.abs(player.vx) > 0.5 && player.onGround){
    player.frameTimer++;
    const speed = Math.max(1, Math.min(6, Math.floor(Math.abs(player.vx) * 3)));
    if(player.frameTimer >= 8 - speed){ player.frame = (player.frame + 1) % 4; player.frameTimer = 0; }
  } else {
    // Reset animation immediately when stopped
    player.frameTimer = 0;
    player.frame = 0;
  }
}

window.addEventListener('keydown', e=>{
  if(e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
  if(e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
  if(e.key === 'ArrowUp' || e.key === 'w') keys.up = true;
  if(e.key === 'ArrowDown' || e.key === 's') keys.down = true;
  // Up arrow triggers jump
  if(e.key === 'ArrowUp' || e.key === 'w') keys.jump = true;
});
window.addEventListener('keyup', e=>{
  if(e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
  if(e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
  if(e.key === 'ArrowUp' || e.key === 'w') keys.up = false;
  if(e.key === 'ArrowDown' || e.key === 's') keys.down = false;
  if(e.key === 'ArrowUp' || e.key === 'w') keys.jump = false;
});

// Retry pointer handlers (press feedback + activate on release)
canvas.addEventListener('pointerdown', (e)=>{
  if(!isDeathScreen) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const canvasX = (e.clientX - rect.left) * scaleX;
  const canvasY = (e.clientY - rect.top) * scaleY;
  const btnX = WIDTH/2 - 80;
  const btnY = HEIGHT/2 + 20;
  const btnW = 160;
  const btnH = 50;
  if(canvasX >= btnX && canvasX <= btnX + btnW && canvasY >= btnY && canvasY <= btnY + btnH){
    retryPressed = true;
    // Draw immediately so pressed state is visible while game loop is paused
    draw();
  }
});

canvas.addEventListener('pointerup', (e)=>{
  if(!isDeathScreen){ retryPressed = false; return; }
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const canvasX = (e.clientX - rect.left) * scaleX;
  const canvasY = (e.clientY - rect.top) * scaleY;
  const btnX = WIDTH/2 - 80;
  const btnY = HEIGHT/2 + 20;
  const btnW = 160;
  const btnH = 50;
  if(retryPressed && canvasX >= btnX && canvasX <= btnX + btnW && canvasY >= btnY && canvasY <= btnY + btnH){
    retryPressed = false;
    retry();
    return;
  }
  retryPressed = false;
  // ensure we redraw to clear pressed state if retry didn't immediately restart
  draw();
});

canvas.addEventListener('pointercancel', ()=>{ if(retryPressed){ retryPressed = false; draw(); } });
canvas.addEventListener('pointerleave', ()=>{ if(retryPressed){ retryPressed = false; draw(); } });

scoreEl.textContent = score; levelEl.textContent = currentLevel;
loadLevel(currentLevel);
loop();
