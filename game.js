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
const playerNamesSection = document.getElementById("player-names");
const playerOneNameInput = document.getElementById("player-one-name");
const playerTwoNameInput = document.getElementById("player-two-name");
const matchTitleInput = document.getElementById("match-title");
const matchFormatSelect = document.getElementById("match-format");
const saveSettingsButton = document.getElementById("save-settings-button");
const resetScoreButton = document.getElementById("reset-score-button");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 96;
const PADDLE_MARGIN = 28;
const BALL_RADIUS = 9;
const POINTS_TO_WIN = 5;
const PADDLE_SPEED = 460;
const DIFFICULTIES = {
  easy: { speed: 240, reaction: 0.72 },
  normal: { speed: 340, reaction: 0.86 },
  hard: { speed: 440, reaction: 0.96 }
};

const player = { x: PADDLE_MARGIN, y: (HEIGHT - PADDLE_HEIGHT) / 2 };
const opponent = { x: WIDTH - PADDLE_MARGIN - PADDLE_WIDTH, y: (HEIGHT - PADDLE_HEIGHT) / 2 };
const ball = { x: WIDTH / 2, y: HEIGHT / 2, vx: 0, vy: 0, trail: [] };
const particles = [];
const keys = { w: false, s: false, up: false, down: false };

let playerScore = 0;
let opponentScore = 0;
let roundWins = { left: 0, right: 0 };
let bestScore = loadBestScore();
let lastTime = 0;
let gameState = "ready";
let soundEnabled = false;
let audioContext = null;

function isTwoPlayer() { return modeSelect.value === "two-player"; }
function isTeamsMode() { return modeSelect.value === "teams"; }
function isLocalMode() { return isTwoPlayer() || isTeamsMode(); }

function loadBestScore() {
  try { return Number(localStorage.getItem("pong-best-score")) || 0; }
  catch { return 0; }
}

function saveBestScore() {
  try { localStorage.setItem("pong-best-score", String(bestScore)); }
  catch { /* Storage is optional. */ }
}

function getName(input, fallback) {
  return input.value.trim().slice(0, 16) || fallback;
}
function leftName() { return getName(playerOneNameInput, isTeamsMode() ? "Team Red" : "Player 1"); }
function rightName() { return getName(playerTwoNameInput, isTeamsMode() ? "Team Blue" : "Player 2"); }
function matchTitle() { return matchTitleInput.value.trim().slice(0, 28) || "Pong Cup"; }

function loadSettings() {
  try {
    playerOneNameInput.value = localStorage.getItem("pong-player-one") || "";
    playerTwoNameInput.value = localStorage.getItem("pong-player-two") || "";
    matchTitleInput.value = localStorage.getItem("pong-match-title") || "";
    matchFormatSelect.value = localStorage.getItem("pong-match-format") || "single";
  } catch { /* Inputs still work when storage is disabled. */ }
}

function saveSettings() {
  try {
    localStorage.setItem("pong-player-one", playerOneNameInput.value.trim().slice(0, 16));
    localStorage.setItem("pong-player-two", playerTwoNameInput.value.trim().slice(0, 16));
    localStorage.setItem("pong-match-title", matchTitleInput.value.trim().slice(0, 28));
    localStorage.setItem("pong-match-format", matchFormatSelect.value);
  } catch { /* Saving is optional. */ }
  updateModeUI();
}

function matchTarget() {
  if (matchFormatSelect.value === "best3") return 2;
  if (matchFormatSelect.value === "best5") return 3;
  return 1;
}

function formatName() {
  const target = matchTarget();
  return target === 1 ? "Single match" : `Best of ${target * 2 - 1}`;
}

function clampPaddle(paddle) {
  paddle.y = Math.max(0, Math.min(HEIGHT - PADDLE_HEIGHT, paddle.y));
}

function setMessage(title, hint) {
  messageTitle.textContent = title;
  messageHint.textContent = hint;
  message.classList.remove("is-hidden");
}
function hideMessage() { message.classList.add("is-hidden"); }

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

function escapeHTML(text) {
  return text.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}

