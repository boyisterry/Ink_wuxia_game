export type GateCollisionGround = {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: "solid" | "oneway";
  slopeEndY?: number;
  requiresJump?: boolean;
};

export type GateWallCollisionOptions = {
  autoStepHeight: number;
  playerHalfWidth: number;
  collisionSkin: number;
};

export const GATE_WALL_COLLISION = {
  autoStepHeight: 36,
  playerHalfWidth: 30,
  collisionSkin: 0.01,
} as const satisfies GateWallCollisionOptions;

export const gateCollisionTopAt = (
  ground: GateCollisionGround,
  x: number,
) => {
  if (ground.slopeEndY === undefined || ground.w === 0) return ground.y;
  const progress = Math.max(0, Math.min(1, (x - ground.x) / ground.w));
  return ground.y + (ground.slopeEndY - ground.y) * progress;
};

/**
 * Sweeps the player's foot capsule against solid retaining-wall faces.
 * Feet on/above a tread may cross it; feet below it must stop at the face.
 */
export const clampGateSolidWall = (
  grounds: readonly GateCollisionGround[],
  fromX: number,
  toX: number,
  footY: number,
  options: GateWallCollisionOptions,
): number | null => {
  if (toX === fromX) return null;
  const movingRight = toX > fromX;
  let blocked: number | null = null;

  for (const ground of grounds) {
    if (ground.kind !== "solid") continue;
    const faceX = movingRight ? ground.x : ground.x + ground.w;
    const fromEdge = movingRight
      ? fromX + options.playerHalfWidth
      : fromX - options.playerHalfWidth;
    const toEdge = movingRight
      ? toX + options.playerHalfWidth
      : toX - options.playerHalfWidth;
    const crosses = movingRight
      ? fromEdge <= faceX && toEdge > faceX
      : fromEdge >= faceX && toEdge < faceX;
    if (!crosses) continue;

    const top = gateCollisionTopAt(
      ground,
      Math.max(ground.x, Math.min(ground.x + ground.w, faceX)),
    );
    if (footY <= top + options.collisionSkin) continue;
    if (!ground.requiresJump && footY <= top + options.autoStepHeight) continue;
    if (footY >= top + ground.h) continue;

    const stopX = movingRight
      ? faceX - options.playerHalfWidth - options.collisionSkin
      : faceX + options.playerHalfWidth + options.collisionSkin;
    blocked =
      blocked === null
        ? stopX
        : movingRight
          ? Math.min(blocked, stopX)
          : Math.max(blocked, stopX);
  }

  return blocked;
};
