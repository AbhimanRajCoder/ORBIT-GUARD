"use client";

import * as React from "react";
import { Shield, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuditEntry {
  candidate_id: string;
  chosen_option_id: string;
  approved_by: string;
  operator_role: string;
  confirmation_token: string;
  approved_at: string;
  status: string;
  delta_v_ms: number;
  fuel_cost_kg: number;
}

export default function AuditPage() {
  const [entries, setEntries] = React.useState<AuditEntry[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [verifying, setVerifying] = React.useState<boolean>(false);
  const [verificationResult, setVerificationResult] = React.useState<{ all_valid: boolean; checked_count: number } | null>(null);

  React.useEffect(() => {
    async function loadAuditLog() {
      try {
        const res = await fetch("/api/audit");
        if (res.ok) {
          const data = await res.json();
          setEntries(data);
        }
      } catch (e) {
        console.error("Failed to load audit trail:", e);
      } finally {
        setLoading(false);
      }
    }
    loadAuditLog();
  }, []);

  const handleVerifyChain = async () => {
    setVerifying(true);
    setVerificationResult(null);
    try {
      const res = await fetch("/api/audit/verify");
      if (res.ok) {
        const data = await res.json();
        setVerificationResult(data);
      }
    } catch (e) {
      console.error("Failed to verify audit chain:", e);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 space-y-12">
      {/* Editorial Header */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Shield className="h-5 w-5 text-orbit-cyan" strokeWidth={1.5} />
          <span className="font-mono text-[11px] font-medium tracking-[0.1820em] uppercase text-ash">
            Secure Cryptographic Registry
          </span>
        </div>
        <h1 className="font-display text-[44px] font-light text-cloud leading-none">
          Audit <span className="italic font-light">Trail</span>
        </h1>
        <p className="font-sans text-[18px] font-light text-ash max-w-xl">
          A tamper-proof ledger documenting all approved satellite collision avoidance maneuvers. Every entry is chained using SHA-256 integrity hashes.
        </p>
      </div>

      {/* Action panel & Verification status */}
      <div className="bg-graphite border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="space-y-1">
          <span className="font-display text-[16px] font-semibold text-cloud">
            Verify Chain Integrity
          </span>
          <p className="font-sans text-[14px] text-ash">
            Recompute all block hashes and verify the cryptographic integrity of the ledger.
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={handleVerifyChain}
            disabled={verifying}
            className="px-6 py-2.5 bg-pure text-void hover:bg-cloud active:scale-95 transition-all rounded-lg font-sans text-[16px] font-medium flex items-center space-x-2"
          >
            {verifying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-void" />
                <span>Verifying...</span>
              </>
            ) : (
              <span>Verify Chain →</span>
            )}
          </button>
        </div>
      </div>

      {/* Verification alerts */}
      {verificationResult && (
        <div
          className={cn(
            "p-5 rounded-2xl border flex items-start space-x-3 transition-all",
            verificationResult.all_valid
              ? "bg-cleared-green/10 border-cleared-green/30 text-cleared-green"
              : "bg-collision-red/10 border-collision-red/30 text-collision-red"
          )}
        >
          {verificationResult.all_valid ? (
            <>
              <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-sans text-[16px] font-bold">Ledger Integrity Secure</span>
                <p className="font-sans text-[14px] opacity-90">
                  Successfully verified {verificationResult.checked_count} cryptographic block headers. No tampering detected.
                </p>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-sans text-[16px] font-bold">INTEGRITY VIOLATION DETECTED</span>
                <p className="font-sans text-[14px] opacity-90">
                  A verification mismatch occurred. The cryptographic signature chain contains invalid or out-of-order blocks.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Timeline entries */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-orbit-cyan" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-20 bg-graphite/40 border border-white/5 rounded-2xl">
          <span className="font-mono text-[11px] uppercase tracking-wider text-ash">
            No entries in registry
          </span>
        </div>
      ) : (
        <div className="relative border-l border-white/10 pl-6 ml-4 space-y-8">
          {entries.map((entry, idx) => {
            const date = new Date(entry.approved_at);
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + " UTC";
            const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
            
            return (
              <div key={idx} className="relative group">
                {/* Timeline node */}
                <div className="absolute -left-[31px] top-1.5 w-4 h-4 bg-void border-2 border-orbit-cyan rounded-full transition-all group-hover:scale-125" />
                
                {/* Entry Card */}
                <div className="bg-graphite border border-white/10 rounded-2xl p-6 space-y-4 hover:border-white/20 transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-white/5 pb-3">
                    <div className="space-y-0.5">
                      <span className="font-mono text-[11px] text-ash">
                        {dateStr} — {timeStr}
                      </span>
                      <h3 className="font-sans text-[16px] font-semibold text-cloud">
                        Maneuver Gated Approval Granted
                      </h3>
                    </div>
                    
                    <span className="self-start sm:self-center font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 bg-cleared-green/20 border border-cleared-green/30 text-cleared-green rounded-full">
                      {entry.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                    <div className="space-y-1">
                      <span className="font-mono text-[10px] text-ash uppercase tracking-wider block">
                        Threat Target
                      </span>
                      <span className="font-mono text-[13px] font-medium text-cloud">
                        NORAD ID {entry.candidate_id}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="font-mono text-[10px] text-ash uppercase tracking-wider block">
                        Burn Size
                      </span>
                      <span className="font-mono text-[13px] font-medium text-cloud">
                        {entry.delta_v_ms.toFixed(3)} m/s
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="font-mono text-[10px] text-ash uppercase tracking-wider block">
                        Propellant Mass
                      </span>
                      <span className="font-mono text-[13px] font-medium text-cloud">
                        {entry.fuel_cost_kg.toFixed(3)} kg
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="font-mono text-[10px] text-ash uppercase tracking-wider block">
                        Approved By
                      </span>
                      <span className="font-sans text-[13px] text-cloud">
                        {entry.approved_by} ({entry.operator_role})
                      </span>
                    </div>
                  </div>

                  <div className="bg-void p-3 rounded-lg border border-white/5">
                    <span className="font-mono text-[10px] text-ash uppercase tracking-wider block mb-1">
                      SHA-256 Token Signature
                    </span>
                    <span className="font-mono text-[11px] text-orbit-cyan break-all">
                      {entry.confirmation_token}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
