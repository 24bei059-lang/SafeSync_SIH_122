import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  BookOpen,
  Brain,
  RotateCcw,
  Plus,
  Trash2,
  Database,
  CheckCircle,
} from 'lucide-react';
import { LearnedMapping } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  learnedMappings: LearnedMapping[];
  onDeleteLearnedMapping: (id: string) => void;
  onResetDatabase: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  learnedMappings,
  onDeleteLearnedMapping,
  onResetDatabase,
}) => {
  const [synonyms, setSynonyms] = useState<any[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'learned' | 'synonyms' | 'database'>('learned');
  const [newTerm, setNewTerm] = useState('');
  const [newDiscipline, setNewDiscipline] = useState('Piping');
  const [newSynText, setNewSynText] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetch('/api/synonyms')
        .then((r) => r.json())
        .then((data) => setSynonyms(data || []))
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddSynonym = async () => {
    if (!newTerm.trim() || !newSynText.trim()) return;
    const synList = newSynText.split(',').map((s) => s.trim()).filter(Boolean);
    try {
      await fetch('/api/synonyms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term: newTerm.trim(), discipline: newDiscipline, synonyms: synList }),
      });
      setSynonyms((prev) => [{ term: newTerm.trim(), discipline: newDiscipline, synonyms: synList }, ...prev]);
      setNewTerm('');
      setNewSynText('');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto space-y-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">System Settings &amp; Engine Memory</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Subtabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs">
          <button
            onClick={() => setActiveSubTab('learned')}
            className={`px-3 py-1 font-semibold rounded ${
              activeSubTab === 'learned' ? 'bg-slate-800 text-amber-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Learned Mappings ({learnedMappings.length})
          </button>
          <button
            onClick={() => setActiveSubTab('synonyms')}
            className={`px-3 py-1 font-semibold rounded ${
              activeSubTab === 'synonyms' ? 'bg-slate-800 text-amber-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Synonym Lexicon ({synonyms.length})
          </button>
          <button
            onClick={() => setActiveSubTab('database')}
            className={`px-3 py-1 font-semibold rounded ${
              activeSubTab === 'database' ? 'bg-slate-800 text-rose-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Database &amp; Reset
          </button>
        </div>

        {/* Tab Content */}
        {activeSubTab === 'learned' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">
              When a planner re-links or corrects an activity in the Bridge, SiteSync automatically saves the mapping and applies it first on future matching.
            </p>
            {learnedMappings.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-6 text-center">No learned mappings recorded yet.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {learnedMappings.map((m) => (
                  <div key={m.id} className="p-2.5 bg-slate-950 rounded border border-slate-800 flex items-start justify-between text-xs">
                    <div>
                      <div className="font-semibold text-slate-200">&ldquo;{m.phrase}&rdquo;</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Mapped to: <strong className="text-amber-400 font-mono">{m.targetActivityId}</strong> ({m.targetActivityName})
                      </div>
                    </div>
                    <button
                      onClick={() => onDeleteLearnedMapping(m.id)}
                      className="text-slate-500 hover:text-rose-400 p-1"
                      title="Delete mapping"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'synonyms' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">
              EPC discipline abbreviations (PCC, RCC, RT, spool, blinding) expanded during normalization.
            </p>

            <div className="p-3 bg-slate-950 rounded border border-slate-800 space-y-2 text-xs">
              <span className="font-semibold text-slate-300 block text-[11px]">Add New Synonym:</span>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Standard Term"
                  value={newTerm}
                  onChange={(e) => setNewTerm(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
                />
                <select
                  value={newDiscipline}
                  onChange={(e) => setNewDiscipline(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
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
                  className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded flex items-center justify-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add</span>
                </button>
              </div>
              <input
                type="text"
                placeholder="Synonyms separated by commas..."
                value={newSynText}
                onChange={(e) => setNewSynText(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
              />
            </div>

            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {synonyms.map((s, idx) => (
                <div key={idx} className="p-2 bg-slate-950 rounded border border-slate-800/80 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-400">{s.term}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{s.discipline}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {Array.isArray(s.synonyms) ? s.synonyms.join(' · ') : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSubTab === 'database' && (
          <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-3 text-xs">
            <div className="flex items-center gap-2 text-slate-200 font-semibold">
              <Database className="h-4 w-4 text-sky-400" />
              <span>SQLite Backend Database</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              SiteSync runs on a persistent SQLite relational database hosted on the server (<code className="font-mono text-amber-300">data/sitesync.db</code>).
              All 60 baseline schedule activities, extracted actual events, conflict alerts, and historical projects are stored in database tables.
            </p>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-rose-400">Reset and re-seed baseline schedule</span>
              <button
                onClick={() => {
                  if (window.confirm('Reset database to initial baseline activities?')) {
                    onResetDatabase();
                    onClose();
                  }
                }}
                className="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-200 font-semibold rounded flex items-center gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Database</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
