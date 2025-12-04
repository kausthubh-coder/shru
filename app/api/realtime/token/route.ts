import { NextResponse } from "next/server";

function getConvexSiteURL(): string {
  const site =
    process.env.CONVEX_SITE_URL ?? process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (!site) {
    throw new Error("CONVEX_SITE_URL is not configured");
  }
  return site.replace(/\/$/, "");
}

export async function GET() {
  try {
    const site = getConvexSiteURL();
    const target = `${site}/realtime/token`;
    const res = await fetch(target, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}


