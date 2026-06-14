'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  Play, 
  ChevronRight, 
  Volume2, 
  VolumeX, 
  X, 
  Sparkles, 
  Radio, 
  Target, 
  Award,
  HelpCircle,
  HelpCircle as ShieldAlert
} from 'lucide-react';
import { soundSynth } from '@/lib/sound-effects';
import { cn } from '@/lib/utils';

interface TourStepInfo {
  step: number;
  title: string;
  path: string;
  narration: string;
  instructions: string;
  actionText: string;
}

const TOUR_STEPS: TourStepInfo[] = [
  {
    step: 1,
    title: 'Emergency Detection',
    path: '/dashboard',
    narration: 'Warning: Critical collision alert detected! Chinese Fengyun-1C debris is projected to intercept Starlink-4892 in LEO. Let us analyze the orbits on the 3D Map.',
    instructions: 'A critical conjunction has been detected in LEO. Inspect the active hazard cards on the dashboard, then click the button below to inspect it in the 3D Orbit Map.',
    actionText: 'Inspect 3D Orbit Map →'
  },
  {
    step: 2,
    title: 'Orbital Visualizer',
    path: '/map',
    narration: 'Loading SGP4 orbital tracks. Observe Chinese Fengyun-1C debris heading toward Starlink-4892. Proximity separation is critical. Click the warning zone or click the action button to plan evasion.',
    instructions: 'Examine the intersecting red orbits and live separation labels. Click the button below to load the Clohessy-Wiltshire physics solver.',
    actionText: 'Configure Evasive Maneuver →'
  },
  {
    step: 3,
    title: 'Maneuver Simulation',
    path: '/maneuvers',
    narration: 'Maneuver Simulation workspace loaded. Drag the Delta-V and lead-time sliders in the right panel to bend the trajectory into safe coordinates.',
    instructions: 'Select the "Interactive Sandbox" options. Adjust the Delta-V magnitude and Lead-time slider until the deflected green trajectory clears the threat zone (minimum 5.0 km separation).',
    actionText: 'Recalculating Trajectory...'
  },
  {
    step: 4,
    title: 'Burn Scheduled',
    path: '/maneuvers',
    narration: 'Burn vector authorized! Starlink-4892 is scheduled for ignition. Let us navigate to the AI Situation Briefing to audit the flight clearance report.',
    instructions: 'The thruster ignition is successfully locked in. Click the button below to consult the AI briefing summarizing the orbital safety audit.',
    actionText: 'View AI Flight Briefing →'
  },
  {
    step: 5,
    title: 'Mission Averted',
    path: '/ai-briefing',
    narration: 'Congratulations, Commander! The space hazard has been successfully mitigated. OrbitGuard has secured the assets. You are ready to present this project.',
    instructions: 'The AI flight briefing has generated a plain-language executive summary. All systems report clearance. The orbital segment is safe.',
    actionText: 'Finish Walkthrough'
  }
];

