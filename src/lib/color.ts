// src/lib/color.ts
import DeltaE from "delta-e";
import { converter } from "culori";

// Lab shape expected by delta-e (uppercase keys inside the call)
export type Lab = { L: number; a: number; b: number };
export type WeightedLab = Lab & { weight: number };

// Culori converter to CIELAB (returns { l, a, b } with lowercase keys)
const toLab = converter("lab");

// Convert a HEX string (e.g., "#7e9a6c") to Lab
export function hexToLab(hex: string): Lab {
  const lab: any = toLab(hex); // culori returns { l, a, b }
  return { L: lab.l, a: lab.a, b: lab.b };
}

// CIEDE2000 distance using the 'delta-e' lib
function dE(l1: Lab, l2: Lab): number {
  return DeltaE.getDeltaE00(
    { L: l1.L, A: l1.a, B: l1.b },
    { L: l2.L, A: l2.a, B: l2.b }
  );
}

/**
 * Score in [0,1] measuring how well a product palette matches the query palette.
 * Uses best-match pairing per query swatch and an exp(-ΔE/τ) kernel.
 */
export function paletteScore(
  product: WeightedLab[],
  query: WeightedLab[],
  tolerance = 20
): number {
  if (!product?.length || !query?.length) return 0;

  let totalWeight = 0;
  let accum = 0;

  for (const q of query) {
    let best = Infinity;
    for (const p of product) best = Math.min(best, dE(p, q));
    const s = Math.exp(-best / Math.max(1, tolerance)); // [0,1]
    const w = Math.max(0, Math.min(1, q.weight ?? 0)); // clamp
    accum += s * w;
    totalWeight += w;
  }
  return totalWeight > 0 ? accum / totalWeight : 0;
}
