import React, { useState } from 'react';
import {
  History,
  RotateCcw,
  Search,
  Filter,
  CheckCircle,
  FileText,
  User,
  Sparkles,
  ArrowRight,
  Layers,
} from 'lucide-react';
import { AuditLogEntry, PlanActivity } from '../types';

interface AuditTabProps {
  auditEntries: AuditLogEntry[];
  planActivities: PlanActivity[];
  onRevertAuditEntry: (auditId: string) => void;
}

export const AuditTab: React.FC<AuditTabProps> = ({
  auditEntries,
  planActivities,
  onRevertAuditEntry,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUser, setFilterUser] = useState('ALL');

  const filteredEntries = auditEntries.filter((entry) => {
    if (filterUser !== 'ALL' && !entry.user.includes(filterUser)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        entry.activityId.toLowerCase().includes(q) ||
        entry.activityName.toLowerCase().includes(q) ||
        entry.sourceDocument.toLowerCase().includes(q) ||
        entry.rawTextSnippet.toLowerCase().includes(q) ||
        entry.user.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const aiCount = auditEntries.filter((a) => a.extractor === 'AUTO_LINK' || a.extractor === 'AI_GEMINI').length;
  const manualCount = auditEntries.filter((a) => a.extractor.includes('PLANNER') || a.extractor.includes('MANUAL')).length;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            Execution Audit Trail &amp; Reversion Log
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
            <span>Complete Forensic Lineage</span>
            <span aria-hidden="true">·</span>
            <span>Raw Source Snippets</span>
            <span aria-hidden="true">·</span>
            <span>Immutable Timestamping &amp; One-Click Rollback</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs">
          <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded flex items-center gap-2">
            <span className="text-slate-400">Total Entries:</span>
            <span className="font-bold text-white tabular-nums">{auditEntries.length}</span>
          </div>
          <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded flex items-center gap-2">
            <span className="text-slate-400">Auto-Linked:</span>
            <span className="font-bold text-emerald-400 tabular-nums">{aiCount}</span>
          </div>
          <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded flex items-center gap-2">
            <span className="text-slate-400">Planner Overrides:</span>
            <span className="font-bold text-amber-400 tabular-nums">{manualCount}</span>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search audit trail by activity ID, document, user, or raw text..."
            className="w-full text-xs bg-slate-900 border border-slate-800 rounded pl-8 pr-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="w-full sm:w-48">
          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="w-full text-xs bg-slate-900 border border-slate-800 rounded px-2.5 py-2 text-slate-200"
          >
            <option value="ALL">All Users</option>
            <option value="Auto-Commit">Auto-Commit</option>
            <option value="Planner">Planner Approved</option>
            <option value="Supervisor">Supervisor Agent</option>
          </select>
        </div>
      </div>

      {/* Audit Entries List */}
      {filteredEntries.length === 0 ? (
        <div className="py-20 text-center text-slate-500 space-y-2 bg-slate-900/50 border border-slate-800 rounded-lg">
          <History className="h-8 w-8 mx-auto text-slate-600" />
          <p className="text-xs font-semibold text-slate-400">No audit events match your search</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEntries.map((entry) => (
            <div
              key={entry.id}
              className="bg-slate-900 border border-slate-800 rounded-lg p-4 transition-colors hover:border-slate-700/80 space-y-3"
            >
              {/* Header row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono font-bold text-amber-400">{entry.activityId}</span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="font-medium text-slate-200">{entry.activityName}</span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="text-slate-400">{entry.sourceDocument}</span>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <span className="font-mono text-slate-400 tabular-nums text-[11px]">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                  <span className="text-amber-400 font-medium">{entry.user}</span>
                  <button
                    onClick={() => onRevertAuditEntry(entry.id)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-300 bg-amber-950/40 hover:bg-amber-900/40 border border-amber-800/50 rounded transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Undo</span>
                  </button>
                </div>
              </div>

              {/* Source Text Quote */}
              <div className="text-xs font-mono text-slate-300 bg-slate-950 p-2.5 rounded border border-slate-800/80">
                &ldquo;{entry.rawTextSnippet}&rdquo;
              </div>

              {/* State Transition Matrix */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-950/40 p-2.5 rounded border border-slate-800/60 font-mono">
                <div>
                  <span className="text-slate-500 block text-[10px]">Previous Registered State:</span>
                  <span className="text-slate-400">
                    Start: {entry.previousValue.actualStart || 'None'} · Finish: {entry.previousValue.actualFinish || 'Open'} · Progress: {entry.previousValue.percentComplete}% ({entry.previousValue.status})
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">New Committed State:</span>
                  <span className="text-emerald-400 font-semibold">
                    Start: {entry.newValue.actualStart || 'None'} · Finish: {entry.newValue.actualFinish || 'Open'} · Progress: {entry.newValue.percentComplete}% ({entry.newValue.status})
                  </span>
                </div>
              </div>

              {/* Footer Meta */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1">
                <span>Extractor Engine: {entry.extractor}</span>
                <span>Confidence: {entry.confidence}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
