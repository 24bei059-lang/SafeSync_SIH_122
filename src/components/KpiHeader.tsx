import React from 'react';
import { ArrowUpRight, TrendingUp, CheckCircle2, Clock, Database } from 'lucide-react';

interface KpiHeaderProps {
  totalActivitiesCount: number;
  autoLinkRatePercent: number;
  itemsAwaitingReview: number;
  dataLagHours: number;
}

export const KpiHeader: React.FC<KpiHeaderProps> = ({
  totalActivitiesCount,
  autoLinkRatePercent,
  itemsAwaitingReview,
  dataLagHours,
}) => {
  return (
    <section className="border-b border-slate-800 bg-slate-900/50 px-4 sm:px-6 py-2">
      <div className="flex flex-wrap items-center justify-between gap-y-1 gap-x-6 text-xs">
        <div className="flex items-center gap-4 text-slate-300">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="text-slate-500">Auto-Link Rate:</span>
            <span className="font-bold text-emerald-400 font-mono tabular-nums">{autoLinkRatePercent}%</span>
            <span className="text-[10px] text-slate-500">(≥85% threshold)</span>
          </div>

          <span aria-hidden="true" className="text-slate-700 hidden sm:inline">·</span>

          <div className="flex items-center gap-1.5 font-medium">
            <span className="text-slate-500">Pending Review:</span>
            <span
              className={`font-bold font-mono tabular-nums ${
                itemsAwaitingReview > 0 ? 'text-amber-400' : 'text-slate-400'
              }`}
            >
              {itemsAwaitingReview} items
            </span>
          </div>

          <span aria-hidden="true" className="text-slate-700 hidden md:inline">·</span>

          <div className="hidden md:flex items-center gap-1.5 font-medium">
            <span className="text-slate-500">Schedule Lag:</span>
            <span className="font-bold text-sky-400 font-mono tabular-nums">{dataLagHours} hrs</span>
            <span className="text-[10px] text-slate-500 line-through">120 hrs manual</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
          <span className="flex items-center gap-1 text-emerald-400">
            <Database className="h-3 w-3" />
            <span>SQLite DB Connected</span>
          </span>
          <span aria-hidden="true" className="text-slate-700">·</span>
          <span>{totalActivitiesCount} P6 Activities</span>
        </div>
      </div>
    </section>
  );
};
