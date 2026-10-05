import { PlanActivity, ExtractedEvent, ConflictAlert } from '../types';

export function detectConflicts(
  event: ExtractedEvent,
  activity: PlanActivity,
  allActivities: PlanActivity[],
  existingEvents: ExtractedEvent[] = []
): ConflictAlert[] {
  const alerts: ConflictAlert[] = [];
  const eventDate = event.date;

  // 1. Finish before start
  if (event.eventType === 'FINISH') {
    const actStart = activity.ActualStart || (eventDate ? eventDate : null);
    if (actStart && eventDate && new Date(eventDate) < new Date(actStart)) {
      alerts.push({
        id: `conf-finish-start-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        type: 'FINISH_BEFORE_START',
        severity: 'CRITICAL',
        activityId: activity.ActivityID,
        activityName: activity.Name,
        message: `Actual finish date (${eventDate}) occurs prior to Actual Start (${actStart}).`,
        details: `Reported event logs completion on ${eventDate}, but the registered start date in PMIS baseline is ${actStart}.`,
        resolved: false,
        detectedAt: new Date().toISOString(),
      });
    }
  }

  // 2. Start before predecessor actual finish
  if (event.eventType === 'START' || (event.quantityDone && event.quantityDone > 0)) {
    if (activity.Predecessors && activity.Predecessors.length > 0) {
      for (const predId of activity.Predecessors) {
        const pred = allActivities.find((a) => a.ActivityID === predId);
        if (pred) {
          if (pred.Status !== 'COMPLETED' || !pred.ActualFinish) {
            alerts.push({
              id: `conf-pred-not-fin-${predId}-${Date.now()}`,
              type: 'START_BEFORE_PREDECESSOR',
              severity: 'WARNING',
              activityId: activity.ActivityID,
              activityName: activity.Name,
              message: `Activity commenced before predecessor (${pred.ActivityID} – ${pred.Name}) actual finish.`,
              details: `Hard sequence logic in Primavera P6 requires predecessor completion. Predecessor is currently ${pred.Status} (${pred.PercentComplete}% complete).`,
              resolved: false,
              detectedAt: new Date().toISOString(),
            });
          } else if (eventDate && new Date(eventDate) < new Date(pred.ActualFinish)) {
            alerts.push({
              id: `conf-pred-date-${predId}-${Date.now()}`,
              type: 'START_BEFORE_PREDECESSOR',
              severity: 'CRITICAL',
              activityId: activity.ActivityID,
              activityName: activity.Name,
              message: `Started on ${eventDate} before predecessor finished on ${pred.ActualFinish}.`,
              details: `Activity sequence conflict with predecessor ${pred.ActivityID}.`,
              resolved: false,
              detectedAt: new Date().toISOString(),
            });
          }
        }
      }
    }
  }

  // 3. Progress > 100%
  const currentQty = activity.QuantityDone || 0;
  const newQty = event.quantityDone ? currentQty + event.quantityDone : currentQty;
  if ((event.percentComplete && event.percentComplete > 100) || (activity.Quantity > 0 && newQty > activity.Quantity * 1.05)) {
    alerts.push({
      id: `conf-prog-100-${Date.now()}`,
      type: 'PROGRESS_OVER_100',
      severity: 'WARNING',
      activityId: activity.ActivityID,
      activityName: activity.Name,
      message: `Cumulative quantity (${newQty.toFixed(1)} ${activity.UoM}) exceeds total planned scope (${activity.Quantity} ${activity.UoM}).`,
      details: `Reported progress would bring total completion to ${Math.round((newQty / activity.Quantity) * 100)}%. Requires scope verification or change order.`,
      resolved: false,
      detectedAt: new Date().toISOString(),
    });
  }

  // 4. Duplicate events from different reports
  const duplicate = existingEvents.find(
    (e) =>
      e.id !== event.id &&
      e.matchedActivityId === activity.ActivityID &&
      e.date === event.date &&
      e.eventType === event.eventType &&
      e.sourceDocument !== event.sourceDocument
  );
  if (duplicate) {
    alerts.push({
      id: `conf-dup-${Date.now()}`,
      type: 'DUPLICATE_EVENT',
      severity: 'INFO',
      activityId: activity.ActivityID,
      activityName: activity.Name,
      message: `Potential duplicate log across sources ("${event.sourceDocument}" and "${duplicate.sourceDocument}").`,
      details: `Both documents reported ${event.eventType} event on ${event.date} for ${activity.ActivityID}.`,
      resolved: false,
      detectedAt: new Date().toISOString(),
    });
  }

  // 5. Implausible duration vs planned (±3x)
  if (event.eventType === 'FINISH' && activity.ActualStart && eventDate) {
    const startMs = new Date(activity.ActualStart).getTime();
    const endMs = new Date(eventDate).getTime();
    const durationDays = Math.max(1, Math.round((endMs - startMs) / (1000 * 3600 * 24)));
    if (activity.PlannedDuration > 2 && (durationDays > activity.PlannedDuration * 3 || durationDays < activity.PlannedDuration / 3)) {
      alerts.push({
        id: `conf-implausible-dur-${Date.now()}`,
        type: 'IMPLAUSIBLE_DURATION',
        severity: 'WARNING',
        activityId: activity.ActivityID,
        activityName: activity.Name,
        message: `Implausible duration: Actual duration (${durationDays}d) deviates >3x from planned (${activity.PlannedDuration}d).`,
        details: `Planned duration is ${activity.PlannedDuration} days; calculated execution spans ${durationDays} days. Flagged for planner audit.`,
        resolved: false,
        detectedAt: new Date().toISOString(),
      });
    }
  }

  // 6. Conflicting dates across sources
  const conflicting = existingEvents.find(
    (e) =>
      e.id !== event.id &&
      e.matchedActivityId === activity.ActivityID &&
      e.eventType === event.eventType &&
      e.date !== event.date &&
      Math.abs(new Date(e.date).getTime() - new Date(event.date).getTime()) < 3 * 86400000
  );
  if (conflicting) {
    alerts.push({
      id: `conf-date-conflict-${Date.now()}`,
      type: 'CONFLICTING_DATES',
      severity: 'WARNING',
      activityId: activity.ActivityID,
      activityName: activity.Name,
      message: `Conflicting ${event.eventType} date: ${event.date} vs ${conflicting.date} from ${conflicting.sourceDocument}.`,
      details: `Multiple sources report different timestamps for the same event stage.`,
      resolved: false,
      detectedAt: new Date().toISOString(),
    });
  }

  return alerts;
}
