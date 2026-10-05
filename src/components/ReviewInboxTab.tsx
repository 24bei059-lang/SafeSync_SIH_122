import React, { useState } from 'react';
import {
  Check,
  X,
  Search,
  PlusCircle,
  Link2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  ChevronDown,
  Layers,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { ExtractedEvent, PlanActivity, LearnedMapping, Discipline } from '../types';
import { applyEventToActivity } from '../services/confidenceRouter';
import { detectConflicts } from '../services/conflictDetector';

interface ReviewInboxTabProps {
  events: ExtractedEvent[];
  planActivities: PlanActivity[];
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

export const ReviewInboxTab: React.FC<ReviewInboxTabProps> = ({
  events,
  planActivities,
  onCommitSingleEvent,
  onRejectEvent,
  onAddNewActivityToPlan,
  onSaveLearnedMapping,
}) => {
  const [filterType, setFilterType] = useState<'ALL' | 'NEEDS_APPROVAL' | 'REVIEW_INBOX' | 'NEW_ACTIVITY'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [relinkingEventId, setRelinkingEventId] = useState<string | null>(null);
  const [relinkSearch, setRelinkSearch] = useState('');
  const [newActivityModalEvent, setNewActivityModalEvent] = useState<ExtractedEvent | null>(null);

  // New activity form state
  const [newActForm, setNewActForm] = useState({
    name: '',
    wbs: '1.2.9 Unplanned Field Scope',
    discipline: 'Piping' as Discipline,
    area: 'Unit 100 Crude Distillation',
    plannedDuration: 5,
    quantity: 1,
    uom: 'Ea',
  });

  const filteredEvents = events.filter((e) => {
    if (filterType === 'NEEDS_APPROVAL' && e.routing !== 'NEEDS_APPROVAL') return false;
    if (filterType === 'REVIEW_INBOX' && e.routing !== 'REVIEW_INBOX') return false;
    if (filterType === 'NEW_ACTIVITY' && e.routing !== 'NEW_ACTIVITY') return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        e.activityDescription.toLowerCase().includes(q) ||
        e.rawText.toLowerCase().includes(q) ||
        (e.matchedActivityName && e.matchedActivityName.toLowerCase().includes(q)) ||
        (e.tagIds && e.tagIds.some((t) => t.toLowerCase().includes(q)))
      );
    }
    return true;
  });

  const handleApprove = (event: ExtractedEvent) => {
    if (!event.matchedActivityId) return;
    const act = planActivities.find((a) => a.ActivityID === event.matchedActivityId);
    if (!act) return;

    const confs = detectConflicts(event, act, planActivities);
    const { updatedActivity, auditEntry } = applyEventToActivity(event, act, 'Planner Approved in Review Inbox');
    onCommitSingleEvent(event, updatedActivity, confs, auditEntry);
  };

  const handleExecuteRelink = (event: ExtractedEvent, targetActivity: PlanActivity) => {
    // 1. Update event matched target
    const updatedEvent: ExtractedEvent = {
      ...event,
      matchedActivityId: targetActivity.ActivityID,
      matchedActivityName: targetActivity.Name,
      confidence: 96,
      routing: 'AUTO_COMMITTED',
      status: 'COMMITTED',
    };

    // 2. Commit update
    const confs = detectConflicts(updatedEvent, targetActivity, planActivities);
    const { updatedActivity, auditEntry } = applyEventToActivity(
      updatedEvent,
      targetActivity,
      'Planner Re-linked Activity'
    );
    onCommitSingleEvent(updatedEvent, updatedActivity, confs, auditEntry);

    // 3. Trigger Learning Loop: save phrase -> activity mapping
    const newMapping: LearnedMapping = {
      id: `map-${Date.now()}`,
      phrase: event.activityDescription,
      targetActivityId: targetActivity.ActivityID,
      targetActivityName: targetActivity.Name,
      discipline: targetActivity.Discipline,
      frequency: 1,
      learnedAt: new Date().toISOString(),
      synonymsAdded: [event.activityDescription.toLowerCase()],
    };
    onSaveLearnedMapping(newMapping);

    setRelinkingEventId(null);
    setRelinkSearch('');
  };

  const handleOpenNewActivityModal = (event: ExtractedEvent) => {
    setNewActivityModalEvent(event);
    setNewActForm({
      name: event.activityDescription,
      wbs: '1.8.0 Field Change Scope',
      discipline: event.discipline,
      area: event.location || 'Site Wide',
      plannedDuration: 4,
      quantity: event.quantityDone || 1,
      uom: 'Ea',
    });
  };

  const handleCreateNewActivity = () => {
    if (!newActivityModalEvent) return;
    const newId = `NEW-${newActForm.discipline.slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

    const newActivity: PlanActivity = {
      ActivityID: newId,
      Name: newActForm.name,
      WBS: newActForm.wbs,
      Discipline: newActForm.discipline,
      Area: newActForm.area,
      PlannedStart: newActivityModalEvent.date,
      PlannedFinish: new Date(new Date(newActivityModalEvent.date).getTime() + newActForm.plannedDuration * 86400000)
        .toISOString()
        .split('T')[0],
      PlannedDuration: newActForm.plannedDuration,
      Predecessors: [],
      Quantity: newActForm.quantity,
      UoM: newActForm.uom,
      ActualStart: newActivityModalEvent.date,
      ActualFinish: newActivityModalEvent.eventType === 'FINISH' ? newActivityModalEvent.date : null,
      PercentComplete: newActivityModalEvent.eventType === 'FINISH' ? 100 : newActivityModalEvent.percentComplete || 50,
      QuantityDone: newActivityModalEvent.quantityDone || newActForm.quantity,
      Status: newActivityModalEvent.eventType === 'FINISH' ? 'COMPLETED' : 'IN_PROGRESS',
      VarianceDays: 0,
      IsCritical: false,
      TaggedEquipment: newActivityModalEvent.tagIds,
      LastUpdated: new Date().toISOString(),
      LastSource: newActivityModalEvent.sourceDocument,
      LastConfidence: 100,
    };

    onAddNewActivityToPlan(newActivity, newActivityModalEvent);
    setNewActivityModalEvent(null);
  };

  const relinkCandidates = planActivities.filter((a) => {
    if (!relinkSearch) return true;
    const q = relinkSearch.toLowerCase();
    return (
      a.ActivityID.toLowerCase().includes(q) ||
      a.Name.toLowerCase().includes(q) ||
      a.Discipline.toLowerCase().includes(q) ||
      a.Area.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            Planner Review Inbox
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 tabular-nums">
              {events.length} Pending
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Review uncertain matches (&lt;85%), approve re-linkages, or register newly discovered field activities into the baseline schedule.
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-950 p-1 rounded border border-slate-800">
            {(
              [
                { id: 'ALL', label: 'All Items' },
                { id: 'NEEDS_APPROVAL', label: 'Amber (60-84%)' },
                { id: 'REVIEW_INBOX', label: 'Low (&lt;60%)' },
                { id: 'NEW_ACTIVITY', label: 'New Scope' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  filterType === tab.id
                    ? 'bg-slate-800 text-amber-400 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter by description, line tag, equipment ID, or matched activity..."
          className="w-full text-xs bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
        />
      </div>

      {/* Events List */}
      {filteredEvents.length === 0 ? (
        <div className="py-20 text-center text-slate-500 space-y-3 bg-slate-900/50 border border-slate-800 rounded-lg">
          <Check className="h-8 w-8 mx-auto text-emerald-400" />
          <p className="text-sm font-semibold text-slate-300">Planner Review Inbox is completely clear</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            All ingested items have been auto-linked with high confidence (≥85%) or approved. Ingest another report to process new events.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEvents.map((evt) => {
            const isRelinking = relinkingEventId === evt.id;
            const targetAct = planActivities.find((a) => a.ActivityID === evt.matchedActivityId);

            return (
              <div
                key={evt.id}
                className="bg-slate-900 border border-slate-800 rounded-lg p-4 sm:p-5 transition-all hover:border-slate-700/80"
              >
                {/* Header row: Discipline, Source Doc, Date, Confidence */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-amber-400">{evt.discipline}</span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span className="text-slate-400">{evt.sourceDocument}</span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span className="font-mono text-slate-400 tabular-nums">{evt.date}</span>
                    {evt.tagIds && evt.tagIds.length > 0 && (
                      <>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span className="font-mono text-emerald-400 font-medium">
                          {evt.tagIds.join(', ')}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold tabular-nums px-2.5 py-0.5 rounded border ${
                        evt.confidence >= 60
                          ? 'text-amber-300 bg-amber-950/40 border-amber-800/60'
                          : 'text-rose-300 bg-rose-950/40 border-rose-900/60'
                      }`}
                    >
                      {evt.confidence}% match confidence
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                      {evt.eventType}
                    </span>
                  </div>
                </div>

                {/* Event text & description */}
                <div className="py-3 space-y-1.5">
                  <div className="text-sm font-semibold text-slate-100">{evt.activityDescription}</div>
                  <div className="text-xs font-mono text-slate-400 bg-slate-950/70 p-2.5 rounded border border-slate-800/60">
                    &ldquo;{evt.rawText}&rdquo;
                  </div>
                </div>

                {/* Candidate Matching Box */}
                <div className="bg-slate-950/50 border border-slate-800/80 rounded p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-300">
                      <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                      <span className="text-slate-400">Proposed Plan Target:</span>
                      {targetAct ? (
                        <span className="font-semibold text-white">
                          {targetAct.ActivityID} – {targetAct.Name} ({targetAct.Discipline}, {targetAct.Area})
                        </span>
                      ) : (
                        <span className="text-rose-400 italic">No direct match identified</span>
                      )}
                    </div>
                  </div>

                  {/* Score breakdown tags */}
                  {evt.matchScores && (
                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                      <span>Tag: <strong className="font-mono text-slate-200">{evt.matchScores.tagMatch}%</strong></span>
                      <span>Text: <strong className="font-mono text-slate-200">{evt.matchScores.textSimilarity}%</strong></span>
                      <span>Discipline/Area: <strong className="font-mono text-slate-200">{evt.matchScores.disciplineAreaMatch}%</strong></span>
                      <span>Semantic: <strong className="font-mono text-slate-200">{evt.matchScores.semanticScore}%</strong></span>
                      <span className="text-slate-500 italic max-w-sm truncate">{evt.matchScores.reasoning}</span>
                    </div>
                  )}
                </div>

                {/* Re-link Search Drawer if active */}
                {isRelinking && (
                  <div className="mt-3 p-3 bg-slate-950 border border-amber-500/40 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-amber-300">
                        Select Correct Activity from Schedule (Will train Learning Engine):
                      </span>
                      <button
                        onClick={() => setRelinkingEventId(null)}
                        className="text-xs text-slate-500 hover:text-slate-300"
                      >
                        Cancel
                      </button>
                    </div>
                    <input
                      type="text"
                      value={relinkSearch}
                      onChange={(e) => setRelinkSearch(e.target.value)}
                      placeholder="Type activity ID, equipment tag, or name to search..."
                      className="w-full text-xs bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200"
                      autoFocus
                    />
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {relinkCandidates.slice(0, 10).map((cand) => (
                        <button
                          key={cand.ActivityID}
                          onClick={() => handleExecuteRelink(evt, cand)}
                          className="w-full text-left p-2 rounded text-xs hover:bg-slate-800/80 flex items-center justify-between text-slate-300 border border-transparent hover:border-slate-700"
                        >
                          <div>
                            <span className="font-bold text-amber-400 mr-2">{cand.ActivityID}</span>
                            <span className="font-medium text-slate-200">{cand.Name}</span>
                            <span className="text-slate-500 text-[11px] ml-2">({cand.Discipline}, {cand.Area})</span>
                          </div>
                          <span className="text-[11px] text-emerald-400 font-semibold">Select &amp; Learn</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Planner Action Toolbar */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {/* Approve button */}
                    <button
                      onClick={() => handleApprove(evt)}
                      disabled={!evt.matchedActivityId}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold rounded shadow-sm transition-colors"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Approve Match</span>
                    </button>

                    {/* Re-link button */}
                    <button
                      onClick={() => {
                        setRelinkingEventId(isRelinking ? null : evt.id);
                        setRelinkSearch('');
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded border border-slate-700 transition-colors"
                    >
                      <Link2 className="h-3.5 w-3.5 text-amber-400" />
                      <span>Re-link Activity</span>
                    </button>

                    {/* Mark as New Activity */}
                    <button
                      onClick={() => handleOpenNewActivityModal(evt)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded border border-slate-700 transition-colors"
                    >
                      <PlusCircle className="h-3.5 w-3.5 text-sky-400" />
                      <span>Mark as New Activity</span>
                    </button>
                  </div>

                  {/* Reject button */}
                  <button
                    onClick={() => onRejectEvent(evt.id, 'Planner rejected as non-construction noise or invalid log')}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>Reject / Noise</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Add New Activity to Baseline Schedule */}
      {newActivityModalEvent && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 w-full max-w-lg space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <PlusCircle className="h-4 w-4 text-sky-400" />
                Add New Activity to Baseline Schedule
              </h3>
              <button
                onClick={() => setNewActivityModalEvent(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              This field report captured an unrepresented or newly discovered work scope (&ldquo;{newActivityModalEvent.activityDescription}&rdquo;).
              Define the new P6 activity attributes below:
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Activity Name</label>
                <input
                  type="text"
                  value={newActForm.name}
                  onChange={(e) => setNewActForm({ ...newActForm, name: e.target.value })}
                  className="w-full text-xs bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Discipline</label>
                  <select
                    value={newActForm.discipline}
                    onChange={(e) => setNewActForm({ ...newActForm, discipline: e.target.value as Discipline })}
                    className="w-full text-xs bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
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
                  <label className="block text-xs text-slate-300 mb-1">Area / Unit</label>
                  <input
                    type="text"
                    value={newActForm.area}
                    onChange={(e) => setNewActForm({ ...newActForm, area: e.target.value })}
                    className="w-full text-xs bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Planned Days</label>
                  <input
                    type="number"
                    value={newActForm.plannedDuration}
                    onChange={(e) => setNewActForm({ ...newActForm, plannedDuration: parseInt(e.target.value, 10) || 1 })}
                    className="w-full text-xs bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Quantity</label>
                  <input
                    type="number"
                    value={newActForm.quantity}
                    onChange={(e) => setNewActForm({ ...newActForm, quantity: parseFloat(e.target.value) || 1 })}
                    className="w-full text-xs bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Unit of Measure</label>
                  <input
                    type="text"
                    value={newActForm.uom}
                    onChange={(e) => setNewActForm({ ...newActForm, uom: e.target.value })}
                    className="w-full text-xs bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                onClick={() => setNewActivityModalEvent(null)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNewActivity}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs rounded transition-colors shadow-sm"
              >
                Insert into Schedule &amp; Commit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
