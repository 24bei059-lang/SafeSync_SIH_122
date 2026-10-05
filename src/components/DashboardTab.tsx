import React from 'react';
import {
  Play,
  ArrowRight,
  TrendingDown,
  AlertTriangle,
  Clock,
  Sparkles,
  HardHat,
  FileText,
  Activity,
  Calendar,
  Layers,
  CheckCircle,
} from 'lucide-react';
import { PlanActivity, ExtractedEvent, ConflictAlert, AuditLogEntry } from '../types';

interface DashboardTabProps {
  activities: PlanActivity[];
  pendingReviewEvents: ExtractedEvent[];
  alerts: ConflictAlert[];
  recentAudits: AuditLogEntry[];
  onSelectTab: (tab: string) => void;
  onOpenSyncModal: () => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  activities,
  pendingReviewEvents,
  alerts,
  recentAudits,
  onSelectTab,
  onOpenSyncModal,
}) => {
  const totalActivities = activities.length;
  const completedActs = activities.filter((a) => a.Status === 'COMPLETED').length;
  const inProgressActs = activities.filter((a) => a.Status === 'IN_PROGRESS').length;
  const delayedActs = activities.filter((a) => a.Status === 'DELAYED' || (a.VarianceDays || 0) > 0).length;

  const totalQuantity = activities.reduce((acc, a) => acc + (a.Quantity || 0), 0);
  const totalQuantityDone = activities.reduce((acc, a) => acc + (a.QuantityDone || 0), 0);
  const overallActualProgress = Math.round((totalQuantityDone / (totalQuantity || 1)) * 100);
  const overallPlannedProgress = 58; // Baseline planned S-curve benchmark

  const criticalPathItems = activities.filter((a) => a.IsCritical);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Welcome Banner & Quick Action Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Hero Card */}
        <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
            <HardHat className="h-4 w-4" />
            <span>Petrochem EPC Package 4 – Daily Control Room</span>
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              SiteSync Planning-to-Execution Bridge
            </h1>
            <p className="text-xs text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
              Fuzzy-match unstructured daily shift logs, subcon spreadsheets, and handwritten site diaries against your Primavera P6 L5/L6 baseline schedule. Automate daily actuals and cut PMIS data lag from 120 hours to 4 hours.
            </p>
          </div>

          {/* S-Curve Progress Overview */}
          <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-lg space-y-2">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-slate-300">Overall Project Physical Completion</span>
              <div className="flex items-center gap-3 font-mono tabular-nums text-[11px]">
                <span className="text-slate-400">Planned: {overallPlannedProgress}%</span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="text-emerald-400 font-bold">Actual: {overallActualProgress}%</span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="text-rose-400 font-bold">
                  Variance: {overallActualProgress - overallPlannedProgress}%
                </span>
              </div>
            </div>

            <div className="space-y-1">
              {/* Planned Bar */}
              <div className="w-full bg-slate-900 h-2 rounded overflow-hidden">
                <div
                  className="bg-slate-600 h-full rounded transition-all"
                  style={{ width: `${overallPlannedProgress}%` }}
                />
              </div>
              {/* Actual Bar */}
              <div className="w-full bg-slate-900 h-2.5 rounded overflow-hidden">
                <div
                  className="bg-amber-400 h-full rounded transition-all"
                  style={{ width: `${overallActualProgress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Quick Nav Actions */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              onClick={() => onSelectTab('ingest')}
              className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold rounded shadow transition-colors flex items-center gap-1.5"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Ingest Daily Field Log</span>
            </button>

            <button
              onClick={() => onSelectTab('review')}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded border border-slate-700 transition-colors flex items-center gap-1.5"
            >
              <span>Planner Review Inbox</span>
              {pendingReviewEvents.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                  {pendingReviewEvents.length}
                </span>
              )}
            </button>

            <button
              onClick={() => onSelectTab('schedule')}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded border border-slate-700 transition-colors flex items-center gap-1.5"
            >
              <Calendar className="h-3.5 w-3.5 text-sky-400" />
              <span>Live Gantt View</span>
            </button>

            <button
              onClick={() => onSelectTab('time-agent')}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded border border-slate-700 transition-colors flex items-center gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>Supervisor Voice Agent</span>
            </button>
          </div>
        </div>

        {/* Right Status Snapshot */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-300 block">Schedule Health &amp; Activity Counts</span>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-950 rounded border border-slate-800">
                <span className="text-[11px] text-slate-500 block">Total Activities</span>
                <span className="text-xl font-bold text-white font-mono tabular-nums">{totalActivities}</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Primavera L5/L6</span>
              </div>
              <div className="p-3 bg-slate-950 rounded border border-slate-800">
                <span className="text-[11px] text-slate-500 block">Completed</span>
                <span className="text-xl font-bold text-emerald-400 font-mono tabular-nums">{completedActs}</span>
                <span className="text-[10px] text-emerald-500 block mt-0.5">100% Milestone</span>
              </div>
              <div className="p-3 bg-slate-950 rounded border border-slate-800">
                <span className="text-[11px] text-slate-500 block">In Progress</span>
                <span className="text-xl font-bold text-sky-400 font-mono tabular-nums">{inProgressActs}</span>
                <span className="text-[10px] text-sky-500 block mt-0.5">Active site crews</span>
              </div>
              <div className="p-3 bg-slate-950 rounded border border-slate-800">
                <span className="text-[11px] text-slate-500 block">Slipped / Delayed</span>
                <span className="text-xl font-bold text-rose-400 font-mono tabular-nums">{delayedActs}</span>
                <span className="text-[10px] text-rose-500 block mt-0.5">Variance &gt; 0d</span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs space-y-1">
            <div className="font-semibold text-amber-300 flex items-center justify-between">
              <span>Next PMIS Sync Scheduled</span>
              <span className="font-mono text-[10px]">Today 18:00</span>
            </div>
            <p className="text-[11px] text-slate-400">
              60 WBS activities ready for export to Primavera EPPM or SAP.
            </p>
          </div>
        </div>
      </div>

      {/* Critical Path Slippage Alert Banner if any delayed */}
      {alerts.length > 0 && (
        <div className="bg-rose-950/40 border border-rose-900/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
            <div>
              <span className="font-bold text-rose-200">
                {alerts.length} Schedule Logic Conflicts Detected by Verification Engine
              </span>
              <p className="text-slate-400 text-[11px]">
                Potential predecessor violations, duplicate logs, or date contradictions across reports.
              </p>
            </div>
          </div>
          <button
            onClick={() => onSelectTab('schedule')}
            className="px-3 py-1.5 bg-rose-900/60 hover:bg-rose-800/80 text-rose-200 rounded font-semibold text-xs transition-colors whitespace-nowrap self-start sm:self-center"
          >
            Review Conflicts
          </button>
        </div>
      )}

      {/* Two Column Grid: Critical Milestones & Recent Audit Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Critical Path Activities */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
              <Activity className="h-4 w-4 text-amber-400" />
              Critical Path Activities &amp; Immediate Focus
            </h3>
            <button
              onClick={() => onSelectTab('schedule')}
              className="text-[11px] text-amber-400 hover:underline"
            >
              View All
            </button>
          </div>

          <div className="space-y-2">
            {criticalPathItems.slice(0, 5).map((act) => (
              <div
                key={act.ActivityID}
                onClick={() => onSelectTab('schedule')}
                className="p-3 bg-slate-950 rounded-lg border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors flex items-center justify-between text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-amber-400">{act.ActivityID}</span>
                    <span className="font-medium text-slate-100">{act.Name}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {act.Discipline} · {act.Area} · Plan Finish: {act.PlannedFinish}
                  </div>
                </div>

                <div className="text-right shrink-0 ml-2">
                  <span className="font-mono font-bold text-emerald-400 tabular-nums">
                    {act.PercentComplete}%
                  </span>
                  <span
                    className={`block text-[10px] font-mono ${
                      (act.VarianceDays || 0) > 0 ? 'text-rose-400 font-bold' : 'text-slate-500'
                    }`}
                  >
                    {act.VarianceDays !== undefined
                      ? `${act.VarianceDays > 0 ? '+' : ''}${act.VarianceDays}d slip`
                      : 'On track'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Live Ingestion Audit Stream */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
              <Clock className="h-4 w-4 text-sky-400" />
              Live Execution Audit Stream
            </h3>
            <button
              onClick={() => onSelectTab('audit')}
              className="text-[11px] text-sky-400 hover:underline"
            >
              Full History
            </button>
          </div>

          {recentAudits.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              No audit updates yet. Load a sample report in the Ingest tab to generate instant live commits!
            </div>
          ) : (
            <div className="space-y-2">
              {recentAudits.slice(0, 5).map((audit) => (
                <div
                  key={audit.id}
                  className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-amber-400">{audit.activityId}</span>
                      <span className="text-slate-300 font-medium truncate max-w-[200px]">
                        {audit.activityName}
                      </span>
                    </div>
                    <span className="font-mono text-slate-500 tabular-nums">
                      {new Date(audit.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="text-[11px] font-mono text-slate-400 truncate">
                    &ldquo;{audit.rawTextSnippet}&rdquo;
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/60 font-mono">
                    <span>By: {audit.user}</span>
                    <span className="text-emerald-400 font-semibold">
                      Committed: {audit.newValue.percentComplete}% ({audit.newValue.status})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
