"use client";

import React from "react";
import Link from "next/link";

type CTAProps = {
  onJoin?: () => void;
};

export default function CTA({ onJoin }: CTAProps) {
  return (
    <div className="flex w-full flex-col items-center gap-6 text-center">
      <div className="text-2xl font-semibold">Education certifies attendance. Studi certifies ability.</div>
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <button
          className="rounded-full bg-black px-6 py-3 text-white shadow transition hover:bg-black/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
          onClick={onJoin}
        >
          Join beta
        </button>
        <Link
          prefetch
          href="/test-app"
          className="rounded-full border border-black/20 bg-white px-6 py-3 text-black shadow hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
        >
          Try the live demo again
        </Link>
      </div>
    </div>
  );
}


