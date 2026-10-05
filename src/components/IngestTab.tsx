import React, { useState } from 'react';
import {
  FileText,
  Upload,
  Sparkles,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  FileSpreadsheet,
  Image as ImageIcon,
  Play,
  RotateCw,
  ExternalLink,
  ChevronRight,
  Tag,
  Calendar,
  Layers,
  Check,
} from 'lucide-react';
import { ExtractedEvent, PlanActivity, LearnedMapping, Discipline } from '../types';
import { SAMPLE_INPUTS, SampleInput } from '../data/sampleInputs';
import { matchEventToActivities } from '../services/matchingEngine';
import { detectConflicts } from '../services/conflictDetector';
import { applyEventToActivity } from '../services/confidenceRouter';

interface IngestTabProps {
  planActivities: PlanActivity[];
  learnedMappings: LearnedMapping[];
  onCommitEvents: (
    events: ExtractedEvent[],
    updatedActivities: PlanActivity[],
    newAlerts: any[],
    newAuditEntries: any[]
  ) => void;
  onSendToReview: (events: ExtractedEvent[]) => void;
}

export const IngestTab: React.FC<IngestTabProps> = ({
  planActivities,
  learnedMappings,
  onCommitEvents,
  onSendToReview,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<'text' | 'csv' | 'ocr_snippet' | 'diary_image'>('text');
  const [inputText, setInputText] = useState<string>(SAMPLE_INPUTS[0].content);
  const [documentName, setDocumentName] = useState<string>(SAMPLE_INPUTS[0].documentName);
  const [reportDate, setReportDate] = useState<string>(SAMPLE_INPUTS[0].reportDate);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [extractedEvents, setExtractedEvents] = useState<ExtractedEvent[]>([]);
  const [batchCommitted, setBatchCommitted] = useState<boolean>(false);

  const pipelineSteps = [
    { label: 'Parse Input', desc: 'Tokenize text / OCR image' },
    { label: 'Extract Schema', desc: 'JSON-constrained events' },
    { label: 'Hybrid Match', desc: 'Tags + Synonyms + P6 WBS' },
    { label: 'Score & Re-rank', desc: 'Explainable confidence' },
    { label: 'Route Queue', desc: 'Auto-commit vs Planner Inbox' },
  ];

  const handleLoadSample = (sample: SampleInput) => {
    setSelectedFormat(sample.format);
    setInputText(sample.content);
    setDocumentName(sample.documentName);
    setReportDate(sample.reportDate);
    setImagePreview(sample.imageBase64 || null);
    setExtractedEvents([]);
    setBatchCommitted(false);
    setProcessingError(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDocumentName(file.name);
    setExtractedEvents([]);
    setBatchCommitted(false);

    if (file.type.startsWith('image/')) {
      setSelectedFormat('diary_image');
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
        setInputText(`[Image file uploaded: ${file.name}]`);
      };
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
      if (file.name.endsWith('.csv') || file.name.endsWith('.xlsx')) {
        setSelectedFormat('csv');
      } else {
        setSelectedFormat('text');
      }
      const reader = new FileReader();
      reader.onload = () => {
        setInputText((reader.result as string) || '');
      };
      reader.readAsText(file);
    }
  };

  const runIngestionPipeline = async () => {
    if (!inputText.trim() && !imagePreview) return;
    setIsProcessing(true);
    setProcessingError(null);
    setBatchCommitted(false);

    try {
      // Step 0: Parse
      setCurrentStepIndex(0);
      await new Promise((r) => setTimeout(r, 200));

      let rawExtractedEvents: any[] = [];

      // Step 1: Extract Schema
      setCurrentStepIndex(1);
      if (selectedFormat === 'diary_image' && imagePreview) {
        const res = await fetch('/api/extract-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: imagePreview,
            mimeType: imagePreview.startsWith('data:image/svg') ? 'image/svg+xml' : 'image/png',
            reportDate,
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to extract from image');
        }
        const data = await res.json();
        rawExtractedEvents = data.events || [];
      } else {
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: inputText,
            reportDate,
            documentName,
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Extraction request failed');
        }
        const data = await res.json();
        rawExtractedEvents = data.events || [];
      }

      // Step 2 & 3: Match & Score
      setCurrentStepIndex(2);
      await new Promise((r) => setTimeout(r, 250));
      setCurrentStepIndex(3);

      const processedEvents: ExtractedEvent[] = [];
      for (let i = 0; i < rawExtractedEvents.length; i++) {
        const raw = rawExtractedEvents[i];
        const eventItem: ExtractedEvent = {
          id: `evt-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
          discipline: (raw.discipline || 'Piping') as Discipline,
          rawText: raw.rawText || raw.activityDescription || '',
          activityDescription: raw.activityDescription || raw.rawText || 'Site activity',
          eventType: raw.eventType || 'PROGRESS',
          date: raw.date || reportDate,
          quantityDone: raw.quantityDone !== undefined ? raw.quantityDone : null,
          quantityTotal: raw.quantityTotal !== undefined ? raw.quantityTotal : null,
          percentComplete: raw.percentComplete !== undefined ? raw.percentComplete : null,
          location: raw.location || 'Site Wide',
          tagIds: Array.isArray(raw.tagIds) ? raw.tagIds : [],
          delayReason: raw.delayReason || null,
          delayCategory: raw.delayCategory || null,
          sourceSpan: raw.sourceSpan || (raw.rawText ? raw.rawText.slice(0, 80) : ''),
          sourceDocument: documentName,
          confidence: 0,
          routing: 'REVIEW_INBOX',
          status: 'PENDING_APPROVAL',
        };

        const matchResult = await matchEventToActivities(eventItem, planActivities, learnedMappings, true);
        eventItem.matchedActivityId = matchResult.bestMatch ? matchResult.bestMatch.ActivityID : null;
        eventItem.matchedActivityName = matchResult.bestMatch ? matchResult.bestMatch.Name : null;
        eventItem.confidence = matchResult.confidence;
        eventItem.routing = matchResult.routing;
        eventItem.matchScores = matchResult.matchScores;
        eventItem.topCandidates = matchResult.topCandidates;

        processedEvents.push(eventItem);
      }

      // Step 4: Route
      setCurrentStepIndex(4);
      await new Promise((r) => setTimeout(r, 250));

      setExtractedEvents(processedEvents);

      // Auto-commit events with confidence >= 85
      const autoCommits = processedEvents.filter((e) => e.routing === 'AUTO_COMMITTED' && e.matchedActivityId);
      const needsReview = processedEvents.filter((e) => e.routing !== 'AUTO_COMMITTED' || !e.matchedActivityId);

      if (autoCommits.length > 0) {
        let currentPlan = [...planActivities];
        const newAlerts: any[] = [];
        const newAuditEntries: any[] = [];

        for (const ev of autoCommits) {
          const act = currentPlan.find((a) => a.ActivityID === ev.matchedActivityId);
          if (act) {
            // Check conflicts
            const confs = detectConflicts(ev, act, currentPlan);
            newAlerts.push(...confs);

            // Apply updates
            const { updatedActivity, auditEntry } = applyEventToActivity(ev, act, 'SiteSync Auto-Commit');
            currentPlan = currentPlan.map((a) => (a.ActivityID === act.ActivityID ? updatedActivity : a));
            newAuditEntries.push(auditEntry);
            ev.status = 'COMMITTED';
          }
        }

        onCommitEvents(autoCommits, currentPlan, newAlerts, newAuditEntries);
      }

      if (needsReview.length > 0) {
        onSendToReview(needsReview);
      }

      setBatchCommitted(true);
    } catch (err: any) {
      console.error('Pipeline error:', err);
      setProcessingError(err?.message || 'Failed to complete ingestion pipeline');
    } finally {
      setIsProcessing(false);
      setCurrentStepIndex(-1);
    }
  };

  const getDisciplineColor = (disc: string) => {
    switch (disc) {
      case 'Civil':
        return 'text-amber-300';
      case 'Piping':
        return 'text-sky-300';
      case 'Static Equipment':
        return 'text-indigo-300';
      case 'Rotating Equipment':
        return 'text-teal-300';
      case 'Electrical':
        return 'text-yellow-300';
      case 'Instrumentation':
        return 'text-violet-300';
      case 'HSE':
        return 'text-rose-300';
      default:
        return 'text-slate-300';
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header & Sample Loaders */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            Field Execution Ingestion Engine
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
            <span>Multimodal Ingest</span>
            <span aria-hidden="true">·</span>
            <span>JSON-Constrained Extraction</span>
            <span aria-hidden="true">·</span>
            <span>Deterministic + Fuzzy + LLM Re-Ranking</span>
          </div>
        </div>

        {/* Sample Load Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-400 mr-1 hidden sm:inline">Load Sample:</span>
          {SAMPLE_INPUTS.map((sample) => (
            <button
              key={sample.id}
              onClick={() => handleLoadSample(sample)}
              className="px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700/60 transition-colors whitespace-nowrap"
            >
              {sample.name.split(':')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Pipeline Step Animation Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 sm:p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-300 tracking-wide">
            Automated Ingestion &amp; Matching Pipeline
          </span>
          <span className="text-xs text-slate-500 tabular-nums">
            {isProcessing ? `Running Step ${currentStepIndex + 1} of 5...` : 'Ready to ingest'}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {pipelineSteps.map((step, idx) => {
            const isDone = currentStepIndex > idx || (!isProcessing && batchCommitted);
            const isCurrent = currentStepIndex === idx;
            return (
              <div
                key={step.label}
                className={`p-2.5 rounded border transition-all ${
                  isCurrent
                    ? 'border-amber-500/70 bg-amber-500/10 text-amber-200'
                    : isDone
                    ? 'border-emerald-600/40 bg-emerald-950/20 text-emerald-300'
                    : 'border-slate-800 bg-slate-950/30 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  {isDone ? (
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  ) : isCurrent ? (
                    <RotateCw className="h-3.5 w-3.5 text-amber-400 animate-spin shrink-0" />
                  ) : (
                    <span className="h-3.5 w-3.5 flex items-center justify-center text-[10px] font-mono text-slate-500">
                      {idx + 1}
                    </span>
                  )}
                  <span className="text-xs font-semibold whitespace-nowrap">{step.label}</span>
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-1">{step.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Two-Column View: Raw Input vs Extracted Structured Events */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Raw Input (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-400" />
                <span className="text-xs font-semibold text-slate-200">Raw Input Document</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
                  <Upload className="h-3.5 w-3.5" />
                  <span>Upload</span>
                  <input
                    type="file"
                    accept=".txt,.csv,.xlsx,image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Document metadata controls */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Document Name</label>
                <input
                  type="text"
                  value={documentName}
                  onChange={(e) => setDocumentName(e.target.value)}
                  className="w-full text-xs bg-slate-950 border border-slate-700/80 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500/80"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Report Baseline Date</label>
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="w-full text-xs bg-slate-950 border border-slate-700/80 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500/80"
                />
              </div>
            </div>

            {/* Input area or image preview */}
            {selectedFormat === 'diary_image' && imagePreview ? (
              <div className="space-y-2">
                <div className="relative border border-slate-700 rounded-md overflow-hidden max-h-80 bg-slate-950 flex items-center justify-center">
                  <img
                    src={imagePreview}
                    alt="Scanned Diary Preview"
                    referrerPolicy="no-referrer"
                    className="max-h-80 w-auto object-contain"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Gemini Multimodal OCR will read stamps, tables &amp; handwritten logs</span>
                  <button
                    onClick={() => {
                      setImagePreview(null);
                      setSelectedFormat('text');
                    }}
                    className="text-amber-400 hover:underline"
                  >
                    Switch to text
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  rows={13}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Paste site progress notes, shift logs, WhatsApp / Hinglish updates, or CSV contents..."
                  className="w-full text-xs font-mono bg-slate-950 border border-slate-700/80 rounded-md p-3 text-slate-200 focus:outline-none focus:border-amber-500/80 leading-relaxed resize-y"
                />
              </div>
            )}

            {/* Process Action */}
            <div className="pt-3 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {selectedFormat === 'diary_image'
                  ? 'Gemini Multimodal Vision OCR'
                  : 'Gemini 3.8 Flash + Deterministic Fallback'}
              </span>
              <button
                onClick={runIngestionPipeline}
                disabled={isProcessing || (!inputText.trim() && !imagePreview)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-semibold text-xs rounded transition-all shadow-sm"
              >
                {isProcessing ? (
                  <>
                    <RotateCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Processing Pipeline...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Run Ingestion &amp; Match</span>
                  </>
                )}
              </button>
            </div>

            {processingError && (
              <div className="mt-3 p-3 bg-rose-950/40 border border-rose-800/60 rounded text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{processingError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Extracted Structured Events (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <span className="text-xs font-semibold text-slate-200">
                  Extracted Structured Events ({extractedEvents.length})
                </span>
              </div>
              {extractedEvents.length > 0 && (
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="text-emerald-400 font-medium">
                    {extractedEvents.filter((e) => e.routing === 'AUTO_COMMITTED').length} Auto-Committed
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-400 font-medium">
                    {extractedEvents.filter((e) => e.routing !== 'AUTO_COMMITTED').length} In Review Queue
                  </span>
                </div>
              )}
            </div>

            {extractedEvents.length === 0 ? (
              <div className="py-16 text-center text-slate-500 space-y-2">
                <Layers className="h-8 w-8 mx-auto text-slate-600" />
                <p className="text-xs font-medium text-slate-400">No events extracted yet</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Click &ldquo;Run Ingestion &amp; Match&rdquo; or load one of the sample reports above to watch the
                  pipeline parse, fuzzy-match, score, and auto-route field activities.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
                {extractedEvents.map((evt) => {
                  const isAuto = evt.routing === 'AUTO_COMMITTED';
                  const isApproval = evt.routing === 'NEEDS_APPROVAL';
                  const isNewAct = evt.routing === 'NEW_ACTIVITY';

                  return (
                    <div
                      key={evt.id}
                      className={`p-3.5 rounded-lg border transition-all ${
                        isAuto
                          ? 'border-emerald-800/40 bg-slate-950/40'
                          : isApproval
                          ? 'border-amber-800/50 bg-slate-950/40'
                          : 'border-rose-900/40 bg-slate-950/40'
                      }`}
                    >
                      {/* Top row: Discipline & routing confidence */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 text-xs">
                          <span className={`font-semibold ${getDisciplineColor(evt.discipline)}`}>
                            {evt.discipline}
                          </span>
                          <span aria-hidden="true" className="text-slate-600">·</span>
                          <span className="text-slate-400 font-mono text-[11px]">{evt.date}</span>
                          <span aria-hidden="true" className="text-slate-600">·</span>
                          <span className="text-slate-400 font-medium">{evt.location}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded border ${
                              isAuto
                                ? 'text-emerald-300 bg-emerald-950/40 border-emerald-800/50'
                                : isApproval
                                ? 'text-amber-300 bg-amber-950/40 border-amber-800/50'
                                : 'text-rose-300 bg-rose-950/40 border-rose-800/50'
                            }`}
                          >
                            {evt.confidence}% match
                          </span>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                            {evt.eventType}
                          </span>
                        </div>
                      </div>

                      {/* Event description & raw text snippet */}
                      <p className="text-xs font-medium text-slate-200 mb-1.5 leading-snug">
                        {evt.activityDescription}
                      </p>
                      <p className="text-[11px] font-mono text-slate-400 bg-slate-900/90 p-2 rounded border border-slate-800/80 mb-2.5">
                        &ldquo;{evt.rawText}&rdquo;
                      </p>

                      {/* Matched Activity Section */}
                      <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <ArrowRight className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                          <span className="text-slate-400">P6 Baseline Target:</span>
                          {evt.matchedActivityId ? (
                            <span className="font-semibold text-slate-100">
                              {evt.matchedActivityId} – {evt.matchedActivityName}
                            </span>
                          ) : (
                            <span className="text-rose-400 italic">No direct match / Unplanned Activity</span>
                          )}
                        </div>

                        {/* Status chip */}
                        <div>
                          {isAuto ? (
                            <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                              <Check className="h-3 w-3" /> Auto-Committed to Schedule
                            </span>
                          ) : (
                            <span className="text-[11px] text-amber-400 font-medium">
                              Sent to Planner Review Inbox
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Match Score Breakdown Drawer */}
                      {evt.matchScores && (
                        <div className="mt-2.5 pt-2 border-t border-slate-800/60 text-[11px] text-slate-400 grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div>
                            <span className="text-slate-500">Tag Match: </span>
                            <span className="font-mono text-slate-300 tabular-nums">
                              {evt.matchScores.tagMatch}%
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500">Text Similarity: </span>
                            <span className="font-mono text-slate-300 tabular-nums">
                              {evt.matchScores.textSimilarity}%
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500">Discipline/Area: </span>
                            <span className="font-mono text-slate-300 tabular-nums">
                              {evt.matchScores.disciplineAreaMatch}%
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500">Semantic: </span>
                            <span className="font-mono text-slate-300 tabular-nums">
                              {evt.matchScores.semanticScore}%
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Delay details if flagged */}
                      {evt.delayReason && (
                        <div className="mt-2 text-[11px] text-rose-300 bg-rose-950/30 border border-rose-900/40 p-1.5 rounded flex items-start gap-1.5">
                          <AlertCircle className="h-3.5 w-3.5 text-rose-400 shrink-0 mt-0.5" />
                          <span>
                            Delay: {evt.delayReason} (Category: {evt.delayCategory || 'other'})
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