function updateModeUI() {
  const local = isLocalMode();
  difficultyControl.hidden = local;
  playerNamesSection.hidden = !local;
  leftPlayerLabel.textContent = local ? leftName() : "You";
  rightPlayerLabel.textContent = local ? rightName() : "Computer";
  const left = escapeHTML(leftName());
  const right = escapeHTML(rightName());
  helpText.innerHTML = local
    ? `${left}: <kbd>W</kbd>/<kbd>S</kbd> · ${right}: <kbd>↑</kbd>/<kbd>↓</kbd> · <kbd>Space</kbd> start/pause · <kbd>R</kbd> restart`
    : 'Move with your mouse or <kbd>W</kbd>/<kbd>S</kbd> · <kbd>Space</kbd> start/pause · <kbd>R</kbd> restart';
  canvas.setAttribute("aria-label", local
    ? `Pong. ${leftName()} uses W and S. ${rightName()} uses the up and down arrow keys.`
    : "Pong against the computer. Move with your mouse or W and S.");
  document.title = `${matchTitle()} | Pong`;
  if (gameState === "ready") {
    setMessage("Ready?", `${local ? `${leftName()} vs ${rightName()}` : "Solo challenge"} · ${formatName()} · ${matchTitle()} · Press Start or Space`);
  }
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
  roundWins = { left: 0, right: 0 };
  player.y = opponent.y = (HEIGHT - PADDLE_HEIGHT) / 2;
  particles.length = 0;
  updateScore();
  launchBall(1);
  gameState = "ready";
  updateModeUI();
  syncControls();
}

function finishMatch(winner) {
  gameState = "over";
  const winnerName = isLocalMode() ? (winner === "left" ? leftName() : rightName()) : (winner === "left" ? "You" : "Computer");
  const setSummary = matchTarget() === 1 ? "" : ` · Sets ${roundWins.left}-${roundWins.right}`;
  setMessage(`${winnerName} wins!`, `${matchTitle()} complete${setSummary} · Press R or Restart`);
  playTone(winner === "left" ? 880 : 150, 0.35);
  syncControls();
}

function handlePoint(scoredByPlayer) {
  // One point is awarded per goal; immediately serve a fresh ball so the same
  // goal cannot be counted again on subsequent animation frames.
  if (scoredByPlayer) playerScore++;
  else opponentScore++;
  updateScore();
  playTone(scoredByPlayer ? 660 : 220, 0.12);
  burst(ball.x, ball.y, scoredByPlayer ? "#57e3c2" : "#ff7188", 20);

  if (!isLocalMode() && playerScore > bestScore) {
    bestScore = playerScore;
    bestScoreDisplay.textContent = bestScore;
    saveBestScore();
  }

  const winner = playerScore >= POINTS_TO_WIN ? "left" : opponentScore >= POINTS_TO_WIN ? "right" : null;
  if (!winner) {
    // Critical fix: without this serve reset, the ball stays beyond the edge
    // and scores again every frame until a player reaches five.
    launchBall(scoredByPlayer ? 1 : -1);
    return;
  }

  if (matchTarget() === 1) {
    finishMatch(winner);
    return;
  }

  roundWins[winner]++;
  const setsNeeded = matchTarget();
  if (roundWins[winner] >= setsNeeded) {
    finishMatch(winner);
    return;
  }

  // A set has ended; start a fresh set with its point score reset.
  playerScore = 0;
  opponentScore = 0;
  updateScore();
  player.y = opponent.y = (HEIGHT - PADDLE_HEIGHT) / 2;
  launchBall(Math.random() < 0.5 ? -1 : 1);
  hideMessage();
}

function movePlayerWithPointer(event) {
  const rect = canvas.getBoundingClientRect();
  player.y = (event.clientY - rect.top) * (HEIGHT / rect.height) - PADDLE_HEIGHT / 2;
  clampPaddle(player);
}

canvas.addEventListener("pointermove", (event) => {
  if (!isLocalMode()) movePlayerWithPointer(event);
});
canvas.addEventListener("pointerdown", (event) => {
  canvas.focus({ preventScroll: true });
  if (!isLocalMode()) movePlayerWithPointer(event);
});

canvas.addEventListener("keydown", (event) => {
  if (["ArrowUp", "ArrowDown", "Space"].includes(event.code)) event.preventDefault();
});

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    event.preventDefault();
    if (event.key === "ArrowUp") keys.up = true;
    else keys.down = true;
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

function clearKeys() { keys.w = keys.s = keys.up = keys.down = false; }
window.addEventListener("blur", clearKeys);
document.addEventListener("visibilitychange", () => {
  clearKeys();
  if (document.hidden && gameState === "playing") pauseGame();
  lastTime = 0;
});

