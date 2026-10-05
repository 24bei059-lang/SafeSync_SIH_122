import React, { useState } from 'react';
import {
  X,
  Download,
  Share2,
  CheckCircle2,
  FileSpreadsheet,
  RotateCw,
  Server,
  Code2,
} from 'lucide-react';
import { PlanActivity } from '../types';

interface ExportModalProps {
  activities: PlanActivity[];
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  activities,
  isOpen,
  onClose,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [syncComplete, setSyncComplete] = useState(false);

  if (!isOpen) return null;

  // 1. Download Clean Discipline-Tagged Actual Progress CSV
  const handleDownloadCleanCsv = () => {
    const headers = [
      'ActivityID',
      'Discipline',
      'ActivityName',
      'ActualStart',
      'ActualFinish',
      'PercentComplete',
      'QuantityDone',
      'TotalQuantity',
      'UoM',
      'DelayCategory',
      'Confidence',
      'SourceDocument',
    ];

    const rows = activities.map((a) => [
      `"${a.ActivityID}"`,
      `"${a.Discipline}"`,
      `"${a.Name.replace(/"/g, '""')}"`,
      `"${a.ActualStart || ''}"`,
      `"${a.ActualFinish || ''}"`,
      a.PercentComplete,
      a.QuantityDone,
      a.Quantity,
      `"${a.UoM}"`,
      `"${a.DelayCategory || ''}"`,
      a.LastConfidence || 100,
      `"${a.LastSource || 'Baseline PMIS'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SiteSync_Actual_Progress_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 2. Download Primavera P6-Compatible CSV
  const handleDownloadPrimaveraCsv = () => {
    // Standard Primavera P6 Batch Update format
    const headers = [
      'ACTIVITY_ID',
      'STATUS_CODE',
      'ACT_START_DATE',
      'ACT_END_DATE',
      'PCT_COMPLETE',
      'ACT_UNITS',
      'PLANNED_UNITS',
      'VARIANCE_DAYS',
    ];

    const rows = activities.map((a) => {
      let p6Status = 'TK_NotStart';
      if (a.Status === 'COMPLETED') p6Status = 'TK_Complete';
      else if (a.Status === 'IN_PROGRESS' || a.Status === 'DELAYED') p6Status = 'TK_Active';

      return [
        `"${a.ActivityID}"`,
        `"${p6Status}"`,
        `"${a.ActualStart ? a.ActualStart + ' 08:00:00' : ''}"`,
        `"${a.ActualFinish ? a.ActualFinish + ' 17:00:00' : ''}"`,
        a.PercentComplete,
        a.QuantityDone,
        a.Quantity,
        a.VarianceDays || 0,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Primavera_P6_Batch_Sync_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 3. Download JSON
  const handleDownloadJson = () => {
    const jsonStr = JSON.stringify(activities, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `SiteSync_Schedule_Dataset_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 4. Mock Push to PMIS (Primavera P6 Cloud / SAP EPC API)
  const handlePushToPmis = async () => {
    setIsSyncing(true);
    setSyncComplete(false);
    setSyncProgress(0);
    setSyncLogs(['Initiating OAuth 2.0 handshake with Primavera P6 EPPM Cloud...', 'Authenticating Project ID: PETRO-EPC-PKG4...']);

    await new Promise((r) => setTimeout(r, 600));
    setSyncProgress(30);
    setSyncLogs((prev) => [...prev, 'Validating 60 WBS activity records against baseline schema...']);

    await new Promise((r) => setTimeout(r, 700));
    setSyncProgress(65);
    setSyncLogs((prev) => [
      ...prev,
      'Pushing Actual Start dates for 18 in-progress tasks...',
      'Updating percent complete and quantity fields (M3, LM, Spools)...',
      'Registering 4 delay reason change codes in PMIS log...',
    ]);

    await new Promise((r) => setTimeout(r, 800));
    setSyncProgress(100);
    setSyncLogs((prev) => [
      ...prev,
      'Schedule recalculated with Retained Logic algorithm in P6 engine.',
      'Synchronization complete: 60 activities in sync, 0 schema rejections.',
    ]);
    setIsSyncing(false);
    setSyncComplete(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 w-full max-w-xl space-y-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">Export Dataset &amp; PMIS Integration</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          SiteSync bridges messy daily field execution logs into pristine, structured progress data. Download formatted files or push directly to enterprise PMIS:
        </p>

        {/* Download Options */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={handleDownloadCleanCsv}
            className="p-3 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 rounded-lg text-left transition-colors space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400">Actuals CSV</span>
              <Download className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <p className="text-[11px] text-slate-400">Discipline-tagged progress with confidence &amp; source trail.</p>
          </button>

          <button
            onClick={handleDownloadPrimaveraCsv}
            className="p-3 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 rounded-lg text-left transition-colors space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400">Primavera P6 CSV</span>
              <FileSpreadsheet className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <p className="text-[11px] text-slate-400">P6 EPPM batch import with STATUS_CODE &amp; ACT_START.</p>
          </button>

          <button
            onClick={handleDownloadJson}
            className="p-3 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 rounded-lg text-left transition-colors space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sky-400">Structured JSON</span>
              <Code2 className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <p className="text-[11px] text-slate-400">Full typed tree with predecessors &amp; quantities.</p>
          </button>
        </div>

        {/* Live PMIS Sync Section */}
        <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-bold text-slate-200">
                Primavera P6 / SAP EPC Direct API Sync
              </span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400">API Endpoint Configured</span>
          </div>

          <div className="w-full bg-slate-900 h-2 rounded overflow-hidden">
            <div
              className="bg-amber-400 h-full rounded transition-all duration-300"
              style={{ width: `${syncProgress}%` }}
            />
          </div>

          {syncLogs.length > 0 && (
            <div className="bg-slate-900/90 p-2.5 rounded font-mono text-[11px] text-slate-300 max-h-36 overflow-y-auto space-y-1 border border-slate-800">
              {syncLogs.map((log, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span className="text-slate-500">›</span>
                  <span>{log}</span>
                </div>
              ))}
            </div>
          )}

          <div className="pt-1 flex items-center justify-between">
            {syncComplete ? (
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> PMIS Baseline Successfully Synchronized
              </span>
            ) : (
              <span className="text-[11px] text-slate-500">60 Activity records ready for sync</span>
            )}

            <button
              onClick={handlePushToPmis}
              disabled={isSyncing}
              className="px-4 py-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 text-xs font-bold rounded shadow-sm transition-colors flex items-center gap-1.5"
            >
              {isSyncing ? (
                <>
                  <RotateCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Pushing to P6...</span>
                </>
              ) : (
                <span>Push to PMIS</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
