"use client";

import { useState } from "react";
import { SignUpButton } from "@clerk/nextjs";

/**
 * Simple waitlist call-to-action that opens Clerk signup.
 * Replace with your own waitlist flow if needed.
 */
export default function Waitlist() {
  const [hover, setHover] = useState(false);

  return (
    <div className="bg-[#F2F1EA] border border-black/5 rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,0.1)] p-6 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">
            Join the waitlist
          </p>
          <h3 className="text-2xl font-serif text-black">Get early access</h3>
        </div>
      </div>
      <p className="text-gray-700 mb-6">
        Sign up to be notified when new features and beta slots open.
      </p>
      <SignUpButton mode="modal">
        <button
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          className="w-full bg-black text-white px-5 py-3 rounded-full font-medium transition transform"
          style={{
            transform: hover ? "translateY(-2px)" : "translateY(0)",
            boxShadow: hover
              ? "6px 6px 0px 0px rgba(0,0,0,0.15)"
              : "4px 4px 0px 0px rgba(0,0,0,0.12)",
          }}
        >
          Join now
        </button>
      </SignUpButton>
    </div>
  );
}

