import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hexToLab, paletteScore, type WeightedLab } from "@/lib/color";

export const dynamic = "force-dynamic";

// Infer Product from the actual Prisma call
type Product = Awaited<ReturnType<typeof prisma.product.findMany>>[number];

const Body = z.object({
  palette: z
    .array(z.object({ hex: z.string(), weight: z.number().min(0).max(1) }))
    .min(1),
  tolerance: z.number().min(5).max(80).default(20),
  filters: z.object({ category: z.string().optional() }).optional(),
});

export async function POST(req: NextRequest) {
  const json = await req.json();
  const { palette, tolerance, filters } = Body.parse(json);

  const qPalette: WeightedLab[] = palette.map((s) => ({
    ...hexToLab(s.hex),
    weight: s.weight,
  }));

  const products: Product[] = await prisma.product.findMany({
    where: {
      inStock: true,
      ...(filters?.category ? { category: filters.category } : {}),
    },
    take: 400,
  });

  const scored = products
    .map((p: Product) => {
      const pPalette: WeightedLab[] = Array.isArray(p.colorLab)
        ? (p.colorLab as unknown as WeightedLab[])
        : [];
      const score = paletteScore(pPalette, qPalette, tolerance);
      return { p, score };
    })
    .filter((x) => x.score > 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 48)
    .map(({ p, score }) => ({
      id: p.id,
      title: p.title,
      brand: p.brand ?? undefined,
      category: p.category ?? undefined,
      imageUrl: p.imageUrl,
      priceCents: p.priceCents,
      currency: p.currency,
      match: { colorScore: score },
    }));

  return NextResponse.json({ results: scored });
}
