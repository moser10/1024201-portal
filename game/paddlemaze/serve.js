/** Serve: ball sits on the paddle until the player releases. */

export function heldBallPose(paddle, radius) {
  return {
    x: paddle.x + paddle.w / 2,
    y: paddle.y - radius - 1,
  };
}

export function launchVelocity(paddle, ballX, speed) {
  const hit = ((ballX - paddle.x) / Math.max(1, paddle.w) - 0.5) * 1.65;
  return {
    vx: Math.sin(hit) * speed,
    vy: -Math.abs(Math.cos(hit) * speed),
  };
}
