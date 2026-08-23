"use client";

import * as React from "react";
import Link from "next/link";
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

      // 3. Manifesto Section scroll animation
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
    <div ref={containerRef} className="bg-[#101010] text-[#f3f3f3] min-h-screen selection:bg-white selection:text-black font-sans antialiased overflow-x-hidden">
      {/* 1. Header / Navigation */}
      <nav
        className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 ${
          scrolled
            ? "bg-[#101010]/90 backdrop-blur-[24px] border-b border-[#212121] py-4"
            : "bg-transparent py-6"
        } px-6 md:px-12 flex items-center justify-between`}
      >
        <div className="flex items-center space-x-3">
          <span className="font-sans font-bold text-[20px] tracking-[0.1em] text-[#f3f3f3] uppercase">
            OrbitGuard
          </span>
        </div>
        
        <div className="hidden md:flex items-center space-x-8">
          <a href="#problem" className="text-[#9c9c9c] hover:text-white text-xs font-bold uppercase tracking-widest transition-colors py-1.5">
            The Mission
          </a>
          <a href="#how-it-works" className="text-[#9c9c9c] hover:text-white text-xs font-bold uppercase tracking-widest transition-colors py-1.5">
            Architecture
          </a>
          <Link href="/dashboard" className="text-[#9c9c9c] hover:text-white text-xs font-bold uppercase tracking-widest transition-colors py-1.5">
            Dashboard
          </Link>
        </div>

        <Link
          href="/dashboard"
          className="flex items-center justify-center space-x-2 h-10 px-6 bg-white hover:bg-[#cacaca] text-black transition-all duration-300 text-xs font-bold uppercase tracking-widest cursor-pointer"
        >
          <span>Launch</span>
        </Link>
      </nav>

      {/* 2. Hero Section */}
      <section ref={heroRef} className="relative w-full h-[100svh] overflow-hidden bg-[#101010] flex items-center justify-center px-6 md:px-12 border-b border-[#212121]">
        <div className="absolute inset-0 z-0 opacity-40 overflow-hidden grayscale">
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
        
        <div className="absolute inset-0 bg-gradient-to-t from-[#101010] via-transparent to-transparent z-0 pointer-events-none" />

        <div className="relative z-10 max-w-4xl mt-24 text-center flex flex-col items-center pointer-events-none">
          <span className="reveal-el text-[12px] font-bold text-[#9c9c9c] uppercase tracking-[0.3em] block mb-8">
            Next-Generation Orbital Security
          </span>
          <h1 className="reveal-el font-sans text-[60px] md:text-[90px] font-bold leading-[0.9] text-white tracking-tighter uppercase mb-8">
            Safeguard <br />Low Earth Orbit
          </h1>
          <p className="reveal-el text-[16px] md:text-[20px] text-[#9c9c9c] font-normal leading-relaxed max-w-2xl mb-12">
            A smart satellite collision avoidance system. OrbitGuard predicts threats, explains the risk in plain English, and calculates exact evasive maneuvers in real-time.
          </p>
          
          <div className="reveal-el flex flex-wrap justify-center gap-4 pointer-events-auto">
            <Link
              href="/dashboard"
              className="flex items-center justify-center h-14 px-8 bg-white hover:bg-[#cacaca] text-black text-sm font-bold uppercase tracking-widest transition-all duration-300 cursor-pointer"
            >
              <span>Operations Console</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 3. The Problem (Manifesto) */}
      <section id="problem" className="manifesto py-32 bg-[#101010] relative">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-10">
          <span className="manifesto-anim text-[12px] font-bold text-[#9c9c9c] uppercase tracking-[0.3em] block cursor-default select-none">
            The Problem
          </span>
          <p className="manifesto-anim font-sans text-[28px] md:text-[40px] font-bold leading-[1.2] text-white tracking-tight max-w-3xl mx-auto uppercase">
            Space is getting crowded. Over <strong className="text-white">16,000 active satellites</strong> and millions of debris fragments are moving at 28,000 km/h.
          </p>
          <p className="manifesto-anim text-[18px] text-[#9c9c9c] font-normal leading-relaxed max-w-2xl mx-auto">
            At that speed, even a 1 cm fragment can destroy a spacecraft. OrbitGuard doesn&apos;t just warn you about a problem—it tells you exactly how to dodge it, how much fuel it costs, and logs every decision securely.
          </p>
        </div>
      </section>

      {/* 3D Visualizer Preview Section */}
      <section className="bg-[#101010] pb-32">
        <div className="max-w-6xl mx-auto px-6">
          <div className="border border-[#212121] bg-[#080808] rounded-[16px] overflow-hidden p-4 md:p-8 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <span className="text-[12px] font-bold text-[#9c9c9c] uppercase tracking-[0.3em] block mb-2">
                  WebGL Interface
                </span>
                <h2 className="font-sans text-[28px] md:text-[36px] font-bold text-white uppercase tracking-tight">
                  Real-time 3D Orbit Map
                </h2>
              </div>
              <Link
                href="/map"
                className="flex items-center justify-center h-11 px-6 bg-white hover:bg-[#cacaca] text-black text-xs font-bold uppercase tracking-widest transition-all duration-300 cursor-pointer"
              >
                <span>Explore Orbit Map</span>
              </Link>
            </div>
            
            <div className="relative group rounded-[8px] overflow-hidden border border-[#212121]">
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10 z-10 pointer-events-none" />
              <img
                src="/earth-3dview.png"
                alt="OrbitGuard 3D Visualizer"
                className="w-full h-auto object-cover transform scale-100 group-hover:scale-[1.02] transition-transform duration-700 ease-out"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 4. Metrics Strip */}
      <section id="metrics" className="bg-[#080808] border-y border-[#212121] py-24">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-px bg-[#212121]">
          
          {/* Metric 1 */}
          <div className="bg-[#080808] p-10 flex flex-col justify-center items-center text-center">
            <span className="font-sans text-[54px] font-bold text-white block leading-none mb-4 uppercase">
              16K+
            </span>
            <span className="text-[12px] font-bold text-[#9c9c9c] uppercase tracking-widest">
              Active Satellites Tracked
            </span>
          </div>

          {/* Metric 2 */}
          <div className="bg-[#080808] p-10 flex flex-col justify-center items-center text-center">
            <span className="font-sans text-[54px] font-bold text-white block leading-none mb-4 uppercase">
              48Hr
            </span>
            <span className="text-[12px] font-bold text-[#9c9c9c] uppercase tracking-widest">
              Standard Prediction Window
            </span>
          </div>

          {/* Metric 3 */}
          <div className="bg-[#080808] p-10 flex flex-col justify-center items-center text-center">
            <span className="font-sans text-[54px] font-bold text-white block leading-none mb-4 uppercase">
              3
            </span>
            <span className="text-[12px] font-bold text-[#9c9c9c] uppercase tracking-widest">
              Stage Triage Funnel
            </span>
          </div>

          {/* Metric 4 */}
          <div className="bg-[#080808] p-10 flex flex-col justify-center items-center text-center">
            <span className="font-sans text-[54px] font-bold text-white block leading-none mb-4 uppercase">
              SGP4
            </span>
            <span className="text-[12px] font-bold text-[#9c9c9c] uppercase tracking-widest">
              Real Physics Engine
            </span>
          </div>

        </div>
      </section>

      {/* 5. How It Works (The Pillars) */}
      <section id="how-it-works" className="bg-[#101010] py-32 border-b border-[#212121]">
        <div className="max-w-6xl mx-auto px-6 space-y-16">
          
          <div className="text-center space-y-6 max-w-2xl mx-auto mb-20">
            <span className="text-[12px] font-bold text-[#9c9c9c] uppercase tracking-[0.3em] block">
              ARCHITECTURE
            </span>
            <h2 className="font-sans text-[40px] md:text-[56px] font-bold text-white leading-none uppercase tracking-tight">
              How OrbitGuard Works
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Pillar 1 */}
            <div className="bg-[#080808] p-12 border border-[#212121] transition-colors duration-300 hover:border-white flex flex-col justify-start">
              <span className="text-[11px] font-bold tracking-widest text-[#9c9c9c] border border-[#212121] px-3 py-1 uppercase self-start mb-8">
                Stage 01
              </span>
              <h3 className="font-sans text-[28px] font-bold text-white uppercase mb-4">
                Threat Triage
              </h3>
              <p className="text-[15px] leading-relaxed text-[#9c9c9c] font-normal">
                Checking 128 million pairs of 16,000+ satellites is computationally impossible in real time. We filter the catalog through a massive 3-stage funnel using SGP4 propagation to find objects that will pass within 5km of your asset over the next 48 hours.
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="bg-[#080808] p-12 border border-[#212121] transition-colors duration-300 hover:border-white flex flex-col justify-start">
              <span className="text-[11px] font-bold tracking-widest text-[#9c9c9c] border border-[#212121] px-3 py-1 uppercase self-start mb-8">
                Stage 02
              </span>
              <h3 className="font-sans text-[28px] font-bold text-white uppercase mb-4">
                AI Risk Explanation
              </h3>
              <p className="text-[15px] leading-relaxed text-[#9c9c9c] font-normal">
                Complex orbital data and Akella-Alfriend 2D collision probabilities are translated into plain English using advanced AI models. This allows commanders to instantly understand the threat and make rapid decisions without being orbital mechanics experts.
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="bg-[#080808] p-12 border border-[#212121] transition-colors duration-300 hover:border-white flex flex-col justify-start">
              <span className="text-[11px] font-bold tracking-widest text-[#9c9c9c] border border-[#212121] px-3 py-1 uppercase self-start mb-8">
                Stage 03
              </span>
              <h3 className="font-sans text-[28px] font-bold text-white uppercase mb-4">
                Maneuver Generation
              </h3>
              <p className="text-[15px] leading-relaxed text-[#9c9c9c] font-normal">
                Using Clohessy-Wiltshire relative-motion physics and the Tsiolkovsky rocket equation, the system calculates exactly what direction to fire your thrusters (Delta-V) and how many grams of fuel it will cost to achieve a safe miss distance.
              </p>
            </div>

            {/* Pillar 4 */}
            <div className="bg-[#080808] p-12 border border-[#212121] transition-colors duration-300 hover:border-white flex flex-col justify-start">
              <span className="text-[11px] font-bold tracking-widest text-[#9c9c9c] border border-[#212121] px-3 py-1 uppercase self-start mb-8">
                Stage 04
              </span>
              <h3 className="font-sans text-[28px] font-bold text-white uppercase mb-4">
                Trade-off Comparison
              </h3>
              <p className="text-[15px] leading-relaxed text-[#9c9c9c] font-normal">
                OrbitGuard compares 3 different dodge options (Small, Medium, Large) based on safety, fuel efficiency, and a critical secondary risk check to guarantee your maneuver doesn&apos;t accidentally cause a collision with a different satellite.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* 6. Footer */}
      <footer className="bg-[#101010] py-16 text-center">
        <div className="max-w-6xl mx-auto px-6 space-y-6">
          <div className="flex items-center justify-center space-x-3">
            <span className="font-sans font-bold text-[20px] tracking-[0.1em] text-white uppercase">
              OrbitGuard
            </span>
          </div>
          <p className="text-[11px] font-bold text-[#9c9c9c] uppercase tracking-[0.2em]">
            © 2026 OrbitGuard Space Traffic Systems.
          </p>
          <div className="flex justify-center space-x-8 pt-4 text-[#9c9c9c] text-xs font-bold uppercase tracking-widest">
            <Link href="/dashboard" className="hover:text-white transition-colors">Console</Link>
            <Link href="/conjunctions" className="hover:text-white transition-colors">Triage</Link>
            <a href="https://celestrak.org" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">CelesTrak Source</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
