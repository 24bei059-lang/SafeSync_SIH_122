import React from 'react';
import {
  X,
  History,
  RotateCcw,
  Clock,
  Sparkles,
  AlertTriangle,
  ChevronRight,
  TrendingDown,
  Building2,
  Calendar,
} from 'lucide-react';
import { PlanActivity, AuditLogEntry, PastProject } from '../types';

interface ActivityTimelineDrawerProps {
  activity: PlanActivity | null;
  auditEntries: AuditLogEntry[];
  pastProjects: PastProject[];
  onClose: () => void;
  onRevertAuditEntry: (auditId: string) => void;
}

export const ActivityTimelineDrawer: React.FC<ActivityTimelineDrawerProps> = ({
  activity,
  auditEntries,
  pastProjects,
  onClose,
  onRevertAuditEntry,
}) => {
  if (!activity) return null;

  const activityAudits = auditEntries.filter((a) => a.activityId === activity.ActivityID);

  // Find similar past activities for benchmark (P50/P90)
  const similarPastActs = pastProjects
    .flatMap((p) =>
      p.activities.map((a) => ({
        ...a,
        projectName: p.projectName,
      }))
    )
    .filter(
      (a) =>
        a.discipline === activity.Discipline ||
        a.name.toLowerCase().includes(activity.Name.toLowerCase().split(' ')[0])
    );

  const historicalDurations = similarPastActs.map((a) => a.actualDuration).sort((a, b) => a - b);
  const p50Duration =
    historicalDurations.length > 0
      ? historicalDurations[Math.floor(historicalDurations.length * 0.5)]
      : activity.PlannedDuration;
  const p90Duration =
    historicalDurations.length > 0
      ? historicalDurations[Math.floor(historicalDurations.length * 0.9)]
      : Math.round(activity.PlannedDuration * 1.4);

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col">
      {/* Drawer Header */}
      <div className="p-4 sm:p-5 border-b border-slate-800 flex items-start justify-between bg-slate-950/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
              {activity.ActivityID}
            </span>
            <span className="text-xs text-slate-400 font-medium">{activity.Discipline}</span>
          </div>
          <h3 className="text-sm font-bold text-white mt-1 leading-snug">{activity.Name}</h3>
          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
            <span>{activity.Area}</span>
            <span aria-hidden="true">·</span>
            <span>WBS: {activity.WBS}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
        {/* Activity Status Card */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 space-y-3">
          <span className="text-xs font-semibold text-slate-300">Execution Status</span>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block text-[11px]">Actual Start</span>
              <span className="font-mono font-medium text-slate-200 tabular-nums">
                {activity.ActualStart || 'Not started'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Actual Finish</span>
              <span className="font-mono font-medium text-slate-200 tabular-nums">
                {activity.ActualFinish || 'In progress / open'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Progress Complete</span>
              <span className="font-mono font-bold text-emerald-400 tabular-nums">
                {activity.PercentComplete}% ({activity.QuantityDone} / {activity.Quantity} {activity.UoM})
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Variance</span>
              <span
                className={`font-mono font-bold tabular-nums ${
                  (activity.VarianceDays || 0) > 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {activity.VarianceDays !== undefined
                  ? `${activity.VarianceDays > 0 ? '+' : ''}${activity.VarianceDays} days`
                  : '0 days'}
              </span>
            </div>
          </div>
        </div>

        {/* Similar Past Activities & P50/P90 Benchmark Panel */}
        <div className="bg-slate-950 border border-indigo-900/40 rounded-lg p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              Institutional Benchmark (5 Past Projects)
            </span>
            <span className="text-[10px] text-slate-400 font-mono">P50 / P90</span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center py-2 bg-slate-900/60 rounded border border-slate-800">
            <div>
              <span className="text-[10px] text-slate-400 block">Baseline Planned</span>
              <span className="text-xs font-bold text-slate-200 font-mono tabular-nums">
                {activity.PlannedDuration}d
              </span>
            </div>
            <div>
              <span className="text-[10px] text-indigo-300 block">Historical P50</span>
              <span className="text-xs font-bold text-indigo-400 font-mono tabular-nums">
                {p50Duration}d
              </span>
            </div>
            <div>
              <span className="text-[10px] text-amber-300 block">Historical P90</span>
              <span className="text-xs font-bold text-amber-400 font-mono tabular-nums">
                {p90Duration}d
              </span>
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] text-slate-400 font-medium">Similar Past Deliverables:</span>
            {similarPastActs.slice(0, 3).map((act, i) => (
              <div
                key={i}
                className="text-[11px] p-2 bg-slate-900/80 rounded border border-slate-800/80 flex items-center justify-between text-slate-300"
              >
                <div>
                  <div className="font-medium text-slate-200 truncate max-w-[240px]">{act.name}</div>
                  <div className="text-[10px] text-slate-500">{act.projectName}</div>
                </div>
                <div className="text-right">
                  <span className="font-mono text-slate-300 font-semibold tabular-nums">{act.actualDuration}d</span>
                  <span className="text-[10px] text-slate-500 block">
                    ({act.varianceDays > 0 ? '+' : ''}{act.varianceDays}d)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Audit Trail Timeline */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <History className="h-3.5 w-3.5 text-amber-400" />
              Audit Trail &amp; Source Timeline ({activityAudits.length})
            </span>
          </div>

          {activityAudits.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-4 text-center">
              No field updates or modifications registered yet for this activity.
            </p>
          ) : (
            <div className="relative pl-4 space-y-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
              {activityAudits.map((entry) => (
                <div key={entry.id} className="relative group text-xs space-y-1.5">
                  <div className="absolute -left-[19px] top-1 h-2.5 w-2.5 rounded-full bg-amber-400 border-2 border-slate-900" />
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-mono tabular-nums">{new Date(entry.timestamp).toLocaleString()}</span>
                    <span className="text-amber-400 font-medium">{entry.user}</span>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded border border-slate-800/80 space-y-1.5">
                    <div className="text-[11px] text-slate-400 font-mono">
                      Source: <strong className="text-slate-200">{entry.sourceDocument}</strong>
                    </div>
                    <div className="text-[11px] text-slate-300 bg-slate-900/90 p-1.5 rounded font-mono">
                      &ldquo;{entry.rawTextSnippet}&rdquo;
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] pt-1 text-slate-400 border-t border-slate-800">
                      <div>
                        Previous: {entry.previousValue.percentComplete}% (Status: {entry.previousValue.status})
                      </div>
                      <div className="text-emerald-400 font-semibold">
                        New: {entry.newValue.percentComplete}% (Status: {entry.newValue.status})
                      </div>
                    </div>

                    <div className="pt-1 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 font-mono">
                        Extractor: {entry.extractor} ({entry.confidence}% conf)
                      </span>
                      <button
                        onClick={() => onRevertAuditEntry(entry.id)}
                        className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 hover:underline"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Undo / Revert</span>
                      </button>
                    </div>
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
