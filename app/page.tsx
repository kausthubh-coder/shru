"use client";

import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton, UserButton, Waitlist } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

// Lazy-load the dashboard to keep the landing payload small
const Dashboard = dynamic(() => import("@/components/Dashboard"), {
  loading: () => (
    <div className="min-h-[240px] rounded-xl border-2 border-black bg-[#F2F1EA] p-6 text-center text-gray-500">
      Loading dashboard...
    </div>
  ),
});

export default function Home() {
  const parallaxRef = useRef<HTMLDivElement>(null);
  const [hoveredIcon, setHoveredIcon] = useState<string | null>(null);
  // Prevent hydration mismatch by only rendering Clerk component on client
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    const handleMouseMove = (e: MouseEvent) => {
      if (parallaxRef.current) {
        // Only apply parallax on md screens and up to avoid confusion on touch devices
        if (window.innerWidth < 768) return;

        const elements = parallaxRef.current.querySelectorAll(".parallax-icon");
        elements.forEach((element) => {
          const htmlElement = element as HTMLElement;
          const rect = htmlElement.getBoundingClientRect();
          const elementCenterX = rect.left + rect.width / 2;
          const elementCenterY = rect.top + rect.height / 2;

          // Calculate distance between cursor and element center
          const distanceX = e.clientX - elementCenterX;
          const distanceY = e.clientY - elementCenterY;
          const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

          // Base movement parameters
          const depth = Number.parseFloat(element.getAttribute("data-depth") || "1");
          const baseSpeed = 0.015 * depth;

          // Proximity effect - icons move away from cursor when close
          const proximityThreshold = 300;
          let proximityFactor = 0;

          if (distance < proximityThreshold) {
            proximityFactor = (1 - distance / proximityThreshold) * 10;
          }

          // Calculate movement based on mouse position and proximity
          const moveX = -distanceX * baseSpeed - (distanceX / distance || 0) * proximityFactor;
          const moveY = -distanceY * baseSpeed - (distanceY / distance || 0) * proximityFactor;

          // Apply the transformation
          htmlElement.style.transform = `translate(${moveX}px, ${moveY}px)`;
        });
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const handleIconHover = (id: string) => {
    setHoveredIcon(id);
  };

  const handleIconLeave = () => {
    setHoveredIcon(null);
  };

  return (
    <main className="min-h-screen flex flex-col relative overflow-hidden bg-[#E8E1D6]" ref={parallaxRef}>
      {/* Auth Loading State */}
      <AuthLoading>
        <div className="absolute inset-0 flex items-center justify-center bg-[#E8E1D6] z-50">
          <div className="animate-pulse text-gray-400 font-medium">Loading Studi...</div>
        </div>
      </AuthLoading>

      {/* Shared Grid Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div 
          className="absolute inset-0 opacity-10" 
          style={{
            backgroundImage: `linear-gradient(#000000 1px, transparent 1px), linear-gradient(90deg, #000000 1px, transparent 1px)`,
            backgroundSize: '24px 24px'
          }}
        />
        <div className="absolute inset-0 bg-radial-gradient from-transparent to-[#E8E1D6]/80"></div>
      </div>

      {/* Authenticated View - Dashboard */}
      <Authenticated>
        <div className="min-h-screen flex flex-col relative z-10">
          {/* Minimalist Paper Navbar */}
          <header className="w-full border-b-2 border-black bg-[#F2F1EA] relative z-20">
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2 group">
                <div className="w-6 h-6 transition-transform duration-300 ease-out group-hover:scale-110">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
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
                </div>
                <span className="text-xl font-bold font-serif tracking-tight">Studi</span>
              </Link>
              
              <div className="flex items-center gap-4">
                <div className="h-6 w-px bg-black/10 mx-2"></div>
                <UserButton 
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      avatarBox: "w-9 h-9 border border-black"
                    }
                  }}
                />
              </div>
            </div>
          </header>
          
          <div className="flex-1 p-4 md:p-8">
            <Dashboard />
          </div>
        </div>
      </Authenticated>

      {/* Unauthenticated View - Landing Page */}
      <Unauthenticated>
        {/* Floating Navigation */}
        <header className="w-full pt-6 pb-4 px-4 relative z-20 shrink-0">
          <nav className="flex items-center justify-between bg-[#E8E1D6]/80 backdrop-blur-sm border-2 border-black rounded-full px-6 py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-w-5xl mx-auto transition-all hover:-translate-y-0.5">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-6 h-6 transition-transform duration-300 ease-out group-hover:scale-110">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                  <path
                    d="M22 2L11 13"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M22 2L15 22L11 13L2 9L22 2Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <span className="text-xl font-medium font-serif">Studi</span>
            </Link>
            <div className="flex items-center gap-8 text-sm font-medium">
              <Link href="/" className="text-gray-700 hover:text-black transition-colors duration-300">
                Pricing
              </Link>
              <SignInButton mode="modal">
                <button className="text-gray-700 hover:text-black transition-colors duration-300">
                  Log In
                </button>
              </SignInButton>
            </div>
          </nav>
        </header>

        {/* Hero Section - Centered Flex Container */}
        <div className="flex-1 flex flex-col items-center justify-center relative px-4 py-8 min-h-0">
          <div className="max-w-5xl w-full relative flex flex-col items-center justify-center">
            
            {/* Strategic Illustrations - Parallax Icons */}
            
            {/* Paper Plane (large) */}
            <div
              className={`absolute -right-8 -top-12 md:right-[5%] md:top-[0%] parallax-icon transition-all duration-700 ease-out z-10 scale-75 md:scale-100 ${hoveredIcon === "plane" ? "translate-x-5 -translate-y-5" : ""}`}
              data-depth="1.2"
              onMouseEnter={() => handleIconHover("plane")}
              onMouseLeave={handleIconLeave}
            >
              <svg
                width="120"
                height="120"
                viewBox="0 0 120 120"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="cursor-pointer drop-shadow-lg"
              >
                <path
                  d="M15 42.5L105 10L72.5 100L55 62.5L15 42.5Z"
                  stroke="black"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="fill-white/50"
                />
              </svg>
            </div>

            {/* Compass */}
            <div
              className={`absolute -left-4 top-0 md:left-[2%] md:top-[20%] parallax-icon transition-all duration-1000 ease-out z-10 scale-75 md:scale-100 ${hoveredIcon === "compass" ? "rotate-45" : ""}`}
              data-depth="0.8"
              onMouseEnter={() => handleIconHover("compass")}
              onMouseLeave={handleIconLeave}
            >
              <svg
                width="60"
                height="60"
                viewBox="0 0 60 60"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="cursor-pointer opacity-70"
              >
                <circle cx="30" cy="30" r="25" stroke="black" strokeWidth="1.5" className="fill-white/30"/>
                <path d="M30 10L35 30L30 50L25 30L30 10Z" stroke="black" strokeWidth="1.5" />
                <path d="M10 30L30 25L50 30L30 35L10 30Z" stroke="black" strokeWidth="1.5" />
                <circle cx="30" cy="30" r="3" stroke="black" strokeWidth="1" />
              </svg>
            </div>

            {/* Atom */}
            <div
              className={`absolute right-0 -bottom-8 md:right-[5%] md:bottom-[10%] parallax-icon transition-all duration-2000 ease-out z-10 scale-75 md:scale-100 ${hoveredIcon === "atom" ? "rotate-45" : ""}`}
              data-depth="1.0"
              onMouseEnter={() => handleIconHover("atom")}
              onMouseLeave={handleIconLeave}
            >
              <svg
                width="80"
                height="80"
                viewBox="0 0 80 80"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="cursor-pointer opacity-70"
              >
                <circle cx="40" cy="40" r="8" stroke="black" strokeWidth="1.5" className="fill-black" />
                <ellipse cx="40" cy="40" rx="30" ry="10" stroke="black" strokeWidth="1.5" className="fill-none" />
                <ellipse cx="40" cy="40" rx="30" ry="10" transform="rotate(60 40 40)" stroke="black" strokeWidth="1.5" className="fill-none" />
                <ellipse cx="40" cy="40" rx="30" ry="10" transform="rotate(120 40 40)" stroke="black" strokeWidth="1.5" className="fill-none" />
              </svg>
            </div>

            {/* Einstein's Equation */}
            <div
              className={`absolute left-0 top-24 md:left-[10%] md:top-[10%] parallax-icon transition-all duration-500 ease-out z-10 scale-75 md:scale-100 ${hoveredIcon === "equation" ? "scale-110" : ""}`}
              data-depth="1.0"
              onMouseEnter={() => handleIconHover("equation")}
              onMouseLeave={handleIconLeave}
            >
              <div className="text-2xl italic font-serif cursor-pointer opacity-80 font-bold mix-blend-multiply">E=mc²</div>
            </div>

            {/* Magnifying Glass */}
            <div
              className={`absolute right-4 top-32 md:right-[15%] md:top-[30%] parallax-icon transition-all duration-500 ease-out z-10 scale-75 md:scale-100 ${hoveredIcon === "magnify" ? "scale-110" : ""}`}
              data-depth="0.9"
              onMouseEnter={() => handleIconHover("magnify")}
              onMouseLeave={handleIconLeave}
            >
              <svg
                width="50"
                height="50"
                viewBox="0 0 60 60"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="cursor-pointer opacity-70"
              >
                <circle cx="25" cy="25" r="15" stroke="black" strokeWidth="2" className="fill-white/20" />
                <line x1="35" y1="35" x2="50" y2="50" stroke="black" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>

            {/* Books */}
            <div
              className={`absolute left-4 bottom-0 md:left-[20%] md:bottom-[15%] parallax-icon transition-all duration-700 ease-out z-10 scale-75 md:scale-100 ${hoveredIcon === "books" ? "scale-110" : ""}`}
              data-depth="0.7"
              onMouseEnter={() => handleIconHover("books")}
              onMouseLeave={handleIconLeave}
            >
              <svg
                width="70"
                height="30"
                viewBox="0 0 80 30"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="cursor-pointer opacity-70"
              >
                <rect x="10" y="5" width="60" height="5" stroke="black" strokeWidth="1" rx="1" />
                <rect x="10" y="12" width="60" height="5" stroke="black" strokeWidth="1" rx="1" />
                <rect x="10" y="19" width="60" height="5" stroke="black" strokeWidth="1" rx="1" />
              </svg>
            </div>

            {/* Main Content */}
            <div className="flex flex-col items-center justify-center text-center relative z-20 w-full">
              <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl font-bold mb-6 max-w-4xl leading-[0.9] tracking-tight text-[#0A0A0A]">
                Bring your learning <br />
                <span className="italic font-light">to life.</span>
              </h1>
              
              <p className="text-lg md:text-xl text-gray-700 mb-12 max-w-2xl font-normal leading-relaxed">
                Enhance your education with Studi&apos;s AI-Powered Education platform
              </p>

              {/* Clerk Waitlist Form */}
              <div className="w-full max-w-md mx-auto flex justify-center">
                {isMounted ? (
                  <Waitlist 
                    appearance={{
                      variables: { 
                        colorPrimary: '#000000',
                        colorBackground: '#F2F1EA',
                        colorText: '#000000',
                        colorInputBackground: '#ffffff',
                        colorInputText: '#000000',
                        borderRadius: '0.75rem',
                      },
                      elements: {
                        rootBox: "w-full flex justify-center items-center",
                        cardBox: "w-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-xl border-2 border-black bg-[#F2F1EA] overflow-hidden",
                        card: "w-full shadow-none border-none bg-transparent p-6 md:p-8",
                        formButtonPrimary: "w-full bg-black border-2 border-black text-white rounded-lg px-6 py-3 font-medium hover:bg-gray-900 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 ease-out shadow-none normal-case text-base",
                        formFieldInput: "w-full px-4 py-3 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black transition-all duration-300 shadow-none",
                        footerActionText: "text-gray-600 mt-4 text-center text-sm",
                        footerActionLink: "text-black font-medium hover:underline text-sm",
                        headerTitle: "text-2xl font-serif font-bold text-center mb-2 text-black",
                        headerSubtitle: "text-gray-600 text-center mb-6 text-sm",
                        form: "w-full space-y-4 gap-0",
                        formFieldLabel: "font-medium text-gray-700 mb-1 block text-left",
                        identityPreview: "bg-white border-2 border-black rounded-lg p-3 mb-4",
                      },
                      layout: {
                        socialButtonsPlacement: "bottom",
                        socialButtonsVariant: "iconButton",
                      }
                    }}
                  />
                ) : (
                  // Client-side hydration fallback
                  <div className="w-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-xl border-2 border-black bg-[#F2F1EA] p-6 md:p-8 h-[400px] animate-pulse flex items-center justify-center">
                    <div className="text-gray-400">Loading waitlist...</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Unauthenticated>
    </main>
  );
}
