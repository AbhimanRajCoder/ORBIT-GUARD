"use client";

import * as React from "react";
import {
  Globe,
  Radio,
  Zap,
  MessageSquare,
  Target,
  ScrollText,
  X,
  ChevronRight,
  ChevronLeft,
  Satellite,
  Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ONBOARDING_KEY = "orbitguard-onboarding-seen";

interface Step {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  features: string[];
  accent: string;
}

const steps: Step[] = [
  {
    icon: <Satellite className="h-8 w-8" strokeWidth={1.2} />,
    title: "Welcome to OrbitGuard",
    subtitle: "AUTOMATED SPACE TRAFFIC CONTROL",
    description:
      "OrbitGuard is a mission-control dashboard for Earth's orbit. It monitors 13,000+ objects in real-time, detects collision threats, and automates the entire avoidance pipeline.",
    features: [
      "Real-time SSE telemetry streaming",
      "6 tracked satellites with live position updates",
      "Automated collision probability analysis",
    ],
    accent: "orbit-cyan",
  },
  {
    icon: <Globe className="h-8 w-8" strokeWidth={1.2} />,
    title: "3D Orbit Visualization",
    subtitle: "INTERACTIVE WEBGL GLOBE",
    description:
      "Explore a full Three.js 3D globe with satellite orbits, debris clouds, and pulsing risk zones. Click any object to inspect its telemetry.",
    features: [
      "Orbit rings at 400km, 550km, 800km, 1200km",
      "Color-coded risk zones for conjunction events",
      "Mouse-driven camera orbit and object selection",
    ],
    accent: "cleared-green",
  },
  {
    icon: <Zap className="h-8 w-8" strokeWidth={1.2} />,
    title: "Collision Avoidance Engine",
    subtitle: "KEPLERIAN PHYSICS + AI",
    description:
      "When a threat is detected, OrbitGuard calculates optimal evasive maneuvers using real orbital mechanics — then checks each burn against the satellite's mission schedule.",
    features: [
      "3 maneuver strategies: Min Fuel / Balanced / Max Safety",
      "Mission Impact Checker for comms, observation, solar power",
      "AI Negotiator for two-party coordination between operators",
    ],
    accent: "collision-red",
  },
];

export function OnboardingModal() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [currentStep, setCurrentStep] = React.useState(0);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const seen = localStorage.getItem(ONBOARDING_KEY);
      if (!seen) {
        // Small delay so the dashboard loads first
        const timer = setTimeout(() => setIsOpen(true), 800);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem(ONBOARDING_KEY, "true");
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  if (!isOpen) return null;

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-void border border-iron rounded-[4px] overflow-hidden animate-slide-in select-none">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 p-1.5 text-graphite hover:text-bone transition-colors cursor-pointer bg-transparent border-0"
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>

        {/* Top accent bar */}
        <div className={cn("h-[2px] w-full", {
          "bg-orbit-cyan": step.accent === "orbit-cyan",
          "bg-cleared-green": step.accent === "cleared-green",
          "bg-collision-red": step.accent === "collision-red",
        })} />

        {/* Content */}
        <div className="p-8">
          {/* Icon & Step indicator */}
          <div className="flex items-center justify-between mb-6">
            <div className={cn("p-3 rounded-[4px] border", {
              "text-orbit-cyan border-orbit-cyan/30 bg-orbit-cyan/5": step.accent === "orbit-cyan",
              "text-cleared-green border-cleared-green/30 bg-cleared-green/5": step.accent === "cleared-green",
              "text-collision-red border-collision-red/30 bg-collision-red/5": step.accent === "collision-red",
            })}>
              {step.icon}
            </div>
            <span className="font-data text-[11px] text-graphite uppercase tracking-wider">
              {currentStep + 1} / {steps.length}
            </span>
          </div>

          {/* Title */}
          <span className="font-display text-[10px] text-ash uppercase tracking-[0.15em] block mb-1">
            {step.subtitle}
          </span>
          <h2 className="font-display text-[22px] font-bold text-bone uppercase tracking-wide mb-4">
            {step.title}
          </h2>

          {/* Description */}
          <p className="font-body text-[13px] text-ash leading-relaxed mb-6">
            {step.description}
          </p>

          {/* Feature list */}
          <div className="space-y-2.5 mb-8">
            {step.features.map((feature, i) => (
              <div key={i} className="flex items-start space-x-3">
                <span className={cn("mt-1.5 h-1.5 w-1.5 rounded-full shrink-0", {
                  "bg-orbit-cyan": step.accent === "orbit-cyan",
                  "bg-cleared-green": step.accent === "cleared-green",
                  "bg-collision-red": step.accent === "collision-red",
                })} />
                <span className="font-data text-[12px] text-bone/80 leading-relaxed">
                  {feature}
                </span>
              </div>
            ))}
          </div>

          {/* Step dots */}
          <div className="flex items-center justify-center space-x-2 mb-6">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300 cursor-pointer bg-transparent border-0",
                  i === currentStep
                    ? "w-6 bg-bone"
                    : "w-1.5 bg-graphite hover:bg-ash"
                )}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrev}
              disabled={currentStep === 0}
              className={cn(
                "flex items-center space-x-1.5 font-display text-[11px] uppercase tracking-wider py-2 px-4 rounded-[4px] border transition-colors cursor-pointer bg-transparent",
                currentStep === 0
                  ? "text-graphite border-iron/30 cursor-not-allowed"
                  : "text-ash border-iron hover:text-bone hover:border-graphite"
              )}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </button>

            <button
              onClick={handleNext}
              className={cn(
                "flex items-center space-x-1.5 font-display text-[11px] uppercase tracking-wider py-2 px-5 rounded-[4px] border transition-colors cursor-pointer",
                isLast
                  ? "bg-orbit-cyan/10 border-orbit-cyan/40 text-orbit-cyan hover:bg-orbit-cyan/20"
                  : "bg-transparent border-iron text-bone hover:border-graphite"
              )}
            >
              <span>{isLast ? "Enter Mission Control" : "Next"}</span>
              {isLast ? (
                <Rocket className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
