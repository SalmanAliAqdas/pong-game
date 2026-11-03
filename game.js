const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const playerScoreDisplay = document.getElementById("player-score");
const computerScoreDisplay = document.getElementById("computer-score");
const bestScoreDisplay = document.getElementById("best-score");
const message = document.getElementById("game-message");
const messageTitle = document.getElementById("message-title");
const messageHint = document.getElementById("message-hint");
const startButton = document.getElementById("start-button");
const pauseButton = document.getElementById("pause-button");
const restartButton = document.getElementById("restart-button");
const soundButton = document.getElementById("sound-button");
const difficultySelect = document.getElementById("difficulty");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 96;
const PADDLE_MARGIN = 28;
const BALL_RADIUS = 9;
const WIN_SCORE = 5;
const PLAYER_SPEED = 460;
const DIFFICULTIES = {
  easy: { speed: 240, reaction: 0.72 },
  normal: { speed: 340, reaction: 0.86 },
  hard: { speed: 440, reaction: 0.96 }
};

const player = { x: PADDLE_MARGIN, y: (HEIGHT - PADDLE_HEIGHT) / 2 };
const computer = {
  x: WIDTH - PADDLE_MARGIN - PADDLE_WIDTH,
  y: (HEIGHT - PADDLE_HEIGHT) / 2
};
const ball = { x: WIDTH / 2, y: HEIGHT / 2, vx: 0, vy: 0, trail: [] };
const particles = [];

let playerScore = 0;
let computerScore = 0;
let bestScore = loadBestScore();
let upPressed = false;
let downPressed = false;
let lastTime = 0;
let gameState = "ready";
let soundEnabled = false;
let audioContext = null;

function loadBestScore() {
  try {
    return Number(localStorage.getItem("pong-best-score")) || 0;
  } catch {
    return 0;
  }
}

function saveBestScore() {
  try {
    localStorage.setItem("pong-best-score", String(bestScore));
  } catch {
    // The game remains playable when browser storage is unavailable.
  }
}

function clampPaddle(paddle) {
  paddle.y = Math.max(0, Math.min(HEIGHT - PADDLE_HEIGHT, paddle.y));
}

function setMessage(title, hint) {
  messageTitle.textContent = title;
  messageHint.textContent = hint;
  message.classList.remove("is-hidden");
}

function hideMessage() {
  message.classList.add("is-hidden");
}

function syncControls() {
  pauseButton.disabled = gameState === "ready" || gameState === "over";
  pauseButton.textContent = gameState === "paused" ? "Resume" : "Pause";
  startButton.textContent = gameState === "playing" ? "Playing…" : "Start game";
  startButton.disabled = gameState === "playing" || gameState === "paused";
}

function updateScore() {
  playerScoreDisplay.textContent = playerScore;
  computerScoreDisplay.textContent = computerScore;
}

function launchBall(direction) {
  ball.x = WIDTH / 2;
  ball.y = HEIGHT / 2;
  ball.trail.length = 0;
  const angle = Math.random() * 0.7 - 0.35;
  const speed = 370;
  ball.vx = Math.cos(angle) * speed * direction;
  ball.vy = Math.sin(angle) * speed;
}

function beginGame() {
  if (gameState === "over") resetGame();
  gameState = "playing";
  launchBall(Math.random() < 0.5 ? -1 : 1);
  hideMessage();
  syncControls();
  canvas.focus({ preventScroll: true });
}

function pauseGame() {
  if (gameState === "playing") {
    gameState = "paused";
    setMessage("Paused", "Press Space or Resume to continue");
  } else if (gameState === "paused") {
    gameState = "playing";
    hideMessage();
  }
  syncControls();
}

function resetGame() {
  playerScore = 0;
  computerScore = 0;
  player.y = (HEIGHT - PADDLE_HEIGHT) / 2;
  computer.y = (HEIGHT - PADDLE_HEIGHT) / 2;
  particles.length = 0;
  updateScore();
  launchBall(1);
  gameState = "ready";
  setMessage("Ready?", `First to ${WIN_SCORE} wins · Press Start or Space`);
  syncControls();
}