export function GuidedTour() {
  const router = useRouter();
  const pathname = usePathname();
  
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Load state from local storage on mount
  useEffect(() => {
    const savedActive = localStorage.getItem('orbitguard_tour_active');
    const savedStep = localStorage.getItem('orbitguard_tour_step');
    if (savedActive === 'true') {
      setActive(true);
      setStep(savedStep ? parseInt(savedStep, 10) : 1);
    }
  }, []);

  // Sync state to local storage
  const updateTourState = (newActive: boolean, newStep: number) => {
    setActive(newActive);
    setStep(newStep);
    localStorage.setItem('orbitguard_tour_active', newActive.toString());
    localStorage.setItem('orbitguard_tour_step', newStep.toString());
  };

  const [voiceList, setVoiceList] = useState<SpeechSynthesisVoice[]>([]);

  // Load and update high-fidelity system voices asynchronously
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const updateVoices = () => {
      setVoiceList(window.speechSynthesis.getVoices());
    };
    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  const speakText = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    
    if (!soundEnabled) return;

    // Play a subtle space radio mic click sound effect right before speaking
    soundSynth.playBeep();

    const utterance = new SpeechSynthesisUtterance(text);
    // Rate 0.92 sounds calm, professional, and authoritative (like NASA mission control)
    utterance.rate = 0.92; 
    utterance.pitch = 1.05; // slightly higher pitch for clean digital voice feel
    
    // Select premium neural/natural system voices if available
    let selectedVoice = voiceList.find(v => v.lang.startsWith('en') && (
      v.name.toLowerCase().includes('google') ||
      v.name.toLowerCase().includes('natural') ||
      v.name.toLowerCase().includes('samantha') ||
      v.name.toLowerCase().includes('siri') ||
      v.name.toLowerCase().includes('daniel') ||
      v.name.toLowerCase().includes('premium') ||
      v.name.toLowerCase().includes('neural')
    ));

    // Fallback to standard English voice
    if (!selectedVoice) {
      selectedVoice = voiceList.find(v => v.lang.startsWith('en'));
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
  };

  // Stop speech synthesis on component unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Trigger sound alerts and voice narrations on step change
  useEffect(() => {
    if (!active || step === 0) {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      return;
    }

    const currentStepInfo = TOUR_STEPS.find(s => s.step === step);
    if (!currentStepInfo) return;

    // Check if the user is on the correct page. If not, redirect
    if (pathname !== currentStepInfo.path) {
      router.push(currentStepInfo.path);
      return; // The next render cycle on the new page will trigger this effect
    }

    // Play appropriate sound effect
    if (soundEnabled) {
      if (step === 1) soundSynth.playAlarm();
      else if (step === 4) soundSynth.playChime();
      else if (step === 5) soundSynth.playFanfare();
      else soundSynth.playBeep();
    }

    // Speak narration
    speakText(currentStepInfo.narration);
  }, [active, step, pathname]);

  const startTour = () => {
    soundSynth.playBeep();
    updateTourState(true, 1);
  };

  const stopTour = () => {
    soundSynth.playBeep();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    updateTourState(false, 0);
  };

  const handleNextStep = () => {
    soundSynth.playBeep();
    if (step < TOUR_STEPS.length) {
      updateTourState(true, step + 1);
    } else {
      stopTour();
    }
  };

  const toggleSound = () => {
    soundSynth.playBeep();
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    if (!nextVal && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  // Check if we are on step 3 (slider challenge)
  const isSliderStep = step === 3;
  
  // Custom logic to detect if simulator has solved the collision (miss distance > 5 km)
  // We check the DOM or local state concept by letting the user advance once they satisfy the condition
  const [sandboxCleared, setSandboxCleared] = useState(false);

  useEffect(() => {
    if (isSliderStep && typeof window !== 'undefined') {
      const interval = setInterval(() => {
        // Look for the "new miss distance" element on the page
        const newMissText = document.querySelector('.text-cleared-green.font-bold');
        if (newMissText) {
          const val = parseFloat(newMissText.textContent || '0');
          if (val >= 5.0) {
            setSandboxCleared(true);
            clearInterval(interval);
          }
        }
      }, 500);
      return () => clearInterval(interval);
    } else {
      setSandboxCleared(false);
    }
  }, [isSliderStep, step, pathname]);

  // If tour is inactive, render a sleek toolbar button at the bottom of the screen
  if (!active) {
    return (
      <div className="fixed bottom-6 right-6 z-50 animate-slide-in">
        <button
          onClick={startTour}
          className="flex items-center space-x-2 px-4 py-2.5 bg-purple-900 border border-purple-400 hover:bg-purple-800 text-white font-display text-[11px] font-bold tracking-wider uppercase rounded-md shadow-[0_0_15px_rgba(168,85,247,0.3)] transition-all scale-100 hover:scale-105 active:scale-95 cursor-pointer"
        >
          <Sparkles className="h-4 w-4 text-purple-200 animate-spin" />
          <span>Launch Demo Playbook</span>
        </button>
      </div>
    );
  }

  const currentStep = TOUR_STEPS.find(s => s.step === step);
  if (!currentStep) return null;

  return (
    <>
      {/* Cinematic HUD Subtitles Closed Captions Bar */}
      {isSpeaking && soundEnabled && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-void/95 border border-purple-500/40 text-bone px-6 py-3 rounded-[4px] font-display text-[12px] tracking-wide text-center z-50 max-w-xl animate-fade-in-slide shadow-[0_0_20px_rgba(168,85,247,0.25)] flex items-center space-x-3 pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping shrink-0" />
          <span className="leading-relaxed font-semibold italic text-purple-200">
            {currentStep.narration}
          </span>
        </div>
      )}

      <div className="fixed bottom-6 right-6 z-50 w-[350px] bg-void/95 border border-purple-400/80 rounded-[4px] shadow-[0_0_25px_rgba(168,85,247,0.25)] p-4 font-display animate-slide-in">
      
      {/* Header Controls */}
      <div className="flex items-center justify-between border-b border-purple-500/20 pb-2 mb-2">
        <div className="flex items-center space-x-2 text-purple-300">
          <Sparkles className="h-4 w-4 animate-pulse" />
          <span className="text-[10.5px] font-bold uppercase tracking-wider">
            DEMO PLAYBOOK — STEP {step} OF 5
          </span>
        </div>
        <div className="flex items-center space-x-1">
          <button 
            onClick={toggleSound}
            className="p-1 text-ash hover:text-bone rounded cursor-pointer"
            title={soundEnabled ? 'Mute Narrator' : 'Unmute Narrator'}
          >
            {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          </button>
          <button 
            onClick={stopTour}
            className="p-1 text-ash hover:text-bone rounded cursor-pointer"
            title="Exit Walkthrough"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Step Description */}
      <div className="space-y-3">
        <h4 className="text-[13px] font-bold text-bone uppercase tracking-wide">
          {currentStep.title}
        </h4>
        
        <p className="text-[11.5px] text-ash leading-relaxed font-body">
          {currentStep.instructions}
        </p>

        {isSliderStep && !sandboxCleared && (
          <div className="p-2 border border-purple-500/30 bg-purple-950/20 rounded-[2px] text-[10px] text-purple-300 font-data animate-pulse">
            🚨 TASK: Adjust the sandbox Delta-V magnitude and Lead-time until Projected Miss Distance reaches at least 5.0 km.
          </div>
        )}

        {isSliderStep && sandboxCleared && (
          <div className="p-2 border border-cleared-green/30 bg-cleared-green/5 rounded-[2px] text-[10px] text-cleared-green font-data">
            ✅ TASK COMPLETE: Orbital deflection parameters secure! Click "Approve & Schedule Burn" in the center panel.
          </div>
        )}

        {/* Action button */}
        <div className="pt-2">
          {isSliderStep ? (
            <button
              disabled={!sandboxCleared}
              onClick={() => {
                // Trigger click on the page's actual approve button to simulate workflow
                const approveBtn = document.querySelector('button[class*="bg-orbit-cyan"]');
                if (approveBtn) {
                  (approveBtn as HTMLButtonElement).click();
                  handleNextStep();
                } else {
                  handleNextStep();
                }
              }}
              className={cn(
                "w-full py-2 font-bold text-[10px] uppercase tracking-wider rounded-[2px] transition-colors cursor-pointer text-center",
                sandboxCleared
                  ? "bg-purple-600 hover:bg-purple-500 text-white border border-purple-400"
                  : "bg-void border border-iron text-graphite cursor-not-allowed"
              )}
            >
              {sandboxCleared ? 'Authorize & Execute Burn →' : 'Optimizing Orbital Path...'}
            </button>
          ) : (
            <button
              onClick={() => {
                if (step === 1) router.push('/map');
                else if (step === 2) router.push('/maneuvers?event=CONJ-2026-001');
                else if (step === 4) router.push('/ai-briefing?event=CONJ-2026-001');
                else if (step === 5) stopTour();
                
                if (step !== 5 && step !== 3) {
                  handleNextStep();
                }
              }}
              className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] uppercase tracking-wider rounded-[2px] border border-purple-400 transition-colors cursor-pointer text-center"
            >
              {currentStep.actionText}
            </button>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
