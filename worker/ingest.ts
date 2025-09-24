// worker/ingest.ts
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "../src/lib/prisma";

// ---------- Types
type Lab = { L: number; a: number; b: number };
type WeightedLab = Lab & { weight: number };

// ---------- RGB -> LAB helpers (no external deps)
// sRGB [0..255] -> linear
function toLinear(u: number) {
  const x = u / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}
// linear RGB -> XYZ (D65), then XYZ -> LAB
function rgbToLab([r, g, b]: [number, number, number]): Lab {
  const R = toLinear(r), G = toLinear(g), B = toLinear(b);
  const X = R * 0.4124564 + G * 0.3575761 + B * 0.1804375;
  const Y = R * 0.2126729 + G * 0.7151522 + B * 0.0721750;
  const Z = R * 0.0193339 + G * 0.1191920 + B * 0.9503041;
  const xr = X / 0.95047, yr = Y / 1.0, zr = Z / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : (7.787 * t + 16 / 116));
  const fx = f(xr), fy = f(yr), fz = f(zr);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

// ---------- Palette extraction with K-means in LAB space
async function extractPalette(filePath: string, k = 6, maxSamples = 8000): Promise<WeightedLab[]> {
  const { data, info } = await sharp(filePath)
    .resize({ width: 200, withoutEnlargement: true })
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });

  // Collect opaque RGB pixels
  const pixels: [number, number, number][] = [];
  for (let i = 0; i < info.size; i += info.channels) {
    if (data[i + 3] === 0) continue; // skip fully transparent
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }

  // Downsample for speed
  if (pixels.length > maxSamples) {
    for (let i = pixels.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pixels[i], pixels[j]] = [pixels[j], pixels[i]];
    }
    pixels.length = maxSamples;
  }

  const labs: Lab[] = pixels.map(rgbToLab);
  if (!labs.length) return [];

  // Init centroids by sampling
  const centroids: Lab[] = [];
  const used = new Set<number>();
  while (centroids.length < Math.min(k, labs.length)) {
    const idx = Math.floor(Math.random() * labs.length);
    if (!used.has(idx)) {
      centroids.push({ ...labs[idx] });
      used.add(idx);
    }
  }

  const MAX_ITERS = 12;
  const assignments = new Array<number>(labs.length).fill(0);
  const dist2 = (a: Lab, b: Lab) => {
    const dL = a.L - b.L, da = a.a - b.a, db = a.b - b.b;
    return dL * dL + da * da + db * db;
  };

  for (let it = 0; it < MAX_ITERS; it++) {
    // Assign points to nearest centroid
    let moved = 0;
    for (let i = 0; i < labs.length; i++) {
      let best = 0, bestD = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const d = dist2(labs[i], centroids[c]);
        if (d < bestD) { bestD = d; best = c; }
      }
      if (assignments[i] !== best) { assignments[i] = best; moved++; }
    }
    // Recompute centroids
    const sum = centroids.map(() => ({ L: 0, a: 0, b: 0, n: 0 }));
    for (let i = 0; i < labs.length; i++) {
      const c = assignments[i], p = labs[i];
      sum[c].L += p.L; sum[c].a += p.a; sum[c].b += p.b; sum[c].n++;
    }
    for (let c = 0; c < centroids.length; c++) {
      if (sum[c].n) centroids[c] = { L: sum[c].L / sum[c].n, a: sum[c].a / sum[c].n, b: sum[c].b / sum[c].n };
    }
    if (!moved) break;
  }

  // Build weighted palette
  const counts = new Array<number>(centroids.length).fill(0);
  for (const c of assignments) counts[c]++;
  const total = counts.reduce((s, n) => s + n, 0) || 1;

  const palette = centroids
    .map((lab, i) => ({ ...lab, weight: counts[i] / total }))
    .filter(sw => sw.weight > 0.02) // drop tiny clusters
    .sort((a, b) => b.weight - a.weight);

  // Normalize weights
  const wsum = palette.reduce((s, w) => s + w.weight, 0) || 1;
  return palette.map(w => ({ ...w, weight: w.weight / wsum }));
}

async function run() {
  const samplesDir = path.join(process.cwd(), "public", "samples");
  await fs.mkdir(samplesDir, { recursive: true });

  // IMPORTANT: trim stray spaces in filenames
  const files = (await fs.readdir(samplesDir))
    .map(f => f.trim())
    .filter(f => /\.(jpg|jpeg|png)$/i.test(f));

  if (!files.length) {
    console.log("No images found in public/samples. Add a few JPG/PNG files and rerun.");
    return;
  }

  for (const [i, file] of files.entries()) {
    const full = path.join(samplesDir, file);
    const colorLab = await extractPalette(full, 6);

    await prisma.product.upsert({
      where: { id: `sample_${i}` },
      update: {
        // your schema uses STRING columns for JSON-like fields
        colorLab: JSON.stringify(colorLab),
      },
      create: {
        id: `sample_${i}`,
        title: file.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ").trim(),
        brand: "Sample",
        category: i % 2 ? "dress" : "top",
        priceCents: 5999 + i * 100,
        currency: "USD",
        imageUrl: `/samples/${file.trim()}`,
        inStock: true,
        colorLab: JSON.stringify(colorLab), // <-- stringified
        sizes: null,
        attributes: null,
      },
    });
  }

  console.log(`Seeded ${files.length} products.`);
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