function handlePoint(scoredByPlayer) {
  if (scoredByPlayer) playerScore++;
  else computerScore++;
  updateScore();
  playTone(scoredByPlayer ? 660 : 220, 0.12);
  burst(ball.x, ball.y, scoredByPlayer ? "#57e3c2" : "#ff7188", 20);

  if (playerScore > bestScore) {
    bestScore = playerScore;
    bestScoreDisplay.textContent = bestScore;
    saveBestScore();
  }

  if (playerScore >= WIN_SCORE || computerScore >= WIN_SCORE) {
    gameState = "over";
    const won = playerScore >= WIN_SCORE;
    setMessage(won ? "You win!" : "Computer wins", "Press R or Restart to play again");
    playTone(won ? 880 : 150, 0.35);
    syncControls();
    return;
  }

  launchBall(scoredByPlayer ? 1 : -1);
}

function handlePointer(event) {
  const rect = canvas.getBoundingClientRect();
  player.y = (event.clientY - rect.top) * (HEIGHT / rect.height) - PADDLE_HEIGHT / 2;
  clampPaddle(player);
}

canvas.addEventListener("pointermove", handlePointer);
canvas.addEventListener("pointerdown", (event) => {
  canvas.focus({ preventScroll: true });
  handlePointer(event);
});

canvas.addEventListener("keydown", (event) => {
  if (event.key === "ArrowUp" || event.key === "ArrowDown" || event.code === "Space") {
    event.preventDefault();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    event.preventDefault();
    if (event.key === "ArrowUp") upPressed = true;
    if (event.key === "ArrowDown") downPressed = true;
    return;
  }
  if (event.code === "Space" && !event.repeat) {
    event.preventDefault();
    if (gameState === "playing" || gameState === "paused") pauseGame();
    else beginGame();
  }
  if (event.key.toLowerCase() === "r" && !event.repeat) resetGame();
});

document.addEventListener("keyup", (event) => {
  if (event.key === "ArrowUp") upPressed = false;
  if (event.key === "ArrowDown") downPressed = false;
});

// Release held keys when focus leaves the window, but don't pause just because
// the user clicks a browser control or another app briefly.
window.addEventListener("blur", () => {
  upPressed = false;
  downPressed = false;
});

// Pause only when the page is actually hidden (for example, another tab is opened).
document.addEventListener("visibilitychange", () => {
  if (document.hidden && gameState === "playing") pauseGame();
  // Avoid a large elapsed-time delta when returning to the tab.
  lastTime = 0;
});

startButton.addEventListener("click", beginGame);
pauseButton.addEventListener("click", pauseGame);
restartButton.addEventListener("click", resetGame);

soundButton.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundButton.textContent = `Sound: ${soundEnabled ? "On" : "Off"}`;
  soundButton.setAttribute("aria-pressed", String(soundEnabled));
  if (soundEnabled) playTone(520, 0.08);
});

function playTone(frequency, duration) {
  if (!soundEnabled) return;
  try {
    audioContext ??= new AudioContext();
    if (audioContext.state === "suspended") audioContext.resume();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.08, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch {
    // Audio is an optional enhancement and may be unavailable in some browsers.
  }
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 45 + Math.random() * 180;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.35 + Math.random() * 0.45,
      maxLife: 0.8,
      color
    });
  }
}

