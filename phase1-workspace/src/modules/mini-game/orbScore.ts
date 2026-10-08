import { ORB_BALANCE as balance } from "./orbBalance";

export interface MergeCause { actionId: number; depth: number }
/** Only descendants of the current shot continue its chain. Parallel branches share depth. */
export function mergeCause(members: MergeCause[], actionId: number): MergeCause {
  return { actionId, depth: 1 + Math.max(0, ...members.filter(m => m.actionId === actionId).map(m => m.depth)) };
}

export class OrbScore {
  score = 0;
  combo = 0;
  lastAt: number | null = null;
  milestones = new Set<number>();

  expire(now: number) {
    if (this.lastAt !== null && now - this.lastAt > balance.combo.windowMs) this.combo = 0;
    return this.combo;
  }

  merge(createdTier: number, chainDepth: number, now: number) {
    const base = balance.tierScore[createdTier];
    if (base === undefined) throw new Error(`Missing score balance for Tier ${createdTier}`);
    this.expire(now);
    this.combo += 1;
    this.lastAt = now;
    const comboMultiplier = Math.min(balance.combo.maxMultiplier, balance.combo.multipliers[Math.min(this.combo - 1, balance.combo.multipliers.length - 1)]!);
    const chainMultiplier = Math.min(balance.chain.maxMultiplier, balance.chain.multipliers[Math.max(0, Math.min(chainDepth - 1, balance.chain.multipliers.length - 1))]!);
    const multiplier = Math.min(balance.maxMultiplier, comboMultiplier * chainMultiplier);
    const earned = Math.round(base * multiplier);
    const milestone = this.milestones.has(createdTier) ? 0 : (balance.milestoneScore[createdTier] ?? 0);
    this.milestones.add(createdTier);
    this.score += earned + milestone;
    return { earned, milestone, multiplier, combo: this.combo, score: this.score };
  }
}
