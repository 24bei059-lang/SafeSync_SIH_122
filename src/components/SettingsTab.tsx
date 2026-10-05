import React, { useState } from 'react';
import {
  Settings,
  BookOpen,
  Brain,
  RotateCcw,
  Plus,
  Trash2,
  TrendingUp,
  ShieldCheck,
  CheckCircle,
  Database,
} from 'lucide-react';
import { LearnedMapping } from '../types';
import { DISCIPLINE_SYNONYMS, SynonymEntry } from '../data/synonyms';

interface SettingsTabProps {
  learnedMappings: LearnedMapping[];
  onDeleteLearnedMapping: (id: string) => void;
  onResetAllData: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  learnedMappings,
  onDeleteLearnedMapping,
  onResetAllData,
}) => {
  const [synonymsList, setSynonymsList] = useState<SynonymEntry[]>(DISCIPLINE_SYNONYMS);
  const [newSynonymTerm, setNewSynonymTerm] = useState('');
  const [newSynonymDiscipline, setNewSynonymDiscipline] = useState('Piping');
  const [newSynonymText, setNewSynonymText] = useState('');

  const accuracyData = [
    { batch: 'Batch 1 (Initial)', accuracy: 74, autoLinkRate: 68 },
    { batch: 'Batch 2 (DPR Mix)', accuracy: 81, autoLinkRate: 75 },
    { batch: 'Batch 3 (Subcon CSV)', accuracy: 86, autoLinkRate: 82 },
    { batch: 'Batch 4 (Site Diary OCR)', accuracy: 91, autoLinkRate: 88 },
    { batch: 'Batch 5 (Current Trained)', accuracy: 95, autoLinkRate: 92 },
  ];

  const handleAddSynonym = () => {
    if (!newSynonymTerm.trim() || !newSynonymText.trim()) return;
    const syns = newSynonymText.split(',').map((s) => s.trim()).filter(Boolean);
    const newEntry: SynonymEntry = {
      term: newSynonymTerm.trim(),
      discipline: newSynonymDiscipline,
      synonyms: syns,
    };
    setSynonymsList((prev) => [newEntry, ...prev]);
    setNewSynonymTerm('');
    setNewSynonymText('');
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            Learning Loop &amp; Pipeline Configuration
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
            <span>Adaptive Planner Correction Memory</span>
            <span aria-hidden="true">·</span>
            <span>EPC Synonym Lexicon</span>
            <span aria-hidden="true">·</span>
            <span>Accuracy Trajectory</span>
          </div>
        </div>

        {/* Reset Synthetic Data Action */}
        <button
          onClick={onResetAllData}
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 rounded transition-colors whitespace-nowrap"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Reset to Fresh Synthetic Data</span>
        </button>
      </div>

      {/* Accuracy Over Time Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div>
            <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              Matching Accuracy Trajectory Over Time
            </h3>
            <p className="text-[11px] text-slate-500">
              As planners re-link ambiguous field phrases in the Review Inbox, the deterministic lookup table and synonym embeddings self-tune
            </p>
          </div>
          <span className="text-xs font-bold text-emerald-400 font-mono">+21% Accuracy Gain</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-2">
          {accuracyData.map((d, i) => (
            <div key={i} className="bg-slate-950 p-3 rounded border border-slate-800 space-y-2">
              <div className="text-[11px] font-medium text-slate-400 truncate">{d.batch}</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-amber-400 font-mono tabular-nums">
                  {d.accuracy}%
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">
                  {d.autoLinkRate}% auto
                </span>
              </div>
              <div className="w-full bg-slate-900 h-1.5 rounded overflow-hidden">
                <div
                  className="bg-amber-400 h-full rounded transition-all"
                  style={{ width: `${d.accuracy}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Learned Planner Mappings */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                <Brain className="h-4 w-4 text-amber-400" />
                Learned Planner Mappings ({learnedMappings.length})
              </h3>
              <p className="text-[11px] text-slate-500">
                Applied with highest precedence during matching (bypasses fuzzy heuristics)
              </p>
            </div>
          </div>

          {learnedMappings.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-8 text-center">
              No custom planner mappings saved yet. When you re-link an activity in the Review Inbox, it will appear here.
            </p>
          ) : (
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {learnedMappings.map((m) => (
                <div
                  key={m.id}
                  className="bg-slate-950 p-3 rounded border border-slate-800/80 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="font-medium text-slate-200">
                      &ldquo;{m.phrase}&rdquo;
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <span className="text-slate-500">Mapped to:</span>
                      <strong className="font-mono text-amber-400">{m.targetActivityId}</strong>
                      <span>– {m.targetActivityName}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Discipline: {m.discipline} · Times applied: {m.frequency}
                    </div>
                  </div>
                  <button
                    onClick={() => onDeleteLearnedMapping(m.id)}
                    className="text-slate-500 hover:text-rose-400 p-1"
                    title="Delete mapping"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: EPC Discipline Synonym Dictionary */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-sky-400" />
                Discipline Synonym Lexicon ({synonymsList.length})
              </h3>
              <p className="text-[11px] text-slate-500">
                EPC acronyms and abbreviations expanded during deterministic pre-processing
              </p>
            </div>
          </div>

          {/* Add Synonym Quick Form */}
          <div className="p-3 bg-slate-950 rounded border border-slate-800/80 space-y-2">
            <span className="text-[11px] font-semibold text-slate-300 block">Add New Term:</span>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Standard term (e.g. Blinding)"
                value={newSynonymTerm}
                onChange={(e) => setNewSynonymTerm(e.target.value)}
                className="text-xs bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200"
              />
              <select
                value={newSynonymDiscipline}
                onChange={(e) => setNewSynonymDiscipline(e.target.value)}
                className="text-xs bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
              >
                {['Civil', 'Piping', 'Static Equipment', 'Rotating Equipment', 'Electrical', 'Instrumentation', 'HSE'].map(
                  (d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  )
                )}
              </select>
              <button
                onClick={handleAddSynonym}
                className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded flex items-center justify-center gap-1"
              >
                <Plus className="h-3 w-3" />
                <span>Add</span>
              </button>
            </div>
            <input
              type="text"
              placeholder="Comma separated synonyms (e.g. mud mat, lean concrete, sub-base)"
              value={newSynonymText}
              onChange={(e) => setNewSynonymText(e.target.value)}
              className="w-full text-xs bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200"
            />
          </div>

          {/* Synonyms List */}
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {synonymsList.map((entry, idx) => (
              <div
                key={idx}
                className="bg-slate-950 p-2.5 rounded border border-slate-800/80 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-400">{entry.term}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{entry.discipline}</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  {entry.synonyms.join(' · ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