function hitPaddle(paddle, isPlayer) {
  const overlapsY = ball.y + BALL_RADIUS > paddle.y && ball.y - BALL_RADIUS < paddle.y + PADDLE_HEIGHT;
  const overlapsX = ball.x + BALL_RADIUS > paddle.x && ball.x - BALL_RADIUS < paddle.x + PADDLE_WIDTH;
  if (!overlapsX || !overlapsY) return;
  if ((isPlayer && ball.vx < 0) || (!isPlayer && ball.vx > 0)) {
    const offset = (ball.y - (paddle.y + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2);
    const angle = offset * (Math.PI / 3);
    const speed = Math.min(Math.hypot(ball.vx, ball.vy) * 1.06, 760);
    const direction = isPlayer ? 1 : -1;
    ball.vx = Math.cos(angle) * speed * direction;
    ball.vy = Math.sin(angle) * speed;
    ball.x = isPlayer ? paddle.x + PADDLE_WIDTH + BALL_RADIUS : paddle.x - BALL_RADIUS;
    playTone(isPlayer ? 460 : 360, 0.07);
    burst(ball.x, ball.y, isPlayer ? "#57e3c2" : "#f4f7fb", 8);
  }
}

function update(delta) {
  const dt = Math.min(delta, 0.03);
  if (gameState !== "playing") {
    updateParticles(dt);
    return;
  }

  if (upPressed) player.y -= PLAYER_SPEED * dt;
  if (downPressed) player.y += PLAYER_SPEED * dt;
  clampPaddle(player);

  const difficulty = DIFFICULTIES[difficultySelect.value] || DIFFICULTIES.normal;
  const aim = ball.y - PADDLE_HEIGHT / 2;
  const target = computer.y + (aim - computer.y) * difficulty.reaction;
  const difference = target - computer.y;
  computer.y += Math.sign(difference) * Math.min(Math.abs(difference), difficulty.speed * dt);
  clampPaddle(computer);

  ball.trail.unshift({ x: ball.x, y: ball.y });
  if (ball.trail.length > 8) ball.trail.pop();
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  if (ball.y - BALL_RADIUS <= 0) {
    ball.y = BALL_RADIUS;
    ball.vy = Math.abs(ball.vy);
    playTone(280, 0.04);
  } else if (ball.y + BALL_RADIUS >= HEIGHT) {
    ball.y = HEIGHT - BALL_RADIUS;
    ball.vy = -Math.abs(ball.vy);
    playTone(280, 0.04);
  }

  hitPaddle(player, true);
  hitPaddle(computer, false);
  updateParticles(dt);

  if (ball.x + BALL_RADIUS < 0) handlePoint(false);
  else if (ball.x - BALL_RADIUS > WIDTH) handlePoint(true);
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.97;
    particle.vy *= 0.97;
    particle.life -= dt;
    if (particle.life <= 0) particles.splice(i, 1);
  }
}

function draw() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#141d2c";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.strokeStyle = "#344258";
  ctx.lineWidth = 2;
  ctx.setLineDash([9, 12]);
  ctx.beginPath();
  ctx.moveTo(WIDTH / 2, 0);
  ctx.lineTo(WIDTH / 2, HEIGHT);
  ctx.stroke();
  ctx.setLineDash([]);

  for (const particle of particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (let i = ball.trail.length - 1; i >= 0; i--) {
    const point = ball.trail[i];
    ctx.globalAlpha = (1 - i / ball.trail.length) * 0.22;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(point.x, point.y, BALL_RADIUS * (1 - i / (ball.trail.length + 2)), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.shadowBlur = 18;
  ctx.shadowColor = "#57e3c2";
  ctx.fillStyle = "#57e3c2";
  ctx.fillRect(player.x, player.y, PADDLE_WIDTH, PADDLE_HEIGHT);
  ctx.shadowColor = "#f4f7fb";
  ctx.fillStyle = "#f4f7fb";
  ctx.fillRect(computer.x, computer.y, PADDLE_WIDTH, PADDLE_HEIGHT);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#ffffff";
  ctx.shadowBlur = 16;
  ctx.shadowColor = "#ffffff";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function frame(time) {
  const delta = lastTime ? (time - lastTime) / 1000 : 0;
  lastTime = time;
  update(delta);
  draw();
  requestAnimationFrame(frame);
}

bestScoreDisplay.textContent = bestScore;
updateScore();
setMessage("Ready?", `First to ${WIN_SCORE} wins · Press Start or Space`);
syncControls();
requestAnimationFrame(frame);
