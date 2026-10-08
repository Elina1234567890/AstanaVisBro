import { ORB_CONFIG } from "./orbConfig";

export type WallAxis = "x" | "y";

export function wallAxisFromBounds(bounds: { min: { x: number; y: number }; max: { x: number; y: number } }): WallAxis {
  return bounds.max.x - bounds.min.x > bounds.max.y - bounds.min.y ? "y" : "x";
}

export function wallSpringScale(ageMs: number, strength: number, axis: WallAxis) {
  const duration = ORB_CONFIG.effects.wallSpringMs;
  if (ageMs < 0 || ageMs >= duration) return { x: 1, y: 1 };
  const progress = ageMs / duration;
  const envelope = 1 - progress;
  const wave = Math.cos(progress * Math.PI * 3);
  const deformation = Math.min(1, Math.max(0, strength)) * ORB_CONFIG.effects.wallSquash * envelope * wave;
  const normal = 1 - deformation;
  const tangent = 1 + deformation * 0.48;
  return axis === "x" ? { x: normal, y: tangent } : { x: tangent, y: normal };
}

export function wallSpinVelocity(axis: WallAxis, velocity: { x: number; y: number }, current: number) {
  const tangentSpeed = axis === "x" ? velocity.y : -velocity.x;
  const requested = current + tangentSpeed * ORB_CONFIG.effects.wallSpinFactor;
  return Math.max(-ORB_CONFIG.effects.maxSpin, Math.min(ORB_CONFIG.effects.maxSpin, requested));
}
