// Flappy Bird — Game Engine
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // --- Constants ---
  const GRAVITY = 0.4;
  const FLAP_VEL = -7;
  const PIPE_W = 62;
  const BIRD_R = 16;
  const GROUND_H = 2;

  // --- Difficulty ---
  const DIFFICULTIES = [
    { name: 'EASY',       gap: 155, interval: 180, speed: 2.8, color: '#4caf50' },
    { name: 'NORMAL',     gap: 130, interval: 145, speed: 3.0, color: '#ff9800' },
    { name: 'HARD',       gap: 112, interval: 115, speed: 3.3, color: '#f44336' },
    { name: 'SUPER HARD', gap: 97,  interval: 90,  speed: 3.6, color: '#9c27b0' },
  ];
  let diffIndex = parseInt(localStorage.getItem('flappy-diff')) || 0;
  let diff = DIFFICULTIES[diffIndex];

  // --- State ---
  const State = { MENU: 0, PLAYING: 1, DEAD: 2 };
  let state = State.MENU;
  let bird = { x: 0, y: 0, vy: 0, rot: 0, wingPhase: 0 };
  let pipes = [];
  let scoreVal = 0;
  let bestScore = parseInt(localStorage.getItem('flappy-best-' + diffIndex)) || 0;
  let frameCount = 0;
  let deathTimer = 0;
  let flashAlpha = 0;
  let stars = [];
  let particles = [];
  let groundOffset = 0;
  let w = 0, h = 0;
  let dpr = 1;
  let lastTime = 0;

  // --- Resize ---
  function resize() {
    dpr = window.devicePixelRatio || 1;
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (stars.length === 0) initStars();
  }

  function initStars() {
    stars = [];
    for (let i = 0; i < 80; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h * 0.7,
        r: Math.random() * 1.8 + 0.3,
        a: Math.random() * 0.6 + 0.1,
        speed: Math.random() * 0.3 + 0.05
      });
    }
  }

  function resetGame() {
    bird.x = w * 0.28;
    bird.y = h * 0.45;
    bird.vy = 0;
    bird.rot = 0;
    bird.wingPhase = 0;
    pipes = [];
    scoreVal = 0;
    frameCount = 0;
    flashAlpha = 0;
    particles = [];
  }

  // --- Difficulty buttons layout (2x2 grid for small screens) ---
  function getDiffButtons() {
    const cols = w < 500 ? 2 : 4;
    const rows = Math.ceil(DIFFICULTIES.length / cols);
    const btnW = w < 500 ? Math.min(130, (w - 60) / 2) : 120;
    const btnH = 38;
    const spacingX = 12, spacingY = 12;
    const totalW = cols * btnW + (cols - 1) * spacingX;
    const startX = (w - totalW) / 2;
    const startY = h * 0.62;
    return DIFFICULTIES.map((d, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      return {
        x: startX + col * (btnW + spacingX),
        y: startY + row * (btnH + spacingY),
        w: btnW, h: btnH, diff: d, index: i
      };
    });
  }

  function setDifficulty(index) {
    diffIndex = Math.max(0, Math.min(DIFFICULTIES.length - 1, index));
    diff = DIFFICULTIES[diffIndex];
    bestScore = parseInt(localStorage.getItem('flappy-best-' + diffIndex)) || 0;
    localStorage.setItem('flappy-diff', diffIndex);
  }

  // --- Input ---
  function handleTap(tx, ty) {
    // Block input while install overlay is visible
    const overlay = document.getElementById('install-overlay');
    if (overlay && !overlay.classList.contains('hidden')) return;

    if (state === State.MENU) {
      // Check difficulty buttons
      const buttons = getDiffButtons();
      for (const btn of buttons) {
        if (tx >= btn.x && tx <= btn.x + btn.w && ty >= btn.y && ty <= btn.y + btn.h) {
          setDifficulty(btn.index);
          GameAudio.flap();
          return;
        }
      }
      // Start game
      state = State.PLAYING;
      resetGame();
      GameAudio.swoosh();
    }
    if (state === State.PLAYING) {
      bird.vy = FLAP_VEL;
      bird.wingPhase = 1;
      GameAudio.flap();
      return;
    }
    if (state === State.DEAD && deathTimer > 20) {
      state = State.MENU;
      GameAudio.swoosh();
    }
  }

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    handleTap(t.clientX, t.clientY);
  }, { passive: false });

  canvas.addEventListener('mousedown', (e) => {
    handleTap(e.clientX, e.clientY);
  });

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      handleTap(0, 0); // won't hit buttons, will start/flap
    }
    // Arrow keys to change difficulty in menu
    if (state === State.MENU) {
      if (e.code === 'ArrowLeft') setDifficulty(diffIndex - 1);
      if (e.code === 'ArrowRight') setDifficulty(diffIndex + 1);
    }
  });

  window.addEventListener('resize', resize);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) lastTime = performance.now();
  });

  // --- Particles ---
  function spawnDeathParticles() {
    for (let i = 0; i < 15; i++) {
      particles.push({
        x: bird.x, y: bird.y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        r: Math.random() * 4 + 2,
        life: 1,
        color: Math.random() > 0.5 ? '#ffd700' : '#ff8c00'
      });
    }
  }

  // --- Update ---
  function update() {
    if (state !== State.PLAYING) return;

    frameCount++;

    // Bird physics
    bird.vy += GRAVITY;
    bird.y += bird.vy;
    bird.rot = Math.max(-30, Math.min(90, bird.vy * 4));
    bird.wingPhase *= 0.85;

    // Ground scroll
    groundOffset = (groundOffset + diff.speed) % 20;

    // Spawn pipes — only when rightmost pipe has moved far enough
    const lastPipe = pipes.length > 0 ? pipes[pipes.length - 1] : null;
    const minDist = diff.interval * diff.speed; // pixel distance between pipes
    if (!lastPipe || lastPipe.x <= w + 10 - minDist) {
      const minGapY = diff.gap / 2 + 60;
      const maxGapY = h - GROUND_H - diff.gap / 2 - 60;
      const gapY = Math.random() * (maxGapY - minGapY) + minGapY;
      pipes.push({ x: w + 10, gapY, scored: false });
    }

    // Move pipes
    for (let i = pipes.length - 1; i >= 0; i--) {
      pipes[i].x -= diff.speed;
      if (pipes[i].x < -PIPE_W) {
        pipes.splice(i, 1);
        continue;
      }
      // Score
      if (!pipes[i].scored && pipes[i].x + PIPE_W / 2 < bird.x) {
        pipes[i].scored = true;
        scoreVal++;
        GameAudio.score();
      }
    }

    // Collision
    const bx = bird.x, by = bird.y, br = BIRD_R;

    // Ground / ceiling
    if (by + br > h - GROUND_H || by - br < 0) {
      killBird();
      return;
    }

    // Pipes
    for (const p of pipes) {
      const px = p.x, pw = PIPE_W, gapY = p.gapY, gapH = diff.gap;
      // Top pipe rect: px, 0, pw, gapY - gapH/2
      // Bottom pipe rect: px, gapY + gapH/2, pw, h
      if (circleRect(bx, by, br, px, 0, pw, gapY - gapH / 2) ||
          circleRect(bx, by, br, px, gapY + gapH / 2, pw, h - (gapY + gapH / 2))) {
        killBird();
        return;
      }
    }
  }

  function killBird() {
    state = State.DEAD;
    deathTimer = 0;
    flashAlpha = 0.6;
    if (scoreVal > bestScore) {
      bestScore = scoreVal;
      localStorage.setItem('flappy-best-' + diffIndex, bestScore);
    }
    spawnDeathParticles();
    GameAudio.die();
  }

  function circleRect(cx, cy, cr, rx, ry, rw, rh) {
    const nearX = Math.max(rx, Math.min(cx, rx + rw));
    const nearY = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - nearX, dy = cy - nearY;
    return dx * dx + dy * dy < cr * cr;
  }

  // --- Draw ---
  function draw() {
    ctx.clearRect(0, 0, w, h);

    drawBackground();
    drawStars();

    if (state === State.MENU) {
      drawGround();
      drawMenu();
    } else {
      drawPipes();
      drawGround();
      drawBird();
      drawParticles();
      drawFlash();
      drawScore();
      if (state === State.DEAD) drawDeath();
    }
  }

  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#0a0a1a');
    grad.addColorStop(0.5, '#1a1a2e');
    grad.addColorStop(1, '#16213e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  function drawStars() {
    for (const s of stars) {
      s.a += Math.sin(frameCount * s.speed * 0.1) * 0.005;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0.05, Math.min(0.7, s.a))})`;
      ctx.fill();
    }
  }

  function drawPipes() {
    for (const p of pipes) {
      const topH = p.gapY - diff.gap / 2;
      const botY = p.gapY + diff.gap / 2;
      const botH = h - botY;

      // Glow
      ctx.shadowColor = '#00d4ff';
      ctx.shadowBlur = 15;

      // Top pipe
      ctx.fillStyle = '#0e4d6e';
      roundRect(p.x, 0, PIPE_W, topH, 0, 0, 8, 8);
      // Top pipe cap
      ctx.fillStyle = '#0f6f9e';
      roundRect(p.x - 4, topH - 20, PIPE_W + 8, 20, 0, 0, 8, 8);

      // Bottom pipe
      ctx.fillStyle = '#0e4d6e';
      roundRect(p.x, botY, PIPE_W, botH, 8, 8, 0, 0);
      // Bottom pipe cap
      ctx.fillStyle = '#0f6f9e';
      roundRect(p.x - 4, botY, PIPE_W + 8, 20, 8, 8, 0, 0);

      // Edge glow lines
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x, 0); ctx.lineTo(p.x, topH);
      ctx.moveTo(p.x + PIPE_W, 0); ctx.lineTo(p.x + PIPE_W, topH);
      ctx.moveTo(p.x, botY); ctx.lineTo(p.x, h);
      ctx.moveTo(p.x + PIPE_W, botY); ctx.lineTo(p.x + PIPE_W, h);
      ctx.stroke();

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }
  }

  function roundRect(x, y, w, h, rtl, rtr, rbr, rbl) {
    ctx.beginPath();
    ctx.moveTo(x + rtl, y);
    ctx.lineTo(x + w - rtr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rtr);
    ctx.lineTo(x + w, y + h - rbr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rbr, y + h);
    ctx.lineTo(x + rbl, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rbl);
    ctx.lineTo(x, y + rtl);
    ctx.quadraticCurveTo(x, y, x + rtl, y);
    ctx.closePath();
    ctx.fill();
  }

  function drawGround() {
    const gy = h - GROUND_H;
    ctx.fillStyle = '#0f6f9e';
    ctx.fillRect(0, gy, w, GROUND_H);
    // Glow line
    ctx.shadowColor = '#00d4ff';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(w, gy);
    ctx.stroke();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  function drawBird() {
    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(bird.rot * Math.PI / 180);

    // Body
    const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, BIRD_R);
    grad.addColorStop(0, '#ffee58');
    grad.addColorStop(1, '#ff9800');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, BIRD_R, BIRD_R * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wing
    const wingY = bird.wingPhase * -5;
    ctx.fillStyle = '#f57c00';
    ctx.beginPath();
    ctx.ellipse(-5, 3 + wingY, BIRD_R * 0.6, BIRD_R * 0.35, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(7, -4, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(9, -4, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(10, -5.5, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = '#ef5350';
    ctx.beginPath();
    ctx.moveTo(BIRD_R - 2, -2);
    ctx.lineTo(BIRD_R + 10, 2);
    ctx.lineTo(BIRD_R - 2, 6);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function drawParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.life -= 0.025;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawFlash() {
    if (flashAlpha > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
      ctx.fillRect(0, 0, w, h);
      flashAlpha *= 0.85;
      if (flashAlpha < 0.01) flashAlpha = 0;
    }
  }

  function drawScore() {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    // Difficulty badge
    ctx.font = 'bold 12px -apple-system, Helvetica, Arial, sans-serif';
    ctx.fillStyle = diff.color;
    ctx.fillText(diff.name, w / 2, 45);
    // Score shadow
    ctx.font = 'bold 52px -apple-system, Helvetica, Arial, sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillText(scoreVal, w / 2 + 2, 62);
    // Score text
    ctx.fillStyle = '#fff';
    ctx.fillText(scoreVal, w / 2, 60);
    ctx.restore();
  }

  function drawMenu() {
    ctx.save();
    ctx.textAlign = 'center';

    // Title: FLAPPY FUXS
    ctx.font = 'bold 48px -apple-system, Helvetica, Arial, sans-serif';
    ctx.fillStyle = '#00d4ff';
    ctx.shadowColor = '#00d4ff';
    ctx.shadowBlur = 20;
    ctx.fillText('FLAPPY FUXS', w / 2, h * 0.18);
    ctx.shadowBlur = 0;

    // Idle bird bob — centered nicely below title
    const bobY = h * 0.32 + Math.sin(Date.now() * 0.003) * 10;
    const savedBird = { x: bird.x, y: bird.y, rot: bird.rot, wingPhase: bird.wingPhase };
    bird.x = w / 2;
    bird.y = bobY;
    bird.rot = 0;
    bird.wingPhase = Math.sin(Date.now() * 0.008) * 0.5 + 0.5;
    drawBird();
    bird.x = savedBird.x;
    bird.y = savedBird.y;
    bird.rot = savedBird.rot;
    bird.wingPhase = savedBird.wingPhase;

    // "TAP TO PLAY" pulse
    ctx.font = '18px -apple-system, Helvetica, Arial, sans-serif';
    const pulse = 0.5 + Math.sin(Date.now() * 0.004) * 0.3;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('TAP TO PLAY', w / 2, h * 0.46);
    ctx.globalAlpha = 1;

    // Difficulty section
    ctx.font = 'bold 13px -apple-system, Helvetica, Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('DIFFICULTY', w / 2, h * 0.57);

    // Difficulty buttons
    const buttons = getDiffButtons();
    ctx.textBaseline = 'middle';
    for (const btn of buttons) {
      const selected = btn.index === diffIndex;
      const r = 10;

      // Button shape
      ctx.beginPath();
      ctx.moveTo(btn.x + r, btn.y);
      ctx.lineTo(btn.x + btn.w - r, btn.y);
      ctx.quadraticCurveTo(btn.x + btn.w, btn.y, btn.x + btn.w, btn.y + r);
      ctx.lineTo(btn.x + btn.w, btn.y + btn.h - r);
      ctx.quadraticCurveTo(btn.x + btn.w, btn.y + btn.h, btn.x + btn.w - r, btn.y + btn.h);
      ctx.lineTo(btn.x + r, btn.y + btn.h);
      ctx.quadraticCurveTo(btn.x, btn.y + btn.h, btn.x, btn.y + btn.h - r);
      ctx.lineTo(btn.x, btn.y + r);
      ctx.quadraticCurveTo(btn.x, btn.y, btn.x + r, btn.y);
      ctx.closePath();

      if (selected) {
        ctx.fillStyle = btn.diff.color;
        ctx.shadowColor = btn.diff.color;
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Label
      ctx.font = selected ? 'bold 13px -apple-system, Helvetica, Arial, sans-serif'
                          : '12px -apple-system, Helvetica, Arial, sans-serif';
      ctx.fillStyle = selected ? '#fff' : 'rgba(255,255,255,0.4)';
      ctx.fillText(btn.diff.name, btn.x + btn.w / 2, btn.y + btn.h / 2);

      // Per-difficulty best score under button
      const dBest = parseInt(localStorage.getItem('flappy-best-' + btn.index)) || 0;
      if (dBest > 0) {
        ctx.font = '10px -apple-system, Helvetica, Arial, sans-serif';
        ctx.fillStyle = selected ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)';
        ctx.fillText(dBest, btn.x + btn.w / 2, btn.y + btn.h + 13);
      }
    }
    ctx.textBaseline = 'alphabetic';

    ctx.restore();
  }

  function drawDeath() {
    deathTimer++;

    ctx.save();
    ctx.textAlign = 'center';

    // Overlay
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, w, h);

    // Game Over
    ctx.font = 'bold 42px -apple-system, Helvetica, Arial, sans-serif';
    ctx.fillStyle = '#ef5350';
    ctx.shadowColor = '#ef5350';
    ctx.shadowBlur = 15;
    ctx.fillText('GAME OVER', w / 2, h * 0.30);
    ctx.shadowBlur = 0;

    // Difficulty badge
    ctx.font = 'bold 14px -apple-system, Helvetica, Arial, sans-serif';
    ctx.fillStyle = diff.color;
    ctx.fillText(diff.name, w / 2, h * 0.36);

    // Score
    ctx.font = 'bold 64px -apple-system, Helvetica, Arial, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(scoreVal, w / 2, h * 0.44);

    // Best
    ctx.font = '20px -apple-system, Helvetica, Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('BEST: ' + bestScore, w / 2, h * 0.54);

    // Restart hint
    if (deathTimer > 20) {
      const pulse = 0.4 + Math.sin(Date.now() * 0.004) * 0.3;
      ctx.globalAlpha = pulse + 0.3;
      ctx.font = '18px -apple-system, Helvetica, Arial, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText('TAP TO RESTART', w / 2, h * 0.64);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  // --- Game Loop ---
  function loop(time) {
    if (!lastTime) lastTime = time;
    lastTime = time;

    update();
    draw();
    requestAnimationFrame(loop);
  }

  // --- Init ---
  resize();
  resetGame();
  requestAnimationFrame(loop);
})();
