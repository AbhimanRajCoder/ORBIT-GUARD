"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Globe, MessageSquare, ChevronDown, Radio, Zap, Bot, ShieldAlert } from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Register GSAP plugins client-side
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export default function LandingPage() {
  const [scrolled, setScrolled] = React.useState(false);
  const heroRef = React.useRef<HTMLDivElement>(null);
  const backdropRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  React.useEffect(() => {
    const ctx = gsap.context(() => {
      // 1. Staggered Hero text entrance animation
      gsap.from(".reveal-el", {
        opacity: 0,
        y: 40,
        duration: 1.4,
        stagger: 0.18,
        ease: "power4.out",
      });

      // 2. Parallax mouse movement on hero section backdrop image
      const handleHeroMouseMove = (e: MouseEvent) => {
        if (!backdropRef.current) return;
        const { clientX, clientY } = e;
        const { innerWidth, innerHeight } = window;
        const xPct = (clientX / innerWidth) - 0.5;
        const yPct = (clientY / innerHeight) - 0.5;

        gsap.to(backdropRef.current, {
          x: xPct * 45,
          y: yPct * 45,
          rotationY: xPct * 8,
          rotationX: -yPct * 8,
          transformPerspective: 1200,
          duration: 1.2,
          ease: "power2.out",
        });
      };

      const heroEl = heroRef.current;
      if (heroEl) {
        heroEl.addEventListener("mousemove", handleHeroMouseMove);
      }

      // 3. Manifesto scroll reveal
      gsap.from(".manifesto-anim", {
        scrollTrigger: {
          trigger: ".manifesto",
          start: "top 85%",
          toggleActions: "play none none none",
        },
        opacity: 0,
        y: 45,
        duration: 1.4,
        ease: "power3.out",
      });

      // 4. Metrics cards stagger 3D tilt reveal
      gsap.from(".metrics-card", {
        scrollTrigger: {
          trigger: "#metrics",
          start: "top 90%",
          toggleActions: "play none none none",
        },
        opacity: 0,
        y: 65,
        rotationX: 40,
        stagger: 0.12,
        duration: 1.2,
        ease: "power3.out",
      });

      // 5. Alternating feature rows scroll reveal
      const featureRows = document.querySelectorAll(".feature-row");
      featureRows.forEach((row) => {
        const textCol = row.querySelector(".feature-text");
        const visualCard = row.querySelector(".js-tilt-card");

        if (textCol) {
          gsap.from(textCol.children, {
            scrollTrigger: {
              trigger: row,
              start: "top 80%",
              toggleActions: "play none none none",
            },
            opacity: 0,
            y: 35,
            x: -25,
            stagger: 0.14,
            duration: 1.1,
            ease: "power2.out",
          });
        }

        if (visualCard) {
          gsap.from(visualCard, {
            scrollTrigger: {
              trigger: row,
              start: "top 80%",
              toggleActions: "play none none none",
            },
            opacity: 0,
            scale: 0.94,
            rotationX: 12,
            rotationY: -12,
            duration: 1.3,
            ease: "power3.out",
          });
        }
      });

      // 6. Interactive 3D Card tilt + Glare tracking
      const tiltCards = document.querySelectorAll(".js-tilt-card");
      
      tiltCards.forEach((card) => {
        const handleMouseMove = (e: Event) => {
          const mouseEvent = e as MouseEvent;
          const rect = (card as HTMLElement).getBoundingClientRect();
          const x = mouseEvent.clientX - rect.left;
          const y = mouseEvent.clientY - rect.top;
          
          (card as HTMLElement).style.setProperty("--mouse-x", `${x}px`);
          (card as HTMLElement).style.setProperty("--mouse-y", `${y}px`);
          
          const xc = rect.width / 2;
          const yc = rect.height / 2;
          
          const angleX = -((y - yc) / yc) * 9;
          const angleY = ((x - xc) / xc) * 9;

          let glowBorder = "rgba(255, 184, 41, 0.28)"; // default warning yellow
          if (card.classList.contains("glow-cyan")) {
            glowBorder = "rgba(0, 186, 226, 0.28)";
          } else if (card.classList.contains("glow-green")) {
            glowBorder = "rgba(10, 228, 72, 0.28)";
          } else if (card.classList.contains("glow-white")) {
            glowBorder = "rgba(255, 255, 255, 0.18)";
          }

          gsap.to(card, {
            rotationX: angleX,
            rotationY: angleY,
            transformPerspective: 1200,
            scale: 1.025,
            borderColor: glowBorder,
            boxShadow: "0 12px 35px rgba(0,0,0,0.65)",
            ease: "power2.out",
            duration: 0.35
          });
        };

        const handleMouseLeave = () => {
          gsap.to(card, {
            rotationX: 0,
            rotationY: 0,
            scale: 1,
            borderColor: "rgba(255, 255, 255, 0.05)",
            boxShadow: "none",
            ease: "power2.out",
            duration: 0.5
          });
        };

        card.addEventListener("mousemove", handleMouseMove);
        card.addEventListener("mouseleave", handleMouseLeave);
      });
    }, heroRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className="bg-[#000000] text-[#F0F0FA] min-h-screen selection:bg-[#FFB829] selection:text-[#000000] font-sans antialiased overflow-x-hidden">
      {/* 1. Transparent Header / Navigation */}
      <nav
        className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 ${
          scrolled
            ? "bg-[#0A0A0B]/90 backdrop-blur-md border-b border-white/5 py-4"
            : "bg-gradient-to-b from-black/60 to-transparent py-6"
        } px-6 md:px-12 flex items-center justify-between`}
      >
        <div className="flex items-center space-x-3">
          <span className="font-display text-[15px] font-bold tracking-widest uppercase text-white">
            OrbitGuard
          </span>
        </div>
        
        <div className="hidden md:flex items-center space-x-8">
          <a href="#features" className="text-white/60 hover:text-white text-xs font-semibold uppercase tracking-wider transition-colors">
            Capabilities
          </a>
          <a href="#metrics" className="text-white/60 hover:text-white text-xs font-semibold uppercase tracking-wider transition-colors">
            Telemetry Stats
          </a>
          <Link href="/dashboard" className="text-white/60 hover:text-white text-xs font-semibold uppercase tracking-wider transition-colors">
            Operations Console
          </Link>
        </div>

        <Link
          href="/dashboard"
          className="flex items-center space-x-2 h-10 px-5 border border-white/20 hover:bg-white hover:text-black transition-all duration-300 font-display text-[11px] font-bold uppercase tracking-wider rounded-[4px] cursor-pointer"
        >
          <span>Launch Console</span>
          <ArrowRight className="h-3.5 w-3.5 ml-2 shrink-0" />
        </Link>
      </nav>

      {/* 2. Hero Section */}
      <section ref={heroRef} className="relative w-full h-[100svh] overflow-hidden bg-black flex items-center justify-start px-6 md:px-12">
        <div
          ref={backdropRef}
          className="absolute inset-0 w-full h-full bg-cover bg-center opacity-65 mix-blend-screen scale-105 select-none pointer-events-none z-0"
          style={{ backgroundImage: "url('/background.png')" }}
        />
        
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent z-1 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-transparent z-1 pointer-events-none" />

        <div className="relative z-10 max-w-3xl mt-24">
          <span className="reveal-el text-[10px] font-display font-bold text-[#FFB829] uppercase tracking-widest block mb-4">
            Satellite Conjunction Analysis & Maneuver Planning Simulator
          </span>
          <h1 className="reveal-el font-display text-[42px] md:text-[68px] font-normal leading-[0.95] text-white uppercase tracking-tight mb-6">
            Physics-Honest <br />Orbital Avoidance
          </h1>
          <p className="reveal-el font-body text-[14px] md:text-[16px] text-white/80 leading-relaxed max-w-xl mb-8 font-light">
            Real-time orbital tracking, SGP4 propagation, Akella-Alfriend 2D collision probability calculation, and Clohessy-Wiltshire maneuver solvers. Keep space safe and accessible.
          </p>
          
          <div className="reveal-el flex flex-wrap gap-4">
            <Link
              href="/dashboard"
              className="flex items-center justify-center space-x-2 h-12 px-7 bg-[#FFB829] hover:bg-white text-black font-display text-xs font-bold uppercase tracking-wide transition-all duration-300 rounded-[4px] cursor-pointer border border-[#FFB829]"
            >
              <span>Launch Operations Console</span>
              <ArrowRight className="h-3.5 w-3.5 ml-2 shrink-0" />
            </Link>
            <Link
              href="/map"
              className="flex items-center justify-center space-x-2 h-12 px-7 bg-transparent border border-white/20 hover:border-white hover:bg-white/5 text-white font-display text-xs font-bold uppercase tracking-wide transition-all duration-300 rounded-[4px] cursor-pointer"
            >
              <span>View Live 3D Map</span>
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center space-y-2 z-10 animate-bounce pointer-events-none">
          <span className="font-display text-[9px] text-white/40 uppercase tracking-widest">Scroll to explore</span>
          <ChevronDown className="h-4 w-4 text-white/40" />
        </div>
      </section>

      {/* 3. Manifesto Section */}
      <section className="manifesto py-28 border-t border-white/5 bg-black relative">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-8">
          <span className="manifesto-anim text-[10px] font-display font-bold text-white/30 uppercase tracking-widest block transition-all duration-500 hover:text-[#ff3355] hover:tracking-[0.22em] cursor-default select-none">
            <span className="inline-block w-1.5 h-1.5 bg-[#ff3355] rounded-full mr-2 animate-pulse" />
            The Orbital Space Hazard
          </span>
          <p className="manifesto-anim font-display text-[20px] md:text-[34px] font-light leading-snug text-white/70 hover:text-white/95 transition-colors duration-500 tracking-tight max-w-3xl mx-auto">
            Low Earth Orbit is congested. Over <strong className="text-white hover:text-[#00bae2] font-semibold transition-all duration-300 hover:drop-shadow-[0_0_10px_rgba(0,186,226,0.4)] cursor-default">27,000 tracked objects</strong> and millions of untracked fragments orbit Earth. Manual coordination cannot prevent catastrophic high-speed collisions. OrbitGuard combines Keplerian physics and automated numerical algorithms to screen conjunction events and plan optimal evasive thruster burns.
          </p>
          <div className="h-[40px] w-[1px] bg-white/10 mx-auto" />
        </div>
      </section>

      {/* 4. Stats / Metrics Strip */}
      <section id="metrics" className="bg-[#0A0A0B] border-y border-white/5 py-12">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="js-tilt-card metrics-card glow-white relative overflow-hidden border border-white/5 pl-6 py-4 bg-black/30 rounded-[4px]">
            <div className="card-glare" />
            <span className="font-mono text-[36px] md:text-[48px] font-light text-white block leading-none mb-2">
              27K+
            </span>
            <span className="font-display text-[10px] font-semibold text-white/50 uppercase tracking-wider">
              Tracked Objects
            </span>
          </div>
          <div className="js-tilt-card metrics-card glow-amber relative overflow-hidden border border-white/5 pl-6 py-4 bg-black/30 rounded-[4px]">
            <div className="card-glare" />
            <span className="font-mono text-[36px] md:text-[48px] font-light text-[#FFB829] block leading-none mb-2">
              72 Hour
            </span>
            <span className="font-display text-[10px] font-semibold text-white/50 uppercase tracking-wider">
              Prediction Window
            </span>
          </div>
          <div className="js-tilt-card metrics-card glow-green relative overflow-hidden border border-white/5 pl-6 py-4 bg-black/30 rounded-[4px]">
            <div className="card-glare" />
            <span className="font-mono text-[#0ae448] text-[36px] md:text-[48px] font-light block leading-none mb-2">
              10⁻⁵
            </span>
            <span className="font-display text-[10px] font-semibold text-white/50 uppercase tracking-wider">
              Pc Hazard Threshold
            </span>
          </div>
          <div className="js-tilt-card metrics-card glow-white relative overflow-hidden border border-white/5 pl-6 py-4 bg-black/30 rounded-[4px]">
            <div className="card-glare" />
            <span className="font-mono text-white text-[36px] md:text-[48px] font-light block leading-none mb-2">
              SGP4
            </span>
            <span className="font-display text-[10px] font-semibold text-white/50 uppercase tracking-wider">
              Real Physics Engine
            </span>
          </div>
        </div>
      </section>

      {/* 5. Feature Sections */}
      <section id="features" className="bg-black divide-y divide-white/5">
        {/* Feature 1: 3D Live Map */}
        <div className="feature-row grid grid-cols-1 md:grid-cols-2 min-h-[75vh] items-center">
          <div className="feature-text p-8 md:p-16 space-y-6">
            <span className="text-[10px] font-display font-bold text-[#FFB829] uppercase tracking-widest block">
              Feature 01 · Visualizer
            </span>
            <h2 className="font-display text-[28px] md:text-[42px] font-normal leading-[1.05] text-white uppercase tracking-tight">
              3D Live Map &<br />Propagated Orbits
            </h2>
            <p className="font-body text-[13px] md:text-[14px] text-white/80 leading-relaxed font-light">
              Visualize Low Earth Orbit tracks in real-time. Code uses real-time SGP4 propagation to render paths, highlights risk classification (GREEN, YELLOW, RED), and draws red lines between conjunction pairs with a sphere pinpointing the Closest Approach Point.
            </p>
            <div className="pt-4">
              <Link
                href="/map"
                className="flex items-center space-x-2 h-10 px-5 border border-white/20 hover:bg-white hover:text-black transition-all duration-300 font-display text-[10px] font-bold uppercase tracking-wider rounded-[4px] cursor-pointer"
              >
                <span>Launch 3D Map</span>
                <ArrowRight className="h-3.5 w-3.5 ml-2 shrink-0" />
              </Link>
            </div>
          </div>
          <div className="bg-[#0A0A0B] h-full min-h-[350px] border-l border-white/5 relative flex items-center justify-center p-8 grid-scanlines">
            <div className="js-tilt-card glow-cyan relative overflow-hidden w-full max-w-md bg-black/60 border border-white/5 rounded-[6px] p-5 font-mono text-[11px] text-white/70 space-y-3 shadow-2xl transition-shadow duration-300">
              <div className="card-glare card-glare-cyan" />
              <div className="flex justify-between items-center border-b border-white/10 pb-2">
                <span className="text-[#0ae448]">● LIVE PROPAGATION</span>
                <span className="text-white/40">3D MAP</span>
              </div>
              <div className="space-y-1.5 relative z-10">
                <div className="text-white font-bold">3D Visualizer Features:</div>
                <div>• Time-scrub slider dynamically propagates orbits 72h ahead</div>
                <div>• Live orbit trails calculated directly from TLE epoch</div>
                <div>• Interactive click-to-focus on primary & debris assets</div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature 2: Conjunction Dashboard */}
        <div className="feature-row grid grid-cols-1 md:grid-cols-2 min-h-[75vh] items-center">
          <div className="bg-[#0A0A0B] h-full min-h-[350px] border-r border-white/5 order-last md:order-first relative flex items-center justify-center p-8 grid-scanlines">
            <div className="js-tilt-card glow-amber relative overflow-hidden w-full max-w-md bg-black/60 border border-white/5 rounded-[6px] p-5 space-y-4 shadow-2xl font-mono text-[11px] text-white/70 transition-shadow duration-300">
              <div className="card-glare" />
              <div className="text-white font-display text-[10px] font-bold uppercase tracking-wider border-b border-white/10 pb-2 flex justify-between relative z-10">
                <span>Conjunction Screening</span>
                <span className="text-[#ff3355]">Pc SORTED ENGINE</span>
              </div>
              <div className="space-y-1.5 relative z-10">
                <div>• Akella-Alfriend 2D probability equations</div>
                <div>• Real-time sorting by Miss Distance, Pc, and UTC</div>
                <div>• Interactive filters for Risk badges and status</div>
              </div>
            </div>
          </div>
          <div className="feature-text p-8 md:p-16 space-y-6">
            <span className="text-[10px] font-display font-bold text-[#FFB829] uppercase tracking-widest block">
              Feature 02 · Screening
            </span>
            <h2 className="font-display text-[28px] md:text-[42px] font-normal leading-[1.05] text-white uppercase tracking-tight">
              Conjunction <br />Dashboard
            </h2>
            <p className="font-body text-[13px] md:text-[14px] text-white/80 leading-relaxed font-light">
              Filter and analyze hazardous close approaches across active constellations and cataloged debris. Sort by time of closest approach, miss distance, and scientific probability of collision to triage high-risk events instantly.
            </p>
            <div className="pt-4">
              <Link
                href="/conjunctions"
                className="flex items-center space-x-2 h-10 px-5 border border-white/20 hover:bg-white hover:text-black transition-all duration-300 font-display text-[10px] font-bold uppercase tracking-wider rounded-[4px] cursor-pointer"
              >
                <span>View Conjunctions</span>
                <ArrowRight className="h-3.5 w-3.5 ml-2 shrink-0" />
              </Link>
            </div>
          </div>
        </div>

        {/* Feature 3: Maneuver Planner */}
        <div className="feature-row grid grid-cols-1 md:grid-cols-2 min-h-[75vh] items-center">
          <div className="feature-text p-8 md:p-16 space-y-6">
            <span className="text-[10px] font-display font-bold text-[#FFB829] uppercase tracking-widest block">
              Feature 03 · Solver
            </span>
            <h2 className="font-display text-[28px] md:text-[42px] font-normal leading-[1.05] text-white uppercase tracking-tight">
              Clohessy-Wiltshire <br />Maneuver Planner
            </h2>
            <p className="font-body text-[13px] md:text-[14px] text-white/80 leading-relaxed font-light">
              Compute prograde/retrograde impulse maneuvers to increase miss distance. Select standard solutions or use the interactive "What-If" sandbox slider to change Delta-V and burn lead times, resolving probability risk in real time.
            </p>
            <div className="pt-4">
              <Link
                href="/maneuvers"
                className="flex items-center space-x-2 h-10 px-5 border border-white/20 hover:bg-white hover:text-black transition-all duration-300 font-display text-[10px] font-bold uppercase tracking-wider rounded-[4px] cursor-pointer"
              >
                <span>Plan Burn Maneuvers</span>
                <ArrowRight className="h-3.5 w-3.5 ml-2 shrink-0" />
              </Link>
            </div>
          </div>
          <div className="bg-[#0A0A0B] h-full min-h-[350px] border-l border-white/5 relative flex items-center justify-center p-8 grid-scanlines">
            <div className="js-tilt-card glow-cyan relative overflow-hidden w-full max-w-md bg-black/60 border border-white/5 rounded-[6px] p-5 space-y-4 shadow-2xl text-[11px] font-mono text-white/70 transition-shadow duration-300">
              <div className="card-glare card-glare-cyan" />
              <div className="flex items-center space-x-2 text-white font-display text-[10px] font-bold uppercase tracking-wider border-b border-white/10 pb-2 relative z-10">
                <Zap className="h-3.5 w-3.5 text-[#FFB829]" />
                <span>Maneuver Physics Solver</span>
              </div>
              <div className="space-y-1.5 relative z-10">
                <div>• Linear Clohessy-Wiltshire relative motion solver</div>
                <div>• Tsiolkovsky rocket equation for fuel expenditure</div>
                <div>• Interactive burn timing sliders (+/- 24h lead)</div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature 4: AI situation briefing */}
        <div className="feature-row grid grid-cols-1 md:grid-cols-2 min-h-[75vh] items-center">
          <div className="bg-[#0A0A0B] h-full min-h-[350px] border-r border-white/5 order-last md:order-first relative flex items-center justify-center p-8 grid-scanlines">
            <div className="js-tilt-card glow-green relative overflow-hidden w-full max-w-md bg-black/60 border border-white/5 rounded-[6px] p-5 space-y-4 shadow-2xl font-mono text-[11px] text-white/70 transition-shadow duration-300">
              <div className="card-glare card-glare-green" />
              <div className="text-white font-display text-[10px] font-bold uppercase tracking-wider border-b border-white/10 pb-2 flex justify-between relative z-10">
                <span>AI Briefing Generator</span>
                <Bot className="h-4 w-4 text-[#0ae448]" />
              </div>
              <div className="p-3 bg-white/5 rounded-[4px] border border-white/10 text-[10px] leading-relaxed relative z-10">
                "CONJ-2026-001 is an active red risk conjunction between SpaceX Starlink-1042 and NOAA debris object. Closest approach is projected in 4 hours, with a critical miss distance of 45m..."
              </div>
            </div>
          </div>
          <div className="feature-text p-8 md:p-16 space-y-6">
            <span className="text-[10px] font-display font-bold text-[#FFB829] uppercase tracking-widest block">
              Feature 04 · AI Briefing
            </span>
            <h2 className="font-display text-[28px] md:text-[42px] font-normal leading-[1.05] text-white uppercase tracking-tight">
              AI situation <br />Briefings
            </h2>
            <p className="font-body text-[13px] md:text-[14px] text-white/80 leading-relaxed font-light">
              Instantly generate structured briefings summarizing close encounters and recommended evasive maneuvers in plain English. Ideal for rapid operator notifications, fleet status reporting, and commander briefings.
            </p>
            <div className="pt-4">
              <Link
                href="/ai-briefing"
                className="flex items-center space-x-2 h-10 px-5 border border-white/20 hover:bg-white hover:text-black transition-all duration-300 font-display text-[10px] font-bold uppercase tracking-wider rounded-[4px] cursor-pointer"
              >
                <span>Generate Briefing</span>
                <ArrowRight className="h-3.5 w-3.5 ml-2 shrink-0" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Footer Section */}
      <footer className="bg-[#0A0A0B] border-t border-white/5 py-16 text-center">
        <div className="max-w-6xl mx-auto px-6 space-y-6">
          <div className="flex items-center justify-center space-x-3">
            <span className="font-display text-[16px] font-bold tracking-widest uppercase text-white">
              OrbitGuard
            </span>
          </div>
          <p className="font-display text-[11px] text-white/40 uppercase tracking-widest">
            © 2026 OrbitGuard Space Traffic Systems · Continuous Trajectory Defense.
          </p>
          <div className="flex justify-center space-x-6 pt-2 text-white/50 text-xs">
            <Link href="/dashboard" className="hover:text-white transition-colors">Operations Console</Link>
            <span>·</span>
            <Link href="/map" className="hover:text-white transition-colors">3D Orbit Map</Link>
            <span>·</span>
            <a href="https://celestrak.org" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">CelesTrak Data</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
