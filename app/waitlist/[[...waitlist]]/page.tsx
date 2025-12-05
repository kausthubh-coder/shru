"use client";

import { Waitlist } from "@clerk/nextjs";

export default function WaitlistPage() {
  return (
    <div className="min-h-screen bg-[#f2f1ea] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Waitlist />
      </div>
    </div>
  );
}


