export const ORB_BALANCE = {
  tierScore: { 2: 10, 3: 25, 4: 60, 5: 140, 6: 300, 7: 650, 8: 1400, 9: 3000, 10: 6500 } as Record<number, number>,
  milestoneScore: { 4: 50, 5: 150, 6: 400, 7: 1000, 8: 2500 } as Record<number, number>,
  combo: { windowMs: 1500, multipliers: [1, 1.2, 1.4, 1.6, 1.8, 2], maxMultiplier: 2 },
  chain: { multipliers: [1, 1.25, 1.5, 1.75, 2], maxMultiplier: 2 },
  maxMultiplier: 3,
} as const;
