const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const playerScoreDisplay = document.getElementById("player-score");
const computerScoreDisplay = document.getElementById("computer-score");
const bestScoreDisplay = document.getElementById("best-score");
const leftPlayerLabel = document.getElementById("left-player-label");
const rightPlayerLabel = document.getElementById("right-player-label");
const message = document.getElementById("game-message");
const messageTitle = document.getElementById("message-title");
const messageHint = document.getElementById("message-hint");
const startButton = document.getElementById("start-button");
const pauseButton = document.getElementById("pause-button");
const restartButton = document.getElementById("restart-button");
const soundButton = document.getElementById("sound-button");
const difficultySelect = document.getElementById("difficulty");
const difficultyControl = document.getElementById("difficulty-control");
const modeSelect = document.getElementById("mode");
const helpText = document.getElementById("help-text");

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
const opponent = {
  x: WIDTH - PADDLE_MARGIN - PADDLE_WIDTH,
  y: (HEIGHT - PADDLE_HEIGHT) / 2
};
const ball = { x: WIDTH / 2, y: HEIGHT / 2, vx: 0, vy: 0, trail: [] };
const particles = [];

let playerScore = 0;
let opponentScore = 0;
let bestScore = loadBestScore();
const keys = { w: false, s: false, up: false, down: false };
let lastTime = 0;
let gameState = "ready";
let soundEnabled = false;
let audioContext = null;

function isTwoPlayer() {
  return modeSelect.value === "two-player";
}

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
  computerScoreDisplay.textContent = opponentScore;
}

function updateModeUI() {
  const twoPlayer = isTwoPlayer();
  difficultyControl.hidden = twoPlayer;
  leftPlayerLabel.textContent = twoPlayer ? "Player 1" : "You";
  rightPlayerLabel.textContent = twoPlayer ? "Player 2" : "Computer";
  helpText.innerHTML = twoPlayer
    ? 'Player 1: <kbd>W</kbd>/<kbd>S</kbd> · Player 2: <kbd>↑</kbd>/<kbd>↓</kbd> · <kbd>Space</kbd> start/pause · <kbd>R</kbd> restart'
    : 'Move with your mouse or <kbd>W</kbd>/<kbd>S</kbd> · <kbd>Space</kbd> start/pause · <kbd>R</kbd> restart';
  canvas.setAttribute("aria-label", twoPlayer
    ? "Two-player Pong. Player one uses W and S. Player two uses the up and down arrow keys."
    : "Pong against the computer. Move your paddle with the mouse or W and S.");
  setMessage("Ready?", twoPlayer
    ? `Two players · First to ${WIN_SCORE} wins · Press Start or Space`
    : `First to ${WIN_SCORE} wins · Press Start or Space`);
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
  opponentScore = 0;
  player.y = (HEIGHT - PADDLE_HEIGHT) / 2;
  opponent.y = (HEIGHT - PADDLE_HEIGHT) / 2;
  particles.length = 0;
  updateScore();
  launchBall(1);
  gameState = "ready";
  setMessage("Ready?", isTwoPlayer()
    ? `Two players · First to ${WIN_SCORE} wins · Press Start or Space`
    : `First to ${WIN_SCORE} wins · Press Start or Space`);
  syncControls();
}

function handlePoint(scoredByPlayer) {
  if (scoredByPlayer) playerScore++;
  else opponentScore++;
  updateScore();
  playTone(scoredByPlayer ? 660 : 220, 0.12);
  burst(ball.x, ball.y, scoredByPlayer ? "#57e3c2" : "#ff7188", 20);

  if (!isTwoPlayer() && playerScore > bestScore) {
    bestScore = playerScore;
    bestScoreDisplay.textContent = bestScore;
    saveBestScore();
  }

  if (playerScore >= WIN_SCORE || opponentScore >= WIN_SCORE) {
    gameState = "over";
    const winner = playerScore >= WIN_SCORE
      ? (isTwoPlayer() ? "Player 1 wins!" : "You win!")
      : (isTwoPlayer() ? "Player 2 wins!" : "Computer wins!");
    setMessage(winner, "Press R or Restart to play again");
    playTone(playerScore >= WIN_SCORE ? 880 : 150, 0.35);
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

canvas.addEventListener("pointermove", (event) => {
  if (!isTwoPlayer()) handlePointer(event);
});
canvas.addEventListener("pointerdown", (event) => {
  canvas.focus({ preventScroll: true });
  if (!isTwoPlayer()) handlePointer(event);
});

canvas.addEventListener("keydown", (event) => {
  if (["ArrowUp", "ArrowDown", "Space"].includes(event.code) ||
      event.key === "ArrowUp" || event.key === "ArrowDown") {
    event.preventDefault();
  }
});

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    event.preventDefault();
    if (event.key === "ArrowUp") keys.up = true;
    if (event.key === "ArrowDown") keys.down = true;
    return;
  }
  if (key === "w") keys.w = true;
  if (key === "s") keys.s = true;
  if (event.code === "Space" && !event.repeat) {
    event.preventDefault();
    if (gameState === "playing" || gameState === "paused") pauseGame();
    else beginGame();
  }
  if (key === "r" && !event.repeat) resetGame();
});

document.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  if (event.key === "ArrowUp") keys.up = false;
  if (event.key === "ArrowDown") keys.down = false;
  if (key === "w") keys.w = false;
  if (key === "s") keys.s = false;
});

function clearKeys() {
  keys.w = false;
  keys.s = false;
  keys.up = false;
  keys.down = false;
}

window.addEventListener("blur", clearKeys);
document.addEventListener("visibilitychange", () => {
  clearKeys();
  if (document.hidden && gameState === "playing") pauseGame();
  lastTime = 0;
});

modeSelect.addEventListener("change", () => {
  clearKeys();
  resetGame();
  updateModeUI();
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
    // Audio is optional and may be unavailable in some browsers.
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

  if (keys.w) player.y -= PLAYER_SPEED * dt;
  if (keys.s) player.y += PLAYER_SPEED * dt;
  if (!isTwoPlayer()) {
    if (keys.up) player.y -= PLAYER_SPEED * dt;
    if (keys.down) player.y += PLAYER_SPEED * dt;
  }
  clampPaddle(player);

  if (isTwoPlayer()) {
    if (keys.up) opponent.y -= PLAYER_SPEED * dt;
    if (keys.down) opponent.y += PLAYER_SPEED * dt;
  } else {
    const difficulty = DIFFICULTIES[difficultySelect.value] || DIFFICULTIES.normal;
    const aim = ball.y - PADDLE_HEIGHT / 2;
    const target = opponent.y + (aim - opponent.y) * difficulty.reaction;
    const difference = target - opponent.y;
    opponent.y += Math.sign(difference) * Math.min(Math.abs(difference), difficulty.speed * dt);
  }
  clampPaddle(opponent);

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
  hitPaddle(opponent, false);
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
  ctx.fillRect(opponent.x, opponent.y, PADDLE_WIDTH, PADDLE_HEIGHT);
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
updateModeUI();
syncControls();
requestAnimationFrame(frame);
