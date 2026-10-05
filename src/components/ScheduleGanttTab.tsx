import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Filter,
  Search,
  AlertTriangle,
  Clock,
  CheckCircle2,
  TrendingDown,
  Layers,
  ChevronRight,
  Sparkles,
  ArrowUpDown,
  SlidersHorizontal,
} from 'lucide-react';
import { PlanActivity, Discipline, ActivityStatus, ConflictAlert, AuditLogEntry, PastProject } from '../types';
import { ActivityTimelineDrawer } from './ActivityTimelineDrawer';

interface ScheduleGanttTabProps {
  activities: PlanActivity[];
  alerts: ConflictAlert[];
  auditEntries: AuditLogEntry[];
  pastProjects: PastProject[];
  onDismissAlert: (alertId: string) => void;
  onRevertAuditEntry: (auditId: string) => void;
}

export const ScheduleGanttTab: React.FC<ScheduleGanttTabProps> = ({
  activities,
  alerts,
  auditEntries,
  pastProjects,
  onDismissAlert,
  onRevertAuditEntry,
}) => {
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedArea, setSelectedArea] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedActivity, setSelectedActivity] = useState<PlanActivity | null>(null);
  const [viewMode, setViewMode] = useState<'both' | 'gantt' | 'table'>('both');
  const [showAlertsDrawer, setShowAlertsDrawer] = useState<boolean>(true);

  // Distinct disciplines and areas
  const disciplines = ['ALL', 'Civil', 'Piping', 'Static Equipment', 'Rotating Equipment', 'Electrical', 'Instrumentation', 'HSE'];
  const areas = ['ALL', ...Array.from(new Set(activities.map((a) => a.Area)))];

  // Filtered activities
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      if (selectedDiscipline !== 'ALL' && act.Discipline !== selectedDiscipline) return false;
      if (selectedStatus !== 'ALL' && act.Status !== selectedStatus) return false;
      if (selectedArea !== 'ALL' && act.Area !== selectedArea) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          act.ActivityID.toLowerCase().includes(q) ||
          act.Name.toLowerCase().includes(q) ||
          act.WBS.toLowerCase().includes(q) ||
          act.Area.toLowerCase().includes(q) ||
          (act.TaggedEquipment && act.TaggedEquipment.some((t) => t.toLowerCase().includes(q)))
        );
      }
      return true;
    });
  }, [activities, selectedDiscipline, selectedStatus, selectedArea, searchQuery]);

  // Gantt Timeline bounds calculation (Sep 15, 2026 to Oct 31, 2026)
  const timelineStart = new Date('2026-09-15').getTime();
  const timelineEnd = new Date('2026-10-31').getTime();
  const totalDays = Math.max(1, Math.round((timelineEnd - timelineStart) / 86400000));

  // Today marker (2026-10-04)
  const todayMs = new Date('2026-10-04').getTime();
  const todayOffsetPercent = Math.max(0, Math.min(100, ((todayMs - timelineStart) / (timelineEnd - timelineStart)) * 100));

  const getPositionPercent = (dateStr: string) => {
    const d = new Date(dateStr).getTime();
    return Math.max(0, Math.min(100, ((d - timelineStart) / (timelineEnd - timelineStart)) * 100));
  };

  const getWidthPercent = (startStr: string, finishStr: string) => {
    const s = new Date(startStr).getTime();
    const f = new Date(finishStr).getTime();
    const width = Math.max(1.5, ((f - s) / (timelineEnd - timelineStart)) * 100);
    return Math.min(100 - getPositionPercent(startStr), width);
  };

  const activeAlerts = alerts.filter((a) => !a.resolved);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header & View Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            Interactive EPC Schedule &amp; Variance Gantt
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
            <span>Primavera P6 L5/L6 Baseline</span>
            <span aria-hidden="true">·</span>
            <span>Real-time Field Variance</span>
            <span aria-hidden="true">·</span>
            <span>Predecessor Slippage Highlighting</span>
          </div>
        </div>

        {/* View Mode & Filter Summary */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-950 p-1 rounded border border-slate-800 text-xs">
            {(['both', 'gantt', 'table'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 font-medium rounded capitalize transition-colors ${
                  viewMode === mode
                    ? 'bg-slate-800 text-amber-400 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {mode === 'both' ? 'Split View' : mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Anomaly & Conflict Alerts Banner */}
      {activeAlerts.length > 0 && showAlertsDrawer && (
        <div className="bg-rose-950/30 border border-rose-900/60 rounded-lg p-3 sm:p-4 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-300 font-bold">
              <AlertTriangle className="h-4 w-4 text-rose-400" />
              <span>Schedule Sequence &amp; Logic Conflict Alerts ({activeAlerts.length})</span>
            </div>
            <button
              onClick={() => setShowAlertsDrawer(false)}
              className="text-rose-400 hover:text-rose-200 text-[11px]"
            >
              Dismiss Panel
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
            {activeAlerts.map((al) => (
              <div
                key={al.id}
                className="bg-slate-950/80 p-2.5 rounded border border-rose-900/40 flex items-start justify-between gap-2"
              >
                <div>
                  <div className="font-semibold text-rose-200 flex items-center gap-1.5">
                    <span className="font-mono text-amber-400 text-[10px]">{al.activityId}</span>
                    <span>{al.message}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">{al.details}</p>
                </div>
                <button
                  onClick={() => onDismissAlert(al.id)}
                  className="text-[10px] text-rose-400 hover:text-rose-200 font-medium whitespace-nowrap"
                >
                  Resolve
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {/* Search */}
        <div className="relative sm:col-span-1">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID, name, tag..."
            className="w-full text-xs bg-slate-900 border border-slate-800 rounded pl-8 pr-3 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Discipline Filter */}
        <div>
          <select
            value={selectedDiscipline}
            onChange={(e) => setSelectedDiscipline(e.target.value)}
            className="w-full text-xs bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200"
          >
            {disciplines.map((d) => (
              <option key={d} value={d}>
                Discipline: {d}
              </option>
            ))}
          </select>
        </div>

        {/* Area Filter */}
        <div>
          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            className="w-full text-xs bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200"
          >
            {areas.map((a) => (
              <option key={a} value={a}>
                Area: {a}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full text-xs bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200"
          >
            <option value="ALL">Status: All</option>
            <option value="COMPLETED">Completed</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="DELAYED">Delayed</option>
            <option value="NOT_STARTED">Not Started</option>
          </select>
        </div>
      </div>

      {/* GANTT CHART VIEW */}
      {(viewMode === 'both' || viewMode === 'gantt') && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-semibold text-slate-200">
              Gantt Visualizer: Baseline vs Actual Execution
            </span>
            <div className="flex items-center gap-4 text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-5 bg-slate-600 rounded-sm" /> Planned Baseline
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-5 bg-emerald-500 rounded-sm" /> Actual On-Track
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-5 bg-rose-500 rounded-sm" /> Slipped / Delayed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-1.5 bg-amber-400" /> Today (04 Oct 2026)
              </span>
            </div>
          </div>

          {/* Time axis header */}
          <div className="relative h-6 text-[10px] font-mono text-slate-400 border-b border-slate-800/80">
            <div className="absolute left-0">15 Sep</div>
            <div className="absolute left-1/4">25 Sep</div>
            <div className="absolute left-2/4">05 Oct</div>
            <div className="absolute left-3/4">18 Oct</div>
            <div className="absolute right-0">31 Oct</div>

            {/* Today vertical line header pointer */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-amber-400/80 z-10"
              style={{ left: `${todayOffsetPercent}%` }}
            >
              <span className="absolute -top-4 -translate-x-1/2 text-[9px] font-bold text-amber-300 bg-slate-950 px-1 rounded border border-amber-400/40">
                Today
              </span>
            </div>
          </div>

          {/* Gantt rows */}
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {filteredActivities.slice(0, 25).map((act) => {
              const isSelected = selectedActivity?.ActivityID === act.ActivityID;
              const hasDelayedPredecessor =
                act.Predecessors &&
                act.Predecessors.some((pId) => {
                  const p = activities.find((a) => a.ActivityID === pId);
                  return p && (p.VarianceDays || 0) > 0;
                });

              const planLeft = getPositionPercent(act.PlannedStart);
              const planWidth = getWidthPercent(act.PlannedStart, act.PlannedFinish);

              const actStart = act.ActualStart || (act.Status !== 'NOT_STARTED' ? act.PlannedStart : null);
              const actEnd = act.ActualFinish || (actStart ? '2026-10-04' : null);
              const actLeft = actStart ? getPositionPercent(actStart) : 0;
              const actWidth = actStart && actEnd ? getWidthPercent(actStart, actEnd) : 0;

              const isSlipped = (act.VarianceDays || 0) > 0 || act.Status === 'DELAYED';

              return (
                <div
                  key={act.ActivityID}
                  onClick={() => setSelectedActivity(act)}
                  className={`p-2 rounded cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-slate-800 border-amber-500/60'
                      : 'bg-slate-950/50 border-slate-800/80 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-2 truncate max-w-md">
                      <span className="font-mono text-amber-400 font-bold shrink-0">{act.ActivityID}</span>
                      <span className="font-medium text-slate-200 truncate">{act.Name}</span>
                      {hasDelayedPredecessor && (
                        <span className="text-[10px] text-rose-400 bg-rose-950/40 px-1 rounded border border-rose-800/40 shrink-0">
                          Predecessor Slip
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 shrink-0 font-mono">
                      <span>{act.PercentComplete}%</span>
                      <span
                        className={`tabular-nums font-bold ${
                          (act.VarianceDays || 0) > 0 ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {act.VarianceDays !== undefined
                          ? `${act.VarianceDays > 0 ? '+' : ''}${act.VarianceDays}d`
                          : '0d'}
                      </span>
                    </div>
                  </div>

                  {/* Gantt Bar Canvas */}
                  <div className="relative h-5 w-full bg-slate-900 rounded overflow-hidden">
                    {/* Today marker */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-amber-400/40 z-10"
                      style={{ left: `${todayOffsetPercent}%` }}
                    />

                    {/* Planned Bar */}
                    <div
                      className="absolute top-0.5 h-1.5 bg-slate-600/90 rounded-sm"
                      style={{ left: `${planLeft}%`, width: `${planWidth}%` }}
                      title={`Planned: ${act.PlannedStart} to ${act.PlannedFinish}`}
                    />

                    {/* Actual Bar */}
                    {actStart && (
                      <div
                        className={`absolute bottom-0.5 h-2 rounded-sm transition-all ${
                          isSlipped ? 'bg-rose-500' : 'bg-emerald-500'
                        }`}
                        style={{ left: `${actLeft}%`, width: `${actWidth}%` }}
                        title={`Actual: ${act.ActualStart || 'Open'} (${act.PercentComplete}%)`}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SCHEDULE DATA TABLE */}
      {(viewMode === 'both' || viewMode === 'table') && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <div className="p-3 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200">
              Activity Line Items ({filteredActivities.length})
            </span>
            <span className="text-[11px] text-slate-500">
              Click any row to open Timeline Audit Drawer &amp; Benchmark
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-medium">
                <tr>
                  <th className="py-2.5 px-3">Activity ID</th>
                  <th className="py-2.5 px-3">Name &amp; Scope</th>
                  <th className="py-2.5 px-3">Discipline</th>
                  <th className="py-2.5 px-3">Area</th>
                  <th className="py-2.5 px-3 text-right">Planned Finish</th>
                  <th className="py-2.5 px-3 text-right">Actual Finish</th>
                  <th className="py-2.5 px-3 text-right">Progress</th>
                  <th className="py-2.5 px-3 text-right">Variance</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredActivities.map((act) => {
                  const isSelected = selectedActivity?.ActivityID === act.ActivityID;
                  const isSlipped = (act.VarianceDays || 0) > 0;

                  return (
                    <tr
                      key={act.ActivityID}
                      onClick={() => setSelectedActivity(act)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-slate-800/80'
                          : 'hover:bg-slate-800/40 text-slate-300'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-bold text-amber-400 whitespace-nowrap">
                        {act.ActivityID}
                      </td>
                      <td className="py-2.5 px-3 font-sans font-medium text-slate-100 max-w-xs truncate">
                        {act.Name}
                      </td>
                      <td className="py-2.5 px-3 font-sans text-slate-300">{act.Discipline}</td>
                      <td className="py-2.5 px-3 font-sans text-slate-400">{act.Area}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-slate-400">
                        {act.PlannedFinish}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-slate-200">
                        {act.ActualFinish || (act.ActualStart ? 'Open' : '-')}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-bold text-emerald-400">
                        {act.PercentComplete}%
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right tabular-nums font-bold ${
                          isSlipped ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {act.VarianceDays !== undefined
                          ? `${act.VarianceDays > 0 ? '+' : ''}${act.VarianceDays}d`
                          : '0d'}
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                            act.Status === 'COMPLETED'
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/50'
                              : act.Status === 'DELAYED'
                              ? 'bg-rose-950/60 text-rose-300 border border-rose-800/50'
                              : act.Status === 'IN_PROGRESS'
                              ? 'bg-sky-950/60 text-sky-300 border border-sky-800/50'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {act.Status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Activity Detail & Audit Timeline Drawer */}
      <ActivityTimelineDrawer
        activity={selectedActivity}
        auditEntries={auditEntries}
        pastProjects={pastProjects}
        onClose={() => setSelectedActivity(null)}
        onRevertAuditEntry={onRevertAuditEntry}
      />
    </div>
  );
};
