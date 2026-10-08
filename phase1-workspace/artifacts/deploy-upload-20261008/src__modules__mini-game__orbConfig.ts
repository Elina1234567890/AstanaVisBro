export const ORB_CONFIG = {
  board: {
    width: 420, height: 680, wallThickness: 18,
    launcher: { centerX: 210, centerY: 620, laneStep: 12, grabRadius: 58 },
    shot: { minPull: 8, maxPull: 54, minSpeed: 5, maxSpeed: 15, maxAngle: 0.85 },
    blockedHoldMs: 4500,
    nextOrbTiers: [1, 1, 1, 1, 2, 2, 3]
  },
  physics: { gravityX: 0, gravityY: 0, restitution: 0.86, friction: 0.018, frictionAir: 0.024, density: 0.001, slop: 0.015, positionIterations: 10, velocityIterations: 8, maxDeltaMs: 24, mergeMomentumRetention: 0.58, mergeContactTolerance: 2 },
  effects: { particlesPerMerge: 9, contactParticles: 5, particleLifeMs: 520, shakeMs: 160, contactShakeMs: 85, contactSoundCooldownMs: 180, contactVibrationMs: 7, shakePx: 4, spawnGlowMs: 260, impactFlashMs: 140, wallSpringMs: 360, wallSquash: 0.22, wallSpinFactor: 0.018, launchSpin: 0.075, maxSpin: 0.2 },
  tiers: [
    { tier: 1, radius: 18, color: "#ff5b92", stroke: "#751d4c", image: "/assets/orb-merge/tier-1.webp", mass: 0.72, bounce: 0.9, mergeValue: 1 },
    { tier: 2, radius: 23, color: "#fff4dc", stroke: "#8b4866", image: "/assets/orb-merge/tier-2.webp", mass: 0.92, bounce: 0.88, mergeValue: 2 },
    { tier: 3, radius: 29, color: "#ff4f91", stroke: "#7b1848", image: "/assets/orb-merge/tier-3.webp", mass: 1.15, bounce: 0.86, mergeValue: 4 },
    { tier: 4, radius: 36, color: "#ffda42", stroke: "#84324d", image: "/assets/orb-merge/tier-4.webp", mass: 1.45, bounce: 0.84, mergeValue: 8 },
    { tier: 5, radius: 44, color: "#ffcf27", stroke: "#8d274e", image: "/assets/orb-merge/tier-5.webp", mass: 1.85, bounce: 0.82, mergeValue: 16 },
    { tier: 6, radius: 53, color: "#ff547f", stroke: "#7c213f", image: "/assets/orb-merge/tier-6.webp", mass: 2.3, bounce: 0.8, mergeValue: 32 },
    { tier: 7, radius: 63, color: "#e62067", stroke: "#74153c", image: "/assets/orb-merge/tier-7.webp", mass: 2.9, bounce: 0.78, mergeValue: 64 },
    { tier: 8, radius: 74, color: "#ff4f93", stroke: "#791d51", image: "/assets/orb-merge/tier-8.webp", mass: 3.6, bounce: 0.76, mergeValue: 128 },
    { tier: 9, radius: 86, color: "#ff4e8d", stroke: "#812550", image: "/assets/orb-merge/tier-9.webp", mass: 4.5, bounce: 0.74, mergeValue: 256 },
    { tier: 10, radius: 98, color: "#ffcf26", stroke: "#8b204c", image: "/assets/orb-merge/tier-10.webp", mass: 5.5, bounce: 0.72, mergeValue: 512 },
  ],
} as const;

export type OrbTier = (typeof ORB_CONFIG.tiers)[number]["tier"];
export function orbTier(tier: number) {
  return ORB_CONFIG.tiers[Math.max(0, Math.min(ORB_CONFIG.tiers.length - 1, tier - 1))]!;
}

export interface MergeNode { id: number; tier: number }
export interface MergeEdge { a: number; b: number }
export interface MergeGroup { tier: number; ids: number[] }

/** Returns deterministic, disjoint groups of exactly three equal-tier orbs connected by touching chains. */
export function findMergeGroups(nodes: MergeNode[], edges: MergeEdge[]): MergeGroup[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const neighbors = new Map<number, Set<number>>();
  for (const node of nodes) neighbors.set(node.id, new Set());
  for (const { a, b } of edges) {
    const left = byId.get(a), right = byId.get(b);
    if (!left || !right || left.tier !== right.tier || left.tier >= ORB_CONFIG.tiers.length || a === b) continue;
    neighbors.get(a)!.add(b);
    neighbors.get(b)!.add(a);
  }
  const seen = new Set<number>(), groups: MergeGroup[] = [];
  for (const root of [...byId.keys()].sort((a, b) => a - b)) {
    if (seen.has(root)) continue;
    const component: number[] = [], queue = [root]; seen.add(root);
    while (queue.length) {
      const id = queue.shift()!; component.push(id);
      for (const next of neighbors.get(id) ?? []) if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
    component.sort((a, b) => a - b);
    const remaining = new Set(component);
    // Pick a connected triple from each component. This supports chains (A touches B, B touches C)
    // while ensuring a large cluster is split into valid, non-overlapping triples.
    while (remaining.size >= 3) {
      let chosen: number[] | undefined;
      const candidates = [...remaining].sort((a, b) => a - b);
      for (const a of candidates) {
        for (const b of [...(neighbors.get(a) ?? [])].filter((id) => remaining.has(id)).sort((x, y) => x - y)) {
          for (const c of [...new Set([...(neighbors.get(a) ?? []), ...(neighbors.get(b) ?? [])])].filter((id) => id !== a && id !== b && remaining.has(id)).sort((x, y) => x - y)) {
            chosen = [a, b, c].sort((x, y) => x - y); break;
          }
          if (chosen) break;
        }
        if (chosen) break;
      }
      if (!chosen) break;
      chosen.forEach((id) => remaining.delete(id));
      groups.push({ tier: byId.get(chosen[0]!)!.tier, ids: chosen });
    }
  }
  return groups;
}
