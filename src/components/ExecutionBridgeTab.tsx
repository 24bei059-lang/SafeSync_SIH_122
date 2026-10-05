import React, { useState } from 'react';
import {
  FileText,
  Upload,
  Sparkles,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Play,
  RotateCw,
  Tag,
  Check,
  Link2,
  PlusCircle,
  X,
  Mic,
  MicOff,
  Filter,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { ExtractedEvent, PlanActivity, LearnedMapping, Discipline } from '../types';
import { SAMPLE_INPUTS, SampleInput } from '../data/sampleInputs';
import { matchEventToActivities } from '../services/matchingEngine';
import { detectConflicts } from '../services/conflictDetector';
import { applyEventToActivity } from '../services/confidenceRouter';

interface ExecutionBridgeTabProps {
  planActivities: PlanActivity[];
  learnedMappings: LearnedMapping[];
  onCommitEvents: (
    events: ExtractedEvent[],
    updatedActivities: PlanActivity[],
    newAlerts: any[],
    newAuditEntries: any[]
  ) => void;
  onCommitSingleEvent: (
    event: ExtractedEvent,
    updatedActivity: PlanActivity,
    alerts: any[],
    auditEntry: any
  ) => void;
  onRejectEvent: (eventId: string, reason: string) => void;
  onAddNewActivityToPlan: (newActivity: PlanActivity, event: ExtractedEvent) => void;
  onSaveLearnedMapping: (mapping: LearnedMapping) => void;
}

export const ExecutionBridgeTab: React.FC<ExecutionBridgeTabProps> = ({
  planActivities,
  learnedMappings,
  onCommitEvents,
  onCommitSingleEvent,
  onRejectEvent,
  onAddNewActivityToPlan,
  onSaveLearnedMapping,
}) => {
  // Input mode: 'document' vs 'voice_agent'
  const [inputMode, setInputMode] = useState<'document' | 'voice_agent'>('document');

  // Document state
  const [inputText, setInputText] = useState<string>(SAMPLE_INPUTS[0].content);
  const [documentName, setDocumentName] = useState<string>(SAMPLE_INPUTS[0].documentName);
  const [reportDate, setReportDate] = useState<string>(SAMPLE_INPUTS[0].reportDate);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Voice / Time Agent state
  const [voiceInput, setVoiceInput] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [voiceLanguage, setVoiceLanguage] = useState<'en-IN' | 'hi-IN'>('en-IN');
  const [agentMessages, setAgentMessages] = useState<Array<{ role: 'user' | 'agent'; text: string; options?: string[] }>>([
    {
      role: 'agent',
      text: 'Voice Time Agent online. Speak updates like "Line 24 spool erection started today" or use 1-tap buttons below.',
    },
  ]);

  // Pipeline state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<string>('Ready');
  const [eventsList, setEventsList] = useState<ExtractedEvent[]>([]);
  const [filterState, setFilterState] = useState<'ALL' | 'PENDING' | 'AUTO_COMMITTED'>('ALL');
  const [relinkingEventId, setRelinkingEventId] = useState<string | null>(null);
  const [relinkSearch, setRelinkSearch] = useState<string>('');

  // New activity modal state
  const [newActModalEvent, setNewActModalEvent] = useState<ExtractedEvent | null>(null);
  const [newActForm, setNewActForm] = useState({
    name: '',
    wbs: '1.8.0 Field Scope Addition',
    discipline: 'Piping' as Discipline,
    area: 'Unit 100 Crude Distillation',
    plannedDuration: 5,
    quantity: 1,
    uom: 'Ea',
  });

  // Load sample documents
  const handleLoadSample = (sample: SampleInput) => {
    setInputMode('document');
    setInputText(sample.content);
    setDocumentName(sample.documentName);
    setReportDate(sample.reportDate);
    setImagePreview(sample.imageBase64 || null);
  };

  // Run Ingestion Pipeline
  const runIngestionPipeline = async () => {
    if (!inputText.trim() && !imagePreview) return;
    setIsProcessing(true);
    setCurrentStep('Parsing document...');

    try {
      let rawEvents: any[] = [];

      if (imagePreview) {
        setCurrentStep('Gemini OCR on site diary...');
        const res = await fetch('/api/extract-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: imagePreview,
            mimeType: imagePreview.startsWith('data:image/svg') ? 'image/svg+xml' : 'image/png',
            reportDate,
          }),
        });
        const data = await res.json();
        rawEvents = data.events || [];
      } else {
        setCurrentStep('Extracting structured events via Gemini...');
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: inputText, reportDate, documentName }),
        });
        const data = await res.json();
        rawEvents = data.events || [];
      }

      setCurrentStep('Hybrid fuzzy matching & LLM re-ranking...');
      const processed: ExtractedEvent[] = [];

      for (let i = 0; i < rawEvents.length; i++) {
        const raw = rawEvents[i];
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

        processed.push(eventItem);
      }

      setCurrentStep('Routing & committing actuals...');
      setEventsList(processed);

      // Auto-commit ≥85%
      const autoCommits = processed.filter((e) => e.routing === 'AUTO_COMMITTED' && e.matchedActivityId);
      if (autoCommits.length > 0) {
        let currentPlan = [...planActivities];
        const newAlerts: any[] = [];
        const newAuditEntries: any[] = [];

        for (const ev of autoCommits) {
          const act = currentPlan.find((a) => a.ActivityID === ev.matchedActivityId);
          if (act) {
            const confs = detectConflicts(ev, act, currentPlan);
            newAlerts.push(...confs);
            const { updatedActivity, auditEntry } = applyEventToActivity(ev, act, 'SiteSync Auto-Commit');
            currentPlan = currentPlan.map((a) => (a.ActivityID === act.ActivityID ? updatedActivity : a));
            newAuditEntries.push(auditEntry);
            ev.status = 'COMMITTED';
          }
        }
        onCommitEvents(autoCommits, currentPlan, newAlerts, newAuditEntries);
      }

      setCurrentStep('Complete');
    } catch (err: any) {
      console.error(err);
      setCurrentStep(`Error: ${err?.message || 'Pipeline failed'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Voice Time Agent Submit
  const handleSendVoiceMessage = async (overrideText?: string) => {
    const textToSend = (overrideText || voiceInput).trim();
    if (!textToSend) return;

    setAgentMessages((prev) => [...prev, { role: 'user', text: textToSend }]);
    setVoiceInput('');

    try {
      const res = await fetch('/api/time-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          planActivities: planActivities.slice(0, 30),
        }),
      });

      const data = await res.json();
      setAgentMessages((prev) => [
        ...prev,
        { role: 'agent', text: data.reply, options: data.clarificationOptions },
      ]);

      if (data.extractedEvent && !data.needsClarification) {
        const raw = data.extractedEvent;
        const matched =
          (data.matchedActivityId && planActivities.find((a) => a.ActivityID === data.matchedActivityId)) ||
          planActivities.find((a) =>
            raw.tagIds ? raw.tagIds.some((t: string) => a.Name.includes(t)) : a.Name.includes(raw.activityDescription.slice(0, 10))
          );

        if (matched) {
          const evt: ExtractedEvent = {
            id: `voice-${Date.now()}`,
            discipline: matched.Discipline,
            rawText: textToSend,
            activityDescription: raw.activityDescription || textToSend,
            eventType: raw.eventType || 'PROGRESS',
            date: raw.date || new Date().toISOString().split('T')[0],
            quantityDone: raw.quantityDone || null,
            quantityTotal: null,
            percentComplete: raw.percentComplete || (raw.eventType === 'FINISH' ? 100 : null),
            location: matched.Area,
            tagIds: raw.tagIds || [],
            delayReason: raw.delayReason || null,
            delayCategory: raw.delayCategory || null,
            sourceSpan: textToSend,
            sourceDocument: 'Supervisor Voice Agent',
            matchedActivityId: matched.ActivityID,
            matchedActivityName: matched.Name,
            confidence: 95,
            routing: 'AUTO_COMMITTED',
            status: 'COMMITTED',
          };

          const confs = detectConflicts(evt, matched, planActivities);
          const { updatedActivity, auditEntry } = applyEventToActivity(evt, matched, 'Supervisor Voice Agent');
          onCommitSingleEvent(evt, updatedActivity, confs, auditEntry);
          setEventsList((prev) => [evt, ...prev]);
        }
      }
    } catch (err: any) {
      setAgentMessages((prev) => [...prev, { role: 'agent', text: `Logged: "${textToSend}".` }]);
    }
  };

  // Web Speech API
  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported in this browser. Please type.');
      return;
    }

    if (isListening) {
      setIsListening(false);
    } else {
      const recognition = new SpeechRecognition();
      recognition.lang = voiceLanguage;
      recognition.onresult = (e: any) => {
        const text = e.results[0][0].transcript;
        setVoiceInput(text);
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.start();
      setIsListening(true);
    }
  };

  // Inline Triage: Approve
  const handleApproveEvent = (evt: ExtractedEvent) => {
    if (!evt.matchedActivityId) return;
    const act = planActivities.find((a) => a.ActivityID === evt.matchedActivityId);
    if (!act) return;

    const confs = detectConflicts(evt, act, planActivities);
    const { updatedActivity, auditEntry } = applyEventToActivity(evt, act, 'Planner Approved in Bridge');
    const updatedEvt = { ...evt, status: 'COMMITTED' as const };
    onCommitSingleEvent(updatedEvt, updatedActivity, confs, auditEntry);
    setEventsList((prev) => prev.map((e) => (e.id === evt.id ? updatedEvt : e)));
  };

  // Inline Triage: Re-link
  const handleExecuteRelink = (evt: ExtractedEvent, targetAct: PlanActivity) => {
    const updatedEvt: ExtractedEvent = {
      ...evt,
      matchedActivityId: targetAct.ActivityID,
      matchedActivityName: targetAct.Name,
      confidence: 96,
      routing: 'AUTO_COMMITTED',
      status: 'COMMITTED',
    };

    const confs = detectConflicts(updatedEvt, targetAct, planActivities);
    const { updatedActivity, auditEntry } = applyEventToActivity(updatedEvt, targetAct, 'Planner Re-linked in Bridge');
    onCommitSingleEvent(updatedEvt, updatedActivity, confs, auditEntry);

    const mapping: LearnedMapping = {
      id: `map-${Date.now()}`,
      phrase: evt.activityDescription,
      targetActivityId: targetAct.ActivityID,
      targetActivityName: targetAct.Name,
      discipline: targetAct.Discipline,
      frequency: 1,
      learnedAt: new Date().toISOString(),
      synonymsAdded: [evt.activityDescription.toLowerCase()],
    };
    onSaveLearnedMapping(mapping);

    setEventsList((prev) => prev.map((e) => (e.id === evt.id ? updatedEvt : e)));
    setRelinkingEventId(null);
  };

  // Inline Triage: Reject
  const handleReject = (evtId: string) => {
    onRejectEvent(evtId, 'Rejected in Bridge triage');
    setEventsList((prev) => prev.filter((e) => e.id !== evtId));
  };

  // Filtered events
  const displayEvents = eventsList.filter((e) => {
    if (filterState === 'PENDING') return e.status === 'PENDING_APPROVAL';
    if (filterState === 'AUTO_COMMITTED') return e.status === 'COMMITTED';
    return true;
  });

  const pendingCount = eventsList.filter((e) => e.status === 'PENDING_APPROVAL').length;
  const committedCount = eventsList.filter((e) => e.status === 'COMMITTED').length;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
            Execution Bridge
            <span className="text-xs font-normal text-slate-400">
              Field Intake → Hybrid Match → Inline Verification
            </span>
          </h2>
        </div>

        {/* Input Mode Selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-950 p-1 rounded border border-slate-800 text-xs">
            <button
              onClick={() => setInputMode('document')}
              className={`px-3 py-1 font-medium rounded transition-colors ${
                inputMode === 'document' ? 'bg-slate-800 text-amber-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Document / Report
            </button>
            <button
              onClick={() => setInputMode('voice_agent')}
              className={`px-3 py-1 font-medium rounded transition-colors ${
                inputMode === 'voice_agent' ? 'bg-slate-800 text-amber-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Voice / Quick Log
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Input Pane (Left 5 cols) vs Live Matched Triage Stream (Right 7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT PANE: INTAKE */}
        <div className="lg:col-span-5 space-y-4">
          {inputMode === 'document' ? (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
              {/* Sample Buttons */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-slate-400 block">Load Sample Report:</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {SAMPLE_INPUTS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleLoadSample(s)}
                      className="px-2 py-1 text-left text-xs bg-slate-950 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 truncate"
                      title={s.description}
                    >
                      {s.name.split(':')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Document metadata */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Document Title</label>
                  <input
                    type="text"
                    value={documentName}
                    onChange={(e) => setDocumentName(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Execution Date</label>
                  <input
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200"
                  />
                </div>
              </div>

              {/* Text Input / Scanned Preview */}
              {imagePreview ? (
                <div className="space-y-1.5">
                  <div className="border border-slate-700 rounded max-h-56 overflow-hidden flex items-center justify-center bg-slate-950">
                    <img src={imagePreview} alt="Scanned diary preview" className="max-h-56 w-auto object-contain" />
                  </div>
                  <button
                    onClick={() => setImagePreview(null)}
                    className="text-[11px] text-amber-400 hover:underline"
                  >
                    Clear Image &amp; Switch to Text
                  </button>
                </div>
              ) : (
                <textarea
                  rows={9}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Paste daily site report, Hinglish log, CSV, or shift diary notes..."
                  className="w-full text-xs font-mono bg-slate-950 border border-slate-700/80 rounded p-2.5 text-slate-200 focus:outline-none focus:border-amber-500"
                />
              )}

              {/* Action Button & Pipeline Status */}
              <div className="pt-2 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-mono">{currentStep}</span>
                <button
                  onClick={runIngestionPipeline}
                  disabled={isProcessing || (!inputText.trim() && !imagePreview)}
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 text-xs font-bold rounded shadow transition-colors flex items-center gap-1.5"
                >
                  {isProcessing ? (
                    <>
                      <RotateCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Extracting...</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>Run Match Pipeline</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Voice & Quick Log Mode */
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
              {/* 1-Tap Quick Action Buttons */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setVoiceInput('Started work today on Line 24"-PR-1042 spool erection with 6 riggers')}
                  className="p-2.5 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/60 rounded text-left"
                >
                  <span className="text-[11px] font-bold text-emerald-300 block">▶ Log Start</span>
                  <span className="text-[10px] text-slate-400">Line 24 Spool</span>
                </button>
                <button
                  onClick={() => setVoiceInput('Finished 100% casting for Pump P-101 foundation PCC today')}
                  className="p-2.5 bg-sky-950/40 hover:bg-sky-900/50 border border-sky-800/60 rounded text-left"
                >
                  <span className="text-[11px] font-bold text-sky-300 block">✓ Log Finish</span>
                  <span className="text-[10px] text-slate-400">P-101 PCC</span>
                </button>
                <button
                  onClick={() => setVoiceInput('Hydrotest Line 12"-HC-2001 delayed due to blind flange shortage in warehouse')}
                  className="p-2.5 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/60 rounded text-left"
                >
                  <span className="text-[11px] font-bold text-rose-300 block">⚠ Log Delay</span>
                  <span className="text-[10px] text-slate-400">12" Hydrotest</span>
                </button>
              </div>

              {/* Chat Log */}
              <div className="bg-slate-950 p-3 rounded border border-slate-800 h-52 overflow-y-auto space-y-2 text-xs">
                {agentMessages.map((m, i) => (
                  <div key={i} className={`p-2 rounded text-xs ${m.role === 'user' ? 'bg-amber-500/20 text-amber-200 ml-6' : 'bg-slate-900 text-slate-300 mr-6'}`}>
                    <span className="text-[10px] opacity-60 block font-mono">{m.role === 'user' ? 'You' : 'SiteSync Agent'}</span>
                    <p>{m.text}</p>
                    {m.options && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {m.options.map((opt) => (
                          <button
                            key={opt}
                            onClick={() => handleSendVoiceMessage(opt)}
                            className="text-[10px] px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded border border-amber-500/30"
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Voice / Text input row */}
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleListening}
                  className={`p-2 rounded border transition-colors ${
                    isListening ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-800 text-amber-400 border-slate-700'
                  }`}
                  title="Toggle Microphone"
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
                <input
                  type="text"
                  value={voiceInput}
                  onChange={(e) => setVoiceInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendVoiceMessage()}
                  placeholder={isListening ? 'Listening...' : 'Type or speak update...'}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200"
                />
                <button
                  onClick={() => handleSendVoiceMessage()}
                  className="px-3 py-1.5 bg-amber-400 text-slate-950 font-bold text-xs rounded"
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANE: INLINE VERIFICATION & MATCH STREAM */}
        <div className="lg:col-span-7 space-y-3">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
            {/* Stream Header & Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-200">
                  Extracted Actuals ({eventsList.length})
                </span>
                {pendingCount > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    {pendingCount} Need Verification
                  </span>
                )}
                {committedCount > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    {committedCount} Committed
                  </span>
                )}
              </div>

              {/* Filter tabs */}
              <div className="flex items-center gap-1 text-[11px]">
                {(['ALL', 'PENDING', 'AUTO_COMMITTED'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setFilterState(mode)}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      filterState === mode ? 'bg-slate-800 text-amber-400 font-semibold' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {mode === 'ALL' ? 'All' : mode === 'PENDING' ? 'Pending' : 'Committed'}
                  </button>
                ))}
              </div>
            </div>

            {/* Empty State */}
            {displayEvents.length === 0 ? (
              <div className="py-16 text-center text-slate-500 space-y-2">
                <Layers className="h-7 w-7 mx-auto text-slate-600" />
                <p className="text-xs font-semibold text-slate-400">No events in queue</p>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  Load a sample field report on the left or speak an update to see live fuzzy matching with explainable confidence.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
                {displayEvents.map((evt) => {
                  const isAuto = evt.confidence >= 85;
                  const isPending = evt.status === 'PENDING_APPROVAL';
                  const isRelinking = relinkingEventId === evt.id;
                  const targetAct = planActivities.find((a) => a.ActivityID === evt.matchedActivityId);

                  return (
                    <div
                      key={evt.id}
                      className={`p-3.5 rounded-lg border transition-all ${
                        !isPending
                          ? 'border-emerald-800/40 bg-slate-950/50'
                          : isAuto
                          ? 'border-amber-500/40 bg-slate-950/60'
                          : 'border-rose-900/50 bg-slate-950/60'
                      }`}
                    >
                      {/* Top row: Discipline, Date, Confidence Badge */}
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-amber-400">{evt.discipline}</span>
                          <span aria-hidden="true" className="text-slate-600">·</span>
                          <span className="font-mono text-slate-400 text-[11px]">{evt.date}</span>
                          <span aria-hidden="true" className="text-slate-600">·</span>
                          <span className="text-slate-400 text-[11px]">{evt.location}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-bold tabular-nums px-2 py-0.5 rounded border ${
                              evt.confidence >= 85
                                ? 'text-emerald-300 bg-emerald-950/60 border-emerald-800/60'
                                : evt.confidence >= 60
                                ? 'text-amber-300 bg-amber-950/60 border-amber-800/60'
                                : 'text-rose-300 bg-rose-950/60 border-rose-900/60'
                            }`}
                          >
                            {evt.confidence}% match
                          </span>
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                            {evt.eventType}
                          </span>
                        </div>
                      </div>

                      {/* Description & raw text */}
                      <div className="text-xs font-semibold text-slate-100 mb-1">
                        {evt.activityDescription}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 bg-slate-900/90 p-2 rounded border border-slate-800/80 mb-2">
                        &ldquo;{evt.rawText}&rdquo;
                      </div>

                      {/* Matched Activity Target */}
                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-slate-300 truncate max-w-sm">
                          <ArrowRight className="h-3 w-3 text-amber-400 shrink-0" />
                          <span className="text-slate-400">P6 Target:</span>
                          {targetAct ? (
                            <span className="font-semibold text-slate-100 truncate">
                              {targetAct.ActivityID} – {targetAct.Name}
                            </span>
                          ) : (
                            <span className="text-rose-400 italic">No direct match</span>
                          )}
                        </div>

                        <div>
                          {!isPending ? (
                            <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                              <Check className="h-3 w-3" /> Committed to P6
                            </span>
                          ) : (
                            <span className="text-[11px] text-amber-400 font-medium">Awaiting Verification</span>
                          )}
                        </div>
                      </div>

                      {/* Score breakdown chips */}
                      {evt.matchScores && (
                        <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-3 pt-1 border-t border-slate-800/50">
                          <span>Tag: <strong className="font-mono text-slate-200">{evt.matchScores.tagMatch}%</strong></span>
                          <span>Text: <strong className="font-mono text-slate-200">{evt.matchScores.textSimilarity}%</strong></span>
                          <span>Area: <strong className="font-mono text-slate-200">{evt.matchScores.disciplineAreaMatch}%</strong></span>
                          <span className="text-slate-500 italic truncate max-w-xs">{evt.matchScores.reasoning}</span>
                        </div>
                      )}

                      {/* Re-link dropdown drawer if active */}
                      {isRelinking && (
                        <div className="mt-2.5 p-2.5 bg-slate-950 border border-amber-500/50 rounded space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-amber-300">Select Correct Plan Activity:</span>
                            <button onClick={() => setRelinkingEventId(null)} className="text-slate-400 hover:text-white">Cancel</button>
                          </div>
                          <input
                            type="text"
                            value={relinkSearch}
                            onChange={(e) => setRelinkSearch(e.target.value)}
                            placeholder="Type activity ID or keyword..."
                            className="w-full text-xs bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
                            autoFocus
                          />
                          <div className="max-h-36 overflow-y-auto space-y-1">
                            {planActivities
                              .filter((a) => !relinkSearch || a.Name.toLowerCase().includes(relinkSearch.toLowerCase()) || a.ActivityID.toLowerCase().includes(relinkSearch.toLowerCase()))
                              .slice(0, 8)
                              .map((cand) => (
                                <button
                                  key={cand.ActivityID}
                                  onClick={() => handleExecuteRelink(evt, cand)}
                                  className="w-full text-left p-1.5 rounded text-xs hover:bg-slate-800 flex items-center justify-between text-slate-300"
                                >
                                  <span><strong className="text-amber-400 mr-1.5">{cand.ActivityID}</strong> {cand.Name}</span>
                                  <span className="text-[10px] text-emerald-400 font-semibold shrink-0 ml-2">Re-link &amp; Learn</span>
                                </button>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Inline Actions if Pending */}
                      {isPending && (
                        <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            {evt.matchedActivityId && (
                              <button
                                onClick={() => handleApproveEvent(evt)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded flex items-center gap-1"
                              >
                                <Check className="h-3 w-3" />
                                <span>Approve</span>
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setRelinkingEventId(isRelinking ? null : evt.id);
                                setRelinkSearch('');
                              }}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 flex items-center gap-1"
                            >
                              <Link2 className="h-3 w-3 text-amber-400" />
                              <span>Re-link</span>
                            </button>
                            <button
                              onClick={() => {
                                setNewActModalEvent(evt);
                                setNewActForm({
                                  name: evt.activityDescription,
                                  wbs: '1.8.0 Field Scope Addition',
                                  discipline: evt.discipline,
                                  area: evt.location || 'Site Wide',
                                  plannedDuration: 5,
                                  quantity: evt.quantityDone || 1,
                                  uom: 'Ea',
                                });
                              }}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 flex items-center gap-1"
                            >
                              <PlusCircle className="h-3 w-3 text-sky-400" />
                              <span>New Activity</span>
                            </button>
                          </div>

                          <button
                            onClick={() => handleReject(evt.id)}
                            className="text-[11px] text-rose-400 hover:text-rose-300"
                          >
                            Reject
                          </button>
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

      {/* New Activity Modal */}
      {newActModalEvent && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 w-full max-w-md space-y-3 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <PlusCircle className="h-4 w-4 text-sky-400" />
                Add New Activity to Baseline Schedule
              </h3>
              <button onClick={() => setNewActModalEvent(null)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <label className="block text-slate-400 mb-0.5">Activity Name</label>
                <input
                  type="text"
                  value={newActForm.name}
                  onChange={(e) => setNewActForm({ ...newActForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-0.5">Discipline</label>
                  <select
                    value={newActForm.discipline}
                    onChange={(e) => setNewActForm({ ...newActForm, discipline: e.target.value as Discipline })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-100"
                  >
                    {['Civil', 'Piping', 'Static Equipment', 'Rotating Equipment', 'Electrical', 'Instrumentation', 'HSE'].map(
                      (d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      )
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-0.5">Area</label>
                  <input
                    type="text"
                    value={newActForm.area}
                    onChange={(e) => setNewActForm({ ...newActForm, area: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-400 mb-0.5">Planned Days</label>
                  <input
                    type="number"
                    value={newActForm.plannedDuration}
                    onChange={(e) => setNewActForm({ ...newActForm, plannedDuration: parseInt(e.target.value, 10) || 1 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-0.5">Quantity</label>
                  <input
                    type="number"
                    value={newActForm.quantity}
                    onChange={(e) => setNewActForm({ ...newActForm, quantity: parseFloat(e.target.value) || 1 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-0.5">UoM</label>
                  <input
                    type="text"
                    value={newActForm.uom}
                    onChange={(e) => setNewActForm({ ...newActForm, uom: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-100"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setNewActModalEvent(null)}
                className="px-3 py-1 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const newId = `NEW-${newActForm.discipline.slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
                  const act: PlanActivity = {
                    ActivityID: newId,
                    Name: newActForm.name,
                    WBS: newActForm.wbs,
                    Discipline: newActForm.discipline,
                    Area: newActForm.area,
                    PlannedStart: newActModalEvent.date,
                    PlannedFinish: newActModalEvent.date,
                    PlannedDuration: newActForm.plannedDuration,
                    Predecessors: [],
                    Quantity: newActForm.quantity,
                    UoM: newActForm.uom,
                    ActualStart: newActModalEvent.date,
                    ActualFinish: newActModalEvent.eventType === 'FINISH' ? newActModalEvent.date : null,
                    PercentComplete: newActModalEvent.eventType === 'FINISH' ? 100 : 50,
                    QuantityDone: newActForm.quantity,
                    Status: newActModalEvent.eventType === 'FINISH' ? 'COMPLETED' : 'IN_PROGRESS',
                    VarianceDays: 0,
                    IsCritical: false,
                    LastUpdated: new Date().toISOString(),
                    LastSource: newActModalEvent.sourceDocument,
                    LastConfidence: 100,
                  };
                  onAddNewActivityToPlan(act, newActModalEvent);
                  setNewActModalEvent(null);
                }}
                className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded"
              >
                Add &amp; Commit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
