const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreDisplay = document.getElementById("score");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 96;
const PADDLE_MARGIN = 28;
const BALL_RADIUS = 9;
const PLAYER_SPEED = 420;
const AI_SPEED = 330;

const player = { x: PADDLE_MARGIN, y: (HEIGHT - PADDLE_HEIGHT) / 2 };
const computer = {
  x: WIDTH - PADDLE_MARGIN - PADDLE_WIDTH,
  y: (HEIGHT - PADDLE_HEIGHT) / 2
};
const ball = { x: WIDTH / 2, y: HEIGHT / 2, vx: 0, vy: 0 };

let playerScore = 0;
let computerScore = 0;
let upPressed = false;
let downPressed = false;
let lastTime = 0;

function clampPaddle(paddle) {
  paddle.y = Math.max(0, Math.min(HEIGHT - PADDLE_HEIGHT, paddle.y));
}

function resetBall(direction) {
  ball.x = WIDTH / 2;
  ball.y = HEIGHT / 2;
  const angle = Math.random() * 0.7 - 0.35;
  const speed = 360;
  ball.vx = Math.cos(angle) * speed * direction;
  ball.vy = Math.sin(angle) * speed;
}

function updateScore() {
  scoreDisplay.textContent = `${playerScore} – ${computerScore}`;
}

function handlePointer(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleY = HEIGHT / rect.height;
  player.y = (event.clientY - rect.top) * scaleY - PADDLE_HEIGHT / 2;
  clampPaddle(player);
}

canvas.addEventListener("pointermove", handlePointer);
canvas.addEventListener("pointerdown", (event) => {
  canvas.focus();
  handlePointer(event);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    event.preventDefault();
    if (event.key === "ArrowUp") upPressed = true;
    if (event.key === "ArrowDown") downPressed = true;
  }
});

document.addEventListener("keyup", (event) => {
  if (event.key === "ArrowUp") upPressed = false;
  if (event.key === "ArrowDown") downPressed = false;
});

function hitPaddle(paddle, isPlayer) {
  const overlapsY =
    ball.y + BALL_RADIUS > paddle.y &&
    ball.y - BALL_RADIUS < paddle.y + PADDLE_HEIGHT;
  const overlapsX =
    ball.x + BALL_RADIUS > paddle.x &&
    ball.x - BALL_RADIUS < paddle.x + PADDLE_WIDTH;

  if (!overlapsX || !overlapsY) return;

  // Only bounce when the ball is moving into the paddle.
  if ((isPlayer && ball.vx < 0) || (!isPlayer && ball.vx > 0)) {
    const paddleCenter = paddle.y + PADDLE_HEIGHT / 2;
    const hitOffset = (ball.y - paddleCenter) / (PADDLE_HEIGHT / 2);
    const angle = hitOffset * (Math.PI / 3);
    const speed = Math.min(Math.hypot(ball.vx, ball.vy) * 1.05, 700);
    const direction = isPlayer ? 1 : -1;

    ball.vx = Math.cos(angle) * speed * direction;
    ball.vy = Math.sin(angle) * speed;

    // Keep the ball just outside the paddle after the bounce.
    ball.x = isPlayer
      ? paddle.x + PADDLE_WIDTH + BALL_RADIUS
      : paddle.x - BALL_RADIUS;
  }
}

function update(delta) {
  const dt = Math.min(delta, 0.03);

  if (upPressed) player.y -= PLAYER_SPEED * dt;
  if (downPressed) player.y += PLAYER_SPEED * dt;
  clampPaddle(player);

  // The computer tracks the ball, but moves at a limited speed.
  const targetY = ball.y - PADDLE_HEIGHT / 2;
  const difference = targetY - computer.y;
  const step = AI_SPEED * dt;
  computer.y += Math.sign(difference) * Math.min(Math.abs(difference), step);
  clampPaddle(computer);

  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  if (ball.y - BALL_RADIUS <= 0) {
    ball.y = BALL_RADIUS;
    ball.vy = Math.abs(ball.vy);
  } else if (ball.y + BALL_RADIUS >= HEIGHT) {
    ball.y = HEIGHT - BALL_RADIUS;
    ball.vy = -Math.abs(ball.vy);
  }

  hitPaddle(player, true);
  hitPaddle(computer, false);

  if (ball.x + BALL_RADIUS < 0) {
    playerScore++;
    updateScore();
    resetBall(1);
  } else if (ball.x - BALL_RADIUS > WIDTH) {
    computerScore++;
    updateScore();
    resetBall(-1);
  }
}

function draw() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  // Dashed center line
  ctx.strokeStyle = "#354258";
  ctx.setLineDash([10, 12]);
  ctx.beginPath();
  ctx.moveTo(WIDTH / 2, 0);
  ctx.lineTo(WIDTH / 2, HEIGHT);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#57e3c2";
  ctx.fillRect(player.x, player.y, PADDLE_WIDTH, PADDLE_HEIGHT);

  ctx.fillStyle = "#f4f7fb";
  ctx.fillRect(computer.x, computer.y, PADDLE_WIDTH, PADDLE_HEIGHT);

  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fill();
}

function frame(time) {
  const delta = lastTime ? (time - lastTime) / 1000 : 0;
  lastTime = time;
  update(delta);
  draw();
  requestAnimationFrame(frame);
}

resetBall(Math.random() < 0.5 ? -1 : 1);
requestAnimationFrame(frame);
