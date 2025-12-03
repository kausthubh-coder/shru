"use client";

import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton, UserButton, Waitlist} from "@clerk/nextjs";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Header - Visible on Landing, different on Dashboard */}
      <Unauthenticated>
        <header className="w-full max-w-5xl mx-auto p-6 flex justify-between items-center z-10 relative">
          <div className="bg-[#F2F1EA] border border-black px-6 py-2 rounded-full flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-black"
            >
              <path
                d="M22 2L11 13"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M22 2L15 22L11 13L2 9L22 2Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="font-medium tracking-wide">Studi</span>
          </div>
          <div className="flex gap-6 text-sm font-medium">
            <button className="hover:underline">Pricing</button>
            <SignInButton mode="modal">
              <button className="hover:underline">Log In</button>
            </SignInButton>
          </div>
        </header>
      </Unauthenticated>

      <Authenticated>
        <header className="w-full border-b border-black/5 bg-[#F2F1EA]/50 backdrop-blur-sm sticky top-0 z-20">
          <div className="max-w-5xl mx-auto p-4 flex justify-between items-center">
            <div className="flex items-center gap-2 font-serif text-xl">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-black"
              >
                <path
                  d="M22 2L11 13"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M22 2L15 22L11 13L2 9L22 2Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Studi
            </div>
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>
      </Authenticated>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative z-0">
        <AuthLoading>
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-pulse text-gray-400">Loading Studi...</div>
          </div>
        </AuthLoading>

        <Authenticated>
          <div className="p-8">
            <Dashboard />
          </div>
        </Authenticated>

        <Unauthenticated>
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4 md:p-8 relative">
            {/* Decorative Elements */}
            <div className="absolute top-20 left-[15%] opacity-60 pointer-events-none font-serif italic text-xl">
              E=mc²
            </div>
            <div className="absolute top-32 right-[15%] opacity-80 pointer-events-none animate-[float_6s_ease-in-out_infinite]">
              <svg
                width="80"
                height="80"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-black rotate-12"
              >
                <path
                  d="M22 2L11 13"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M22 2L15 22L11 13L2 9L22 2Z"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="absolute bottom-40 left-[10%] opacity-60 pointer-events-none">
              <svg
                width="60"
                height="60"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-black"
              >
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1" />
                <path d="M12 2L12 22" stroke="currentColor" strokeWidth="1" />
                <path d="M2 12L22 12" stroke="currentColor" strokeWidth="1" />
                <path d="M12 12L19 5" stroke="currentColor" strokeWidth="1" />
              </svg>
            </div>

            <h1 className="font-serif text-6xl md:text-8xl text-[#0A0A0A] mb-6 leading-[0.9] tracking-tight max-w-4xl">
              Bring your learning <br />
              <span className="italic">to life.</span>
            </h1>
            
            <p className="text-lg md:text-xl text-gray-600 max-w-xl mb-16 font-light">
              Enhance your education with Studi&apos;s AI-Powered Education platform
            </p>

            {/* Waitlist Card */}
            <div className="relative z-10">
              <Waitlist />
            </div>
          </div>
        </Unauthenticated>
      </div>
    </main>
  );
}
