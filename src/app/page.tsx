"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Globe, ChevronDown, Zap, Bot, ShieldAlert } from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);
export default function LandingPage() {
  const [scrolled, setScrolled] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const heroRef = React.useRef<HTMLDivElement>(null);
  const backdropRef = React.useRef<HTMLVideoElement>(null);

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

      // 2. Parallax mouse movement on hero section backdrop video
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

      // 3. Interactive 3D Card tilt + Glare tracking
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

          let glowBorder = "rgba(255, 255, 255, 0.15)";
          if (card.classList.contains("bg-iris-gleam")) {
            glowBorder = "rgba(255, 255, 255, 0.35)";
          } else if (card.classList.contains("bg-cyan-signal")) {
            glowBorder = "rgba(255, 255, 255, 0.35)";
          } else if (card.classList.contains("bg-silver")) {
            glowBorder = "rgba(0, 0, 0, 0.15)";
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
          let originalBorder = "rgba(255, 255, 255, 0.05)";
          if (card.classList.contains("bg-silver")) {
            originalBorder = "transparent";
          }
          gsap.to(card, {
            rotationX: 0,
            rotationY: 0,
            scale: 1,
            borderColor: originalBorder,
            boxShadow: "none",
            ease: "power2.out",
            duration: 0.5
          });
        };

        card.addEventListener("mousemove", handleMouseMove);
        card.addEventListener("mouseleave", handleMouseLeave);
      });

      // 4. Manifesto Section scroll animation
      gsap.from(".manifesto-anim", {
        scrollTrigger: {
          trigger: ".manifesto",
          start: "top 80%",
          end: "bottom 20%",
          toggleActions: "play none none reverse",
        },
        opacity: 0,
        y: 40,
        duration: 1.2,
        stagger: 0.3,
        ease: "power3.out",
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="bg-obsidian text-ash min-h-screen selection:bg-iris-gleam selection:text-white font-sans antialiased overflow-x-hidden">
      {/* 1. Glass Header / Navigation */}
      <nav
        className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 ${
          scrolled
            ? "bg-[#0f1011]/80 backdrop-blur-[24px] border-b border-white/10 py-4"
            : "bg-gradient-to-b from-[#0f1011]/80 to-transparent py-6"
        } px-6 md:px-12 flex items-center justify-between`}
      >
        <div className="flex items-center space-x-3">
          <span className="font-display text-[18px] font-light tracking-wide text-pure uppercase">
            OrbitGuard
          </span>
        </div>
        
        <div className="hidden md:flex items-center space-x-6">
          <a href="#features" className="text-ash hover:text-pure text-xs font-medium uppercase tracking-wider transition-colors px-3 py-1.5 rounded-md hover:bg-white/5">
            Capabilities
          </a>
          <a href="#metrics" className="text-ash hover:text-pure text-xs font-medium uppercase tracking-wider transition-colors px-3 py-1.5 rounded-md hover:bg-white/5">
            Telemetry Stats
          </a>
          <Link href="/dashboard" className="text-ash hover:text-pure text-xs font-medium uppercase tracking-wider transition-colors px-3 py-1.5 rounded-md hover:bg-white/5">
            Operations Console
          </Link>
        </div>

        <Link
          href="/dashboard"
          className="flex items-center space-x-2 h-10 px-5 bg-pure hover:bg-[#cacaca] text-void transition-all duration-300 font-body text-xs font-medium rounded-md cursor-pointer"
        >
          <span>Launch Console</span>
          <ArrowRight className="h-3.5 w-3.5 ml-1.5 shrink-0" />
        </Link>
      </nav>

      {/* 2. Hero Section */}
      <section ref={heroRef} className="relative w-full h-[100svh] overflow-hidden bg-obsidian flex items-center justify-center px-6 md:px-12">
        <div className="absolute inset-0 z-0 opacity-75 overflow-hidden">
          <video
            ref={backdropRef}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover scale-[1.2]"
            src="/364698 (1).mp4"
          />
        </div>
        
        <div className="absolute inset-0 bg-sky-atmosphere opacity-25 mix-blend-multiply z-0 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/30 to-transparent z-0 pointer-events-none" />

        <div className="relative z-10 max-w-4xl mt-24 text-center flex flex-col items-center pointer-events-none">
          <span className="reveal-el text-[10px] font-data font-bold text-iris-gleam uppercase tracking-[0.2em] block mb-6">
            Next-Generation Orbital Security
          </span>
          <h1 className="reveal-el font-display text-[54px] md:text-[84px] font-light leading-[0.95] text-pure tracking-tight mb-8">
            <em>Safeguard</em> <br />Low Earth Orbit
          </h1>
          <p className="reveal-el font-body text-[15px] md:text-[18px] text-ash font-light leading-relaxed max-w-2xl mb-10">
            Ensure the safety of your space assets with OrbitGuard. Our platform provides real-time collision prediction and autonomous maneuver planning to protect the future of orbital operations.
          </p>
          
          <div className="reveal-el flex flex-wrap justify-center gap-4 pointer-events-auto">
            <Link
              href="/dashboard"
              className="flex items-center justify-center space-x-2 h-12 px-7 bg-pure hover:bg-[#cacaca] text-void font-body text-sm font-medium rounded-md transition-all duration-300 cursor-pointer"
            >
              <span>Launch Operations Console</span>
              <ArrowRight className="h-3.5 w-3.5 ml-2 shrink-0" />
            </Link>
            <Link
              href="/map"
              className="flex items-center justify-center space-x-2 h-12 px-7 bg-transparent border border-white/20 hover:border-pure/50 hover:bg-white/5 text-pure font-body text-sm font-medium rounded-md transition-all duration-300 cursor-pointer"
            >
              <span>View Live 3D Map</span>
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center space-y-2 z-10 animate-bounce pointer-events-none">
          <span className="font-data text-[9px] text-[#f5f5f7]/40 uppercase tracking-widest">Scroll to explore</span>
          <ChevronDown className="h-4 w-4 text-[#f5f5f7]/40" />
        </div>
      </section>

      {/* 3. Manifesto Section */}
      <section className="manifesto py-28 border-t border-white/10 bg-abyss relative">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-8">
          <span className="manifesto-anim text-[10px] font-data font-bold text-iris-gleam uppercase tracking-[0.2em] block cursor-default select-none">
            <span className="inline-block w-1.5 h-1.5 bg-iris-gleam rounded-full mr-2 animate-pulse" />
            The Orbital Space Hazard
          </span>
          <p className="manifesto-anim font-display text-[24px] md:text-[34px] font-light leading-snug text-cloud tracking-tight max-w-3xl mx-auto">
            Low Earth Orbit is congested. More than <strong className="text-pure font-semibold transition-all duration-300 hover:text-cyan-signal cursor-default">27,000 cataloged objects</strong> and millions of untracked fragments circle Earth at speeds exceeding 28,000 km/h. Manual coordination is no longer enough to prevent catastrophic debris generation. OrbitGuard couples high-fidelity orbital mechanics with automated screening to compute optimal, physics-validated evasive maneuvers.
          </p>
          <div className="h-[40px] w-[1px] bg-white/10 mx-auto" />
        </div>
      </section>

      {/* 4. Stats / Metrics Strip */}
      <section id="metrics" className="bg-obsidian border-y border-white/10 py-20">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          
          {/* Card 1: Silver (Inverted) */}
          <div className="js-tilt-card metrics-card relative overflow-hidden bg-silver rounded-2xl p-8 border border-transparent transition-all hover:scale-[1.02] duration-300 flex flex-col justify-between min-h-[160px]">
            <div className="card-glare" />
            <div className="space-y-4 relative z-10">
              <span className="font-data text-[11px] font-bold text-void/60 uppercase tracking-wider block">
                CATALOG TELEMETRY
              </span>
              <span className="font-display text-[44px] font-light text-void block leading-none">
                27K+
              </span>
            </div>
            <span className="font-body text-[13px] font-medium text-void/70 uppercase tracking-wide relative z-10">
              Tracked Objects
            </span>
          </div>

          {/* Card 2: Graphite */}
          <div className="js-tilt-card metrics-card relative overflow-hidden bg-graphite rounded-2xl p-8 border border-white/5 transition-all hover:scale-[1.02] duration-300 flex flex-col justify-between min-h-[160px]">
            <div className="card-glare" />
            <div className="space-y-4 relative z-10">
              <span className="font-data text-[11px] font-bold text-ash uppercase tracking-wider block">
                PROPAGATION TIMELINE
              </span>
              <span className="font-display text-[44px] font-light text-pure block leading-none">
                72 Hr
              </span>
            </div>
            <span className="font-body text-[13px] font-medium text-ash uppercase tracking-wide relative z-10">
              Prediction Window
            </span>
          </div>

          {/* Card 3: Graphite */}
          <div className="js-tilt-card metrics-card relative overflow-hidden bg-graphite rounded-2xl p-8 border border-white/5 transition-all hover:scale-[1.02] duration-300 flex flex-col justify-between min-h-[160px]">
            <div className="card-glare" />
            <div className="space-y-4 relative z-10">
              <span className="font-data text-[11px] font-bold text-ash uppercase tracking-wider block">
                Pc RISK ALARM
              </span>
              <span className="font-display text-[44px] font-light text-cyan-signal block leading-none">
                10⁻⁵
              </span>
            </div>
            <span className="font-body text-[13px] font-medium text-ash uppercase tracking-wide relative z-10">
              Pc Hazard Threshold
            </span>
          </div>

          {/* Card 4: Graphite */}
          <div className="js-tilt-card metrics-card relative overflow-hidden bg-graphite rounded-2xl p-8 border border-white/5 transition-all hover:scale-[1.02] duration-300 flex flex-col justify-between min-h-[160px]">
            <div className="card-glare" />
            <div className="space-y-4 relative z-10">
              <span className="font-data text-[11px] font-bold text-ash uppercase tracking-wider block">
                ENGINE CORE
              </span>
              <span className="font-display text-[44px] font-light text-pure block leading-none">
                SGP4
              </span>
            </div>
            <span className="font-body text-[13px] font-medium text-ash uppercase tracking-wide relative z-10">
              Real Physics Engine
            </span>
          </div>

        </div>
      </section>

      {/* 5. Feature Sections Grid */}
      <section id="features" className="bg-obsidian py-28 border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          
          <div className="text-center space-y-4 max-w-xl mx-auto mb-16">
            <span className="text-[10px] font-data font-bold text-iris-gleam uppercase tracking-[0.2em] block">
              SYSTEM CAPABILITIES
            </span>
            <h2 className="font-display text-[44px] md:text-[60px] font-light text-pure leading-none">
              Autonomous Safety <br />For Earth&apos;s Orbit
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Card 1: 3D Live Map */}
            <div className="js-tilt-card rounded-3xl p-10 bg-iris-gleam text-white flex flex-col justify-between min-h-[460px] border border-white/5 relative overflow-hidden transition-transform duration-300 hover:scale-[1.01] hover:shadow-xl">
              <div className="card-glare" />
              <div className="space-y-6 relative z-10">
                <div className="flex justify-between items-start">
                  <span className="font-data text-[11px] font-medium tracking-wider bg-white/20 px-3 py-1 rounded-full uppercase">
                    Feature 01 · Visualizer
                  </span>
                  <Globe className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-display text-[32px] md:text-[38px] font-light leading-[1.1]">
                  3D Live Map & <br />Propagated Orbits
                </h3>
                <p className="font-body text-[14px] leading-relaxed opacity-90 max-w-md">
                  State-of-the-art interactive projection of Low Earth Orbit. Trace active catalog objects, map predicted trails via live SGP4 propagation, and instantly visualize Closest Approach Points (CAP) for high-risk conjunction pairs.
                </p>
              </div>
              
              <div className="mt-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 relative z-10">
                <div className="font-data text-[10px] text-white/70 bg-white/10 rounded-md p-3 border border-white/20 w-full sm:max-w-[240px]">
                  <div className="font-bold mb-1">LIVE PROPAGATION ENGINE</div>
                  <div>• Time-scrub slider coordinates</div>
                  <div>• TLE epoch orbit trails</div>
                </div>
                
                <Link
                  href="/map"
                  className="bg-white text-void hover:bg-white/90 transition-all duration-300 font-body text-xs font-medium py-3 px-5 rounded-md inline-flex items-center space-x-2 shrink-0 cursor-pointer"
                >
                  <span>Launch 3D Map</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Card 2: Conjunction Screening */}
            <div className="js-tilt-card rounded-3xl p-10 bg-cyan-signal text-white flex flex-col justify-between min-h-[460px] border border-white/5 relative overflow-hidden transition-transform duration-300 hover:scale-[1.01] hover:shadow-xl">
              <div className="card-glare" />
              <div className="space-y-6 relative z-10">
                <div className="flex justify-between items-start">
                  <span className="font-data text-[11px] font-medium tracking-wider bg-white/20 px-3 py-1 rounded-full uppercase">
                    Feature 02 · Screening
                  </span>
                  <ShieldAlert className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-display text-[32px] md:text-[38px] font-light leading-[1.1]">
                  Conjunction <br />Dashboard
                </h3>
                <p className="font-body text-[14px] leading-relaxed opacity-90 max-w-md">
                  A high-precision command interface for close approach analysis. Triage threat catalogs instantly, sorting by time of closest approach, miss distance, and Akella-Alfriend 2D probability equations.
                </p>
              </div>
              
              <div className="mt-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 relative z-10">
                <div className="font-data text-[10px] text-white/70 bg-white/10 rounded-md p-3 border border-white/20 w-full sm:max-w-[240px]">
                  <div className="font-bold mb-1">PROBABILITY MATRIX</div>
                  <div>• Akella-Alfriend 2D calculations</div>
                  <div>• Real-time miss-distance sorting</div>
                </div>
                
                <Link
                  href="/conjunctions"
                  className="bg-white text-void hover:bg-white/90 transition-all duration-300 font-body text-xs font-medium py-3 px-5 rounded-md inline-flex items-center space-x-2 shrink-0 cursor-pointer"
                >
                  <span>View Conjunctions</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Card 3: Maneuver Physics Solver */}
            <div className="js-tilt-card rounded-3xl p-10 bg-periwinkle text-void flex flex-col justify-between min-h-[460px] border border-black/5 relative overflow-hidden transition-transform duration-300 hover:scale-[1.01] hover:shadow-xl">
              <div className="card-glare" />
              <div className="space-y-6 relative z-10">
                <div className="flex justify-between items-start">
                  <span className="font-data text-[11px] font-medium tracking-wider bg-black/10 px-3 py-1 rounded-full uppercase text-void">
                    Feature 03 · Solver
                  </span>
                  <Zap className="h-6 w-6 text-void" />
                </div>
                <h3 className="font-display text-[32px] md:text-[38px] font-light leading-[1.1]">
                  Clohessy-Wiltshire <br />Maneuver Planner
                </h3>
                <p className="font-body text-[14px] leading-relaxed text-void/80 max-w-md">
                  Plan optimal thrust profiles utilizing Clohessy-Wiltshire relative motion solvers. Evaluate standard impulsive burns or use the manual sandbox slider to simulate adjustments in Delta-V and lead time to resolve probability spikes in real time.
                </p>
              </div>
              
              <div className="mt-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 relative z-10">
                <div className="font-data text-[10px] text-void/70 bg-black/5 rounded-md p-3 border border-black/10 w-full sm:max-w-[240px]">
                  <div className="font-bold mb-1">PHYSICS CAPABILITIES</div>
                  <div>• Linear relative motion solver</div>
                  <div>• Delta-V fuel expenditure math</div>
                </div>
                
                <Link
                  href="/maneuvers"
                  className="bg-void text-white hover:bg-void/90 transition-all duration-300 font-body text-xs font-medium py-3 px-5 rounded-md inline-flex items-center space-x-2 shrink-0 cursor-pointer"
                >
                  <span>Plan Burn Maneuvers</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Card 4: AI situation briefing */}
            <div className="js-tilt-card rounded-3xl p-10 bg-orchid-bloom text-void flex flex-col justify-between min-h-[460px] border border-black/5 relative overflow-hidden transition-transform duration-300 hover:scale-[1.01] hover:shadow-xl">
              <div className="card-glare" />
              <div className="space-y-6 relative z-10">
                <div className="flex justify-between items-start">
                  <span className="font-data text-[11px] font-medium tracking-wider bg-black/10 px-3 py-1 rounded-full uppercase text-void">
                    Feature 04 · AI Briefing
                  </span>
                  <Bot className="h-6 w-6 text-void" />
                </div>
                <h3 className="font-display text-[32px] md:text-[38px] font-light leading-[1.1]">
                  AI Situation <br />Briefings
                </h3>
                <p className="font-body text-[14px] leading-relaxed text-void/80 max-w-md">
                  Generate executive situation briefings summarizing close encounters and evasive plans. Synthesize complex covariance and debris tracking data into plain English for rapid crew notifications and commander sign-off.
                </p>
              </div>
              
              <div className="mt-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 relative z-10">
                <div className="font-body text-[10px] text-void/80 bg-black/5 rounded-md p-3 border border-black/10 w-full sm:max-w-[240px] italic">
                  &quot;CONJ-2026-001 is a critical red risk conjunction. Closest approach is projected in 4 hours...&quot;
                </div>
                
                <Link
                  href="/ai-briefing"
                  className="bg-void text-white hover:bg-void/90 transition-all duration-300 font-body text-xs font-medium py-3 px-5 rounded-md inline-flex items-center space-x-2 shrink-0 cursor-pointer"
                >
                  <span>Generate Briefing</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 6. Footer Section */}
      <footer className="bg-abyss border-t border-white/10 py-16 text-center">
        <div className="max-w-6xl mx-auto px-6 space-y-6">
          <div className="flex items-center justify-center space-x-3">
            <span className="font-display text-[18px] font-light tracking-wide text-pure uppercase">
              OrbitGuard
            </span>
          </div>
          <p className="font-data text-[10px] text-fog uppercase tracking-[0.1em]">
            © 2026 OrbitGuard Space Traffic Systems · Continuous Trajectory Defense.
          </p>
          <div className="flex justify-center space-x-6 pt-2 text-ash text-xs">
            <Link href="/dashboard" className="hover:text-pure transition-colors">Operations Console</Link>
            <span>·</span>
            <Link href="/map" className="hover:text-pure transition-colors">3D Orbit Map</Link>
            <span>·</span>
            <a href="https://celestrak.org" target="_blank" rel="noopener noreferrer" className="hover:text-pure transition-colors">CelesTrak Data</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