modeSelect.addEventListener("change", () => { clearKeys(); resetGame(); });
matchFormatSelect.addEventListener("change", () => { saveSettings(); resetGame(); });
playerOneNameInput.addEventListener("input", () => { saveSettings(); });
playerTwoNameInput.addEventListener("input", () => { saveSettings(); });
matchTitleInput.addEventListener("input", () => {
  document.title = `${matchTitle()} | Pong`;
  if (gameState === "ready") updateModeUI();
});
saveSettingsButton.addEventListener("click", saveSettings);
resetScoreButton.addEventListener("click", () => {
  bestScore = 0;
  try { localStorage.setItem("pong-best-score", "0"); } catch { /* Optional storage. */ }
  bestScoreDisplay.textContent = "0";
  resetGame();
  setMessage("Scores reset", "Ready for a fresh match");
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
  } catch { /* Audio is optional. */ }
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 45 + Math.random() * 180;
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.35 + Math.random() * 0.45, maxLife: 0.8, color });
  }
}

function hitPaddle(paddle, isLeft) {
  const overlapY = ball.y + BALL_RADIUS > paddle.y && ball.y - BALL_RADIUS < paddle.y + PADDLE_HEIGHT;
  const overlapX = ball.x + BALL_RADIUS > paddle.x && ball.x - BALL_RADIUS < paddle.x + PADDLE_WIDTH;
  if (!overlapX || !overlapY || (isLeft ? ball.vx >= 0 : ball.vx <= 0)) return;
  const offset = (ball.y - (paddle.y + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2);
  const angle = offset * Math.PI / 3;
  const speed = Math.min(Math.hypot(ball.vx, ball.vy) * 1.06, 760);
  ball.vx = Math.cos(angle) * speed * (isLeft ? 1 : -1);
  ball.vy = Math.sin(angle) * speed;
  ball.x = isLeft ? paddle.x + PADDLE_WIDTH + BALL_RADIUS : paddle.x - BALL_RADIUS;
  playTone(isLeft ? 460 : 360, 0.07);
  burst(ball.x, ball.y, isLeft ? "#57e3c2" : "#f4f7fb", 8);
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.97;
    p.vy *= 0.97;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function update(delta) {
  const dt = Math.min(delta, 0.03);
  if (gameState !== "playing") { updateParticles(dt); return; }

  if (keys.w) player.y -= PADDLE_SPEED * dt;
  if (keys.s) player.y += PADDLE_SPEED * dt;
  if (!isLocalMode()) {
    if (keys.up) player.y -= PADDLE_SPEED * dt;
    if (keys.down) player.y += PADDLE_SPEED * dt;
  }
  clampPaddle(player);

  if (isLocalMode()) {
    if (keys.up) opponent.y -= PADDLE_SPEED * dt;
    if (keys.down) opponent.y += PADDLE_SPEED * dt;
  } else {
    const ai = DIFFICULTIES[difficultySelect.value] || DIFFICULTIES.normal;
    const aim = ball.y - PADDLE_HEIGHT / 2;
    const target = opponent.y + (aim - opponent.y) * ai.reaction;
    const diff = target - opponent.y;
    opponent.y += Math.sign(diff) * Math.min(Math.abs(diff), ai.speed * dt);
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

function draw() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  const background = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  background.addColorStop(0, "#0b1424");
  background.addColorStop(1, "#141d2c");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.strokeStyle = "#344258";
  ctx.lineWidth = 2;
  ctx.setLineDash([9, 12]);
  ctx.beginPath();
  ctx.moveTo(WIDTH / 2, 0);
  ctx.lineTo(WIDTH / 2, HEIGHT);
  ctx.stroke();
  ctx.setLineDash([]);

  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (let i = ball.trail.length - 1; i >= 0; i--) {
    const p = ball.trail[i];
    ctx.globalAlpha = (1 - i / ball.trail.length) * 0.22;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(p.x, p.y, BALL_RADIUS * (1 - i / (ball.trail.length + 2)), 0, Math.PI * 2);
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
  ctx.fillStyle = "#fff";
  ctx.shadowBlur = 16;
  ctx.shadowColor = "#fff";
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

loadSettings();
bestScoreDisplay.textContent = bestScore;
updateScore();
updateModeUI();
syncControls();
requestAnimationFrame(frame);
