import React, { useState, useEffect } from 'react';
import { PlanActivity, ExtractedEvent, ConflictAlert, AuditLogEntry, LearnedMapping, PastProject } from './types';
import { TopBar } from './components/TopBar';
import { KpiHeader } from './components/KpiHeader';
import { ExecutionBridgeTab } from './components/ExecutionBridgeTab';
import { ScheduleGanttTab } from './components/ScheduleGanttTab';
import { InstitutionalMemoryTab } from './components/InstitutionalMemoryTab';
import { ExportModal } from './components/ExportModal';
import { AboutModal } from './components/AboutModal';
import { SettingsModal } from './components/SettingsModal';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'bridge' | 'schedule' | 'memory'>('bridge');

  // Backend SQLite Data State
  const [activities, setActivities] = useState<PlanActivity[]>([]);
  const [events, setEvents] = useState<ExtractedEvent[]>([]);
  const [alerts, setAlerts] = useState<ConflictAlert[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>([]);
  const [learnedMappings, setLearnedMappings] = useState<LearnedMapping[]>([]);
  const [pastProjects, setPastProjects] = useState<PastProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Fetch initial data from backend SQLite API
  const refreshAllData = async () => {
    try {
      const [actsRes, evtsRes, alertsRes, auditsRes, mapsRes, projsRes] = await Promise.all([
        fetch('/api/activities'),
        fetch('/api/events'),
        fetch('/api/alerts'),
        fetch('/api/audit-log'),
        fetch('/api/learned-mappings'),
        fetch('/api/past-projects'),
      ]);

      const [actsData, evtsData, alertsData, auditsData, mapsData, projsData] = await Promise.all([
        actsRes.ok ? actsRes.json() : [],
        evtsRes.ok ? evtsRes.json() : [],
        alertsRes.ok ? alertsRes.json() : [],
        auditsRes.ok ? auditsRes.json() : [],
        mapsRes.ok ? mapsRes.json() : [],
        projsRes.ok ? projsRes.json() : [],
      ]);

      setActivities(actsData || []);
      setEvents(evtsData || []);
      setAlerts(alertsData || []);
      setAuditEntries(auditsData || []);
      setLearnedMappings(mapsData || []);
      setPastProjects(projsData || []);
    } catch (err) {
      console.error('Error fetching data from SQLite backend:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshAllData();
  }, []);

  // Handlers for persisting state updates to backend SQLite database
  const handleCommitEvents = async (
    committedEvents: ExtractedEvent[],
    updatedPlan: PlanActivity[],
    newAlerts: ConflictAlert[],
    newAudits: AuditLogEntry[]
  ) => {
    // 1. Optimistic UI update
    setActivities(updatedPlan);
    if (newAlerts.length > 0) setAlerts((prev) => [...newAlerts, ...prev]);
    if (newAudits.length > 0) setAuditEntries((prev) => [...newAudits, ...prev]);

    // 2. Persist to backend SQLite
    try {
      // Save events
      await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(committedEvents),
      });

      // Update changed activities in SQLite
      for (const ev of committedEvents) {
        if (ev.matchedActivityId) {
          const act = updatedPlan.find((a) => a.ActivityID === ev.matchedActivityId);
          if (act) {
            await fetch(`/api/activities/${act.ActivityID}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(act),
            });
          }
        }
      }

      // Save alerts
      if (newAlerts.length > 0) {
        await fetch('/api/alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newAlerts),
        });
      }

      // Save audits
      if (newAudits.length > 0) {
        await fetch('/api/audit-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newAudits),
        });
      }
    } catch (err) {
      console.error('Backend sync error:', err);
    }
  };

  const handleCommitSingleEvent = async (
    event: ExtractedEvent,
    updatedActivity: PlanActivity,
    newAlerts: ConflictAlert[],
    auditEntry: AuditLogEntry
  ) => {
    setActivities((prev) => prev.map((a) => (a.ActivityID === updatedActivity.ActivityID ? updatedActivity : a)));
    if (newAlerts.length > 0) setAlerts((prev) => [...newAlerts, ...prev]);
    setAuditEntries((prev) => [auditEntry, ...prev]);

    try {
      await fetch(`/api/activities/${updatedActivity.ActivityID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedActivity),
      });

      await fetch(`/api/events/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'COMMITTED',
          matchedActivityId: updatedActivity.ActivityID,
          matchedActivityName: updatedActivity.Name,
          confidence: event.confidence,
        }),
      });

      await fetch('/api/audit-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(auditEntry),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectEvent = async (eventId: string, reason: string) => {
    try {
      await fetch(`/api/events/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REJECTED' }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddNewActivityToPlan = async (newActivity: PlanActivity, event: ExtractedEvent) => {
    setActivities((prev) => [newActivity, ...prev]);

    const audit: AuditLogEntry = {
      id: `audit-new-${Date.now()}`,
      timestamp: new Date().toISOString(),
      activityId: newActivity.ActivityID,
      activityName: newActivity.Name,
      sourceDocument: event.sourceDocument,
      rawTextSnippet: event.rawText,
      extractor: 'PLANNER_OVERRIDE',
      confidence: 100,
      user: 'Planner (New Activity Added)',
      previousValue: {
        percentComplete: 0,
        quantityDone: 0,
        status: 'NOT_STARTED',
      },
      newValue: {
        actualStart: newActivity.ActualStart,
        actualFinish: newActivity.ActualFinish,
        percentComplete: newActivity.PercentComplete,
        quantityDone: newActivity.QuantityDone,
        status: newActivity.Status,
      },
      eventId: event.id,
    };

    setAuditEntries((prev) => [audit, ...prev]);

    try {
      await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newActivity),
      });

      await fetch('/api/audit-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(audit),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveLearnedMapping = async (mapping: LearnedMapping) => {
    setLearnedMappings((prev) => [mapping, ...prev]);
    try {
      await fetch('/api/learned-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mapping),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteLearnedMapping = async (id: string) => {
    setLearnedMappings((prev) => prev.filter((m) => m.id !== id));
    try {
      await fetch(`/api/learned-mappings/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDismissAlert = async (alertId: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, resolved: true } : a)));
    try {
      await fetch(`/api/alerts/${alertId}/resolve`, { method: 'PUT' });
    } catch (err) {
      console.error(err);
    }
  };

  const handleRevertAuditEntry = async (auditId: string) => {
    try {
      const res = await fetch(`/api/audit-log/revert/${auditId}`, { method: 'POST' });
      if (res.ok) {
        await refreshAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetDatabase = async () => {
    try {
      await fetch('/api/reset-database', { method: 'POST' });
      await refreshAllData();
      setCurrentTab('bridge');
    } catch (err) {
      console.error(err);
    }
  };

  const pendingTriageCount = events.filter((e) => e.status === 'PENDING_APPROVAL').length;
  const activeAlertsCount = alerts.filter((a) => !a.resolved).length;
  const autoCommittedCount = auditEntries.filter((a) => a.extractor === 'AUTO_LINK' || a.extractor === 'AI_GEMINI').length;
  const autoLinkRate = auditEntries.length > 0 ? Math.round((autoCommittedCount / auditEntries.length) * 100) : 86;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-mono text-slate-400">Loading SiteSync SQLite Database...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500/20 selection:text-amber-300">
      {/* Streamlined Top Navigation (3 Tabs) */}
      <TopBar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab as any)}
        pendingTriageCount={pendingTriageCount}
        alertCount={activeAlertsCount}
        onOpenSyncModal={() => setIsExportModalOpen(true)}
        onOpenAboutModal={() => setIsAboutModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
      />

      {/* Quiet, Single-Line KPI Ribbon */}
      <KpiHeader
        totalActivitiesCount={activities.length}
        autoLinkRatePercent={autoLinkRate}
        itemsAwaitingReview={pendingTriageCount}
        dataLagHours={3.5}
      />

      {/* Main Workspace */}
      <main className="flex-1 pb-12">
        {currentTab === 'bridge' && (
          <ExecutionBridgeTab
            planActivities={activities}
            learnedMappings={learnedMappings}
            onCommitEvents={handleCommitEvents}
            onCommitSingleEvent={handleCommitSingleEvent}
            onRejectEvent={handleRejectEvent}
            onAddNewActivityToPlan={handleAddNewActivityToPlan}
            onSaveLearnedMapping={handleSaveLearnedMapping}
          />
        )}

        {currentTab === 'schedule' && (
          <ScheduleGanttTab
            activities={activities}
            alerts={alerts}
            auditEntries={auditEntries}
            pastProjects={pastProjects}
            onDismissAlert={handleDismissAlert}
            onRevertAuditEntry={handleRevertAuditEntry}
          />
        )}

        {currentTab === 'memory' && (
          <InstitutionalMemoryTab
            pastProjects={pastProjects}
            currentSchedule={activities}
          />
        )}
      </main>

      {/* Modals */}
      <ExportModal
        activities={activities}
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />

      <AboutModal
        isOpen={isAboutModalOpen}
        onClose={() => setIsAboutModalOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        learnedMappings={learnedMappings}
        onDeleteLearnedMapping={handleDeleteLearnedMapping}
        onResetDatabase={handleResetDatabase}
      />
    </div>
  );
}
