// worker/ingest.ts
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { converter } from "culori";
import { prisma } from "../src/lib/prisma";

// Types
type Lab = { L: number; a: number; b: number };
type WeightedLab = Lab & { weight: number };

// Culori converter (returns { l, a, b } in [0..100]/[-..] ranges)
const toLab = converter("lab");

// Convert RGB [0..255] to Lab using culori
function rgbToLab([r, g, b]: [number, number, number]): Lab {
  const lab: any = toLab({ mode: "rgb", r: r / 255, g: g / 255, b: b / 255 });
  return { L: lab.l, a: lab.a, b: lab.b };
}

/**
 * Extract a palette from an image using sharp + simple K-means in Lab space.
 * @param filePath path to image file
 * @param k number of clusters (dominant colors)
 * @param maxSamples max pixels to sample for speed
 */
async function extractPalette(filePath: string, k = 6, maxSamples = 8000): Promise<WeightedLab[]> {
  // Downscale to reduce work; keep aspect
  const resized = await sharp(filePath).resize({ width: 200, withoutEnlargement: true }).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const { data, info } = resized; // data: RGBA
  const { width, height, channels } = info; // channels = 4

  // Collect RGB pixels (skip fully transparent)
  const pixels: [number, number, number][] = [];
  for (let i = 0; i < data.length; i += channels) {
    const a = data[i + 3];
    if (a === 0) continue;
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }

  // Randomly sample up to maxSamples for speed
  if (pixels.length > maxSamples) {
    for (let i = pixels.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pixels[i], pixels[j]] = [pixels[j], pixels[i]];
    }
    pixels.length = maxSamples;
  }

  // Convert to Lab
  const labs: Lab[] = pixels.map(rgbToLab);

  // --- K-means in Lab space
  if (labs.length === 0) return [];

  // init centroids by random pick
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
    // assign
    let moved = 0;
    for (let i = 0; i < labs.length; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const d = dist2(labs[i], centroids[c]);
        if (d < bestD) { bestD = d; best = c; }
      }
      if (assignments[i] !== best) { assignments[i] = best; moved++; }
    }
    // recompute centroids
    const sum: { L: number; a: number; b: number; n: number }[] = centroids.map(() => ({ L: 0, a: 0, b: 0, n: 0 }));
    for (let i = 0; i < labs.length; i++) {
      const c = assignments[i];
      const p = labs[i];
      sum[c].L += p.L; sum[c].a += p.a; sum[c].b += p.b; sum[c].n++;
    }
    for (let c = 0; c < centroids.length; c++) {
      if (sum[c].n > 0) {
        centroids[c] = { L: sum[c].L / sum[c].n, a: sum[c].a / sum[c].n, b: sum[c].b / sum[c].n };
      }
    }
    if (moved === 0) break;
  }

  // Build weighted palette, drop empty clusters, sort by weight desc
  const counts = new Array<number>(centroids.length).fill(0);
  for (const c of assignments) counts[c]++;

  const total = counts.reduce((s, n) => s + n, 0) || 1;

  const palette = centroids
    .map((lab, i) => ({ ...lab, weight: counts[i] / total }))
    .filter(sw => sw.weight > 0.02) // drop tiny clusters
    .sort((a, b) => b.weight - a.weight);

  // Normalize weights to sum to 1
  const wsum = palette.reduce((s, w) => s + w.weight, 0) || 1;
  return palette.map(w => ({ ...w, weight: w.weight / wsum }));
}

async function run() {
  const samplesDir = path.join(process.cwd(), "public", "samples");
  await fs.mkdir(samplesDir, { recursive: true });

  const files = (await fs.readdir(samplesDir)).filter((f) => /\.(jpg|jpeg|png)$/i.test(f));
  if (!files.length) {
    console.log("No images found in public/samples. Add a few JPG/PNG files and rerun.");
    return;
  }

  for (const [i, file] of files.entries()) {
    const full = path.join(samplesDir, file);
    const colorLab = await extractPalette(full, 6);

    await prisma.product.upsert({
      where: { id: `sample_${i}` },
      update: { colorLab },
      create: {
        id: `sample_${i}`,
        title: file.replace(/\.[^.]+$/, "").replace(/[_-]/g, " "),
        brand: "Sample",
        category: i % 2 ? "dress" : "top",
        priceCents: 5999 + i * 100,
        currency: "USD",
        imageUrl: `/samples/${file}`,
        inStock: true,
        colorLab
      }
    });
  }

  console.log(`Seeded ${files.length} products.`);
}

run().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
