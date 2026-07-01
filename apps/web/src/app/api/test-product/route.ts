import { NextResponse } from "next/server";
import { getProductBySlugCached } from "@/lib/core/cached";

export async function GET() {
  const p = await getProductBySlugCached("super-deluxe-ac-dc-ceiling-fan-dual-power");
  return NextResponse.json({ 
    variants: p?.variants.map(v => v.images) 
  });
}
