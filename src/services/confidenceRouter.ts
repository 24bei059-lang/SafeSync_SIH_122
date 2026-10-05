import { PlanActivity, ExtractedEvent, AuditLogEntry, ActivityStatus } from '../types';

export function applyEventToActivity(
  event: ExtractedEvent,
  activity: PlanActivity,
  approvedBy: string = 'SiteSync Auto-Commit'
): { updatedActivity: PlanActivity; auditEntry: AuditLogEntry } {
  const previousValue = {
    actualStart: activity.ActualStart,
    actualFinish: activity.ActualFinish,
    percentComplete: activity.PercentComplete,
    quantityDone: activity.QuantityDone,
    status: activity.Status,
  };

  const updated = { ...activity };
  const eventDate = event.date;

  // 1. Actual Start calculation (set on first event or if explicitly START)
  if (!updated.ActualStart) {
    if (event.eventType === 'START' || event.eventType === 'PROGRESS' || (event.quantityDone && event.quantityDone > 0)) {
      updated.ActualStart = eventDate;
    }
  } else if (event.eventType === 'START' && eventDate) {
    // If explicit start is reported earlier, adjust
    if (new Date(eventDate) < new Date(updated.ActualStart)) {
      updated.ActualStart = eventDate;
    }
  }

  // 2. Quantity Aggregation
  if (event.quantityDone !== null && event.quantityDone !== undefined) {
    if (event.quantityTotal && event.quantityDone <= event.quantityTotal) {
      // If report gives both done and total (e.g. 6 of 14)
      updated.QuantityDone = Math.max(updated.QuantityDone, event.quantityDone);
    } else {
      updated.QuantityDone = Math.min(updated.Quantity, updated.QuantityDone + event.quantityDone);
    }
  }

  // 3. Percent Complete calculation
  if (event.percentComplete !== null && event.percentComplete !== undefined) {
    updated.PercentComplete = Math.max(updated.PercentComplete, Math.min(100, event.percentComplete));
  } else if (updated.Quantity > 0 && updated.QuantityDone > 0) {
    updated.PercentComplete = Math.min(100, Math.round((updated.QuantityDone / updated.Quantity) * 100));
  } else if (event.eventType === 'FINISH') {
    updated.PercentComplete = 100;
    updated.QuantityDone = updated.Quantity;
  }

  // 4. Actual Finish calculation
  if (event.eventType === 'FINISH' || updated.PercentComplete >= 100) {
    updated.ActualFinish = eventDate || updated.ActualFinish || new Date().toISOString().split('T')[0];
    updated.PercentComplete = 100;
    updated.Status = 'COMPLETED';
  } else if (event.eventType === 'DELAY') {
    updated.Status = 'DELAYED';
    updated.DelayReason = event.delayReason || 'Reported site delay';
    updated.DelayCategory = event.delayCategory || 'material';
  } else if (updated.ActualStart) {
    updated.Status = 'IN_PROGRESS';
  }

  // 5. Variance calculation (Planned Finish vs Actual Finish or current date)
  if (updated.ActualFinish) {
    const plannedMs = new Date(updated.PlannedFinish).getTime();
    const actMs = new Date(updated.ActualFinish).getTime();
    updated.VarianceDays = Math.round((actMs - plannedMs) / (1000 * 3600 * 24));
  } else if (updated.ActualStart && updated.PercentComplete < 100) {
    // Current slip projection
    const today = new Date('2026-10-04').getTime();
    const plannedFinishMs = new Date(updated.PlannedFinish).getTime();
    if (today > plannedFinishMs) {
      updated.VarianceDays = Math.round((today - plannedFinishMs) / (1000 * 3600 * 24));
    }
  }

  // Update audit tracking attributes
  updated.LastUpdated = new Date().toISOString();
  updated.LastSource = event.sourceDocument;
  updated.LastConfidence = event.confidence;

  const auditEntry: AuditLogEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    timestamp: new Date().toISOString(),
    activityId: activity.ActivityID,
    activityName: activity.Name,
    sourceDocument: event.sourceDocument,
    rawTextSnippet: event.rawText || event.sourceSpan,
    extractor:
      approvedBy === 'SiteSync Auto-Commit'
        ? 'AUTO_LINK'
        : approvedBy.includes('Planner')
        ? 'PLANNER_OVERRIDE'
        : 'AI_GEMINI',
    confidence: event.confidence,
    user: approvedBy,
    previousValue,
    newValue: {
      actualStart: updated.ActualStart,
      actualFinish: updated.ActualFinish,
      percentComplete: updated.PercentComplete,
      quantityDone: updated.QuantityDone,
      status: updated.Status,
    },
    candidatesCount: event.topCandidates?.length || 1,
    eventId: event.id,
  };

  return { updatedActivity: updated, auditEntry };
}
