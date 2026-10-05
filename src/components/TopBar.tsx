import React from 'react';
import { HardHat, Share2, Info, AlertTriangle, Settings } from 'lucide-react';

interface TopBarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  pendingTriageCount: number;
  alertCount: number;
  onOpenSyncModal: () => void;
  onOpenAboutModal: () => void;
  onOpenSettingsModal: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentTab,
  onSelectTab,
  pendingTriageCount,
  alertCount,
  onOpenSyncModal,
  onOpenAboutModal,
  onOpenSettingsModal,
}) => {
  const navItems = [
    {
      id: 'bridge',
      label: 'Execution Bridge',
      badge: pendingTriageCount > 0 ? pendingTriageCount : undefined,
    },
    { id: 'schedule', label: 'Schedule & Gantt' },
    { id: 'memory', label: 'Institutional Memory' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-900/95 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6">
        {/* Zone 1: Single text element Brand Wordmark */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <HardHat className="h-5 w-5" />
          </div>
          <span className="text-base font-bold tracking-tight text-white flex items-center gap-2">
            SiteSync
            <span className="hidden sm:inline-block text-xs font-normal text-slate-400">
              Planning-to-Execution Bridge
            </span>
          </span>
        </div>

        {/* Zone 2: 3 clean, uncluttered primary navigation tabs */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`relative px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  isActive
                    ? 'text-amber-400 bg-slate-800 font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500/20 px-1 text-[10px] font-bold text-amber-300 border border-amber-500/40 tabular-nums">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1-2 primary actions + settings */}
        <div className="flex items-center gap-2">
          {alertCount > 0 && (
            <button
              onClick={() => onSelectTab('schedule')}
              title={`${alertCount} schedule logic alerts`}
              className="flex items-center gap-1 px-2 py-1 text-xs text-rose-300 bg-rose-950/40 border border-rose-800/50 rounded hover:bg-rose-900/40 transition-colors"
            >
              <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
              <span className="tabular-nums font-semibold">{alertCount}</span>
            </button>
          )}

          <button
            onClick={onOpenSettingsModal}
            title="Lexicon & Database Settings"
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
          >
            <Settings className="h-4 w-4" />
          </button>

          <button
            onClick={onOpenAboutModal}
            title="Architecture & Scalability"
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
          >
            <Info className="h-4 w-4" />
          </button>

          <button
            onClick={onOpenSyncModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded shadow-sm transition-all whitespace-nowrap"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>Export PMIS</span>
          </button>
        </div>
      </div>
    </header>
  );
};
