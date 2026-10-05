import React from 'react';
import { X, HardHat, Cpu, ShieldCheck, Database, Layers, GitBranch, ArrowRight, Zap } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 w-full max-w-3xl max-h-[85vh] overflow-y-auto space-y-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <HardHat className="h-5 w-5" />
              </div>
              <h2 className="text-base font-bold text-white">
                SiteSync – Planning-to-Execution Bridge Architecture
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Industrial Oil &amp; Gas EPC Execution Engine: From Unstructured Field Reality to P6 Baseline Truth
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Section 1: The Core Problem */}
        <div className="space-y-2 text-xs">
          <h3 className="font-bold text-amber-400 uppercase tracking-wider text-[11px]">
            1. The Problem: The Planning-to-Execution Chasm
          </h3>
          <p className="text-slate-300 leading-relaxed">
            In industrial infrastructure megaprojects (refineries, LNG trains, petrochemical complexes), project schedules exist as rigorous Primavera P6 or MS Project L5/L6 networks with thousands of distinct activity IDs (e.g., <code className="font-mono text-amber-300">PIP-201 Erect Line 24&quot;-PR-1042 Spool</code>).
            However, site execution data arrives in fragmented, noisy formats: WhatsApp audio notes, Hinglish field logs, handwritten daily diaries, and non-standard subcontractor spreadsheets.
          </p>
          <p className="text-slate-300 leading-relaxed">
            Traditionally, planners spend 5+ days per week manually reconciling these updates, leading to a <strong className="text-white">120-hour data lag</strong> where delay cascades are discovered too late to mitigate. SiteSync closes this chasm with automated fuzzy matching, human-in-the-loop routing, and institutional memory.
          </p>
        </div>

        {/* Section 2: The Multi-Layer Hybrid Matching Engine */}
        <div className="space-y-2 text-xs">
          <h3 className="font-bold text-sky-400 uppercase tracking-wider text-[11px]">
            2. Multi-Layer Hybrid Matching Pipeline
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
              <span className="font-bold text-slate-200 block">Layer A: Deterministic</span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Regex extracts physical line tags (<code className="font-mono text-emerald-400">24&quot;-PR-1042</code>) and equipment identifiers (<code className="font-mono text-emerald-400">P-101, C-201</code>). Normalizes OCR noise and expands synonyms using an EPC-specific lexicon (PCC, RCC, RT, spool, blinding).
              </p>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
              <span className="font-bold text-slate-200 block">Layer B: Fuzzy Token-Set</span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Jaccard and Dice token-set overlap with Levenshtein typo-tolerance, filtered strictly by discipline and plant area constraints to prevent cross-trade false positives.
              </p>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
              <span className="font-bold text-slate-200 block">Layer C: LLM Re-Ranker</span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Sends the top 5 candidate activities to Gemini 3.8 Flash with structured schema to referee boundary ambiguities, generate human-readable engineering reasoning, and compute 0-100 confidence.
              </p>
            </div>
          </div>
        </div>

        {/* Section 3: Confidence Routing & Anomaly Detection */}
        <div className="space-y-2 text-xs">
          <h3 className="font-bold text-emerald-400 uppercase tracking-wider text-[11px]">
            3. Confidence Routing &amp; Topological Anomaly Guardrails
          </h3>
          <p className="text-slate-300 leading-relaxed">
            Events with confidence <strong className="text-emerald-400 font-mono">≥85%</strong> are auto-committed directly to the live schedule. Matches between <strong className="text-amber-400 font-mono">60–84%</strong> require one-tap planner approval. Matches <strong className="text-rose-400 font-mono">&lt;60%</strong> or novel work packages route to the Planner Review Inbox.
          </p>
          <p className="text-slate-300 leading-relaxed">
            Concurrently, the <strong className="text-white">Anomaly Detection Engine</strong> continuously verifies schedule graph invariants:
          </p>
          <ul className="list-disc list-inside text-slate-400 space-y-0.5 ml-2 font-mono text-[11px]">
            <li>Finish event occurring chronologically before actual start</li>
            <li>Downstream activity starting before predecessor actual finish</li>
            <li>Cumulative progress exceeding 100% of planned quantity</li>
            <li>Implausible execution duration deviating &gt;3x from planned baseline</li>
            <li>Cross-source timestamp contradictions between diary and subcon logs</li>
          </ul>
        </div>

        {/* Section 4: Production Scaling Architecture */}
        <div className="space-y-2 text-xs">
          <h3 className="font-bold text-indigo-400 uppercase tracking-wider text-[11px]">
            4. Scaling to Enterprise Production
          </h3>
          <div className="space-y-2 bg-slate-950 p-3 rounded-lg border border-slate-800 text-[11px] text-slate-300">
            <div className="flex items-start gap-2">
              <Cpu className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">OCR &amp; Multimodal Ingestion:</strong> In production, multi-page scanned site diary PDFs are processed asynchronously via Document AI and Gemini Flash Multimodal, extracting tabular crew breakdowns and engineer stamps.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Database className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">Primavera P6 REST &amp; XER Bridge:</strong> Direct two-way sync with Oracle Primavera P6 EPPM via REST API and Primavera XML/XER parsers, with Retained Logic schedule recalculation.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">Role-Based Access Control (RBAC):</strong> Separation of duties between Field Supervisors (voice/chat log submission only), Area Planners (match approval &amp; re-linking), and Lead Planners (PMIS write authorization &amp; baseline resets).
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500 font-mono">
          <span>SiteSync v2.6 · Google AI Studio Build</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-sans font-medium transition-colors"
          >
            Close Overview
          </button>
        </div>
      </div>
    </div>
  );
};
