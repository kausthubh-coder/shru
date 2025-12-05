import { NextResponse } from "next/server";

function toSiteUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    // If user passed the cloud URL, rewrite to site.
    const host = u.host.replace("convex.cloud", "convex.site");
    return `${u.protocol}//${host}`;
  } catch {
    return null;
  }
}

function getConvexSiteURL(): string {
  const explicit =
    process.env.CONVEX_SITE_URL ?? process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  const cloudish = process.env.NEXT_PUBLIC_CONVEX_URL;
  const derived = toSiteUrl(cloudish);
  const chosen = explicit ?? derived;
  if (!chosen) {
    throw new Error(
      "Convex site URL not configured. Set CONVEX_SITE_URL or NEXT_PUBLIC_CONVEX_SITE_URL (or NEXT_PUBLIC_CONVEX_URL).",
    );
  }
  return chosen.replace(/\/$/, "");
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



