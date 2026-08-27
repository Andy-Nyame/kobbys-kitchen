import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`select 1`;
    return NextResponse.json({ ok: true, status: "database_connected" });
  } catch (error) {
    console.error("[database-health]", { category: error?.code || "query_failed" });
    return NextResponse.json(
      { ok: false, status: "database_unavailable" },
      { status: 503 }
    );
  }
}
