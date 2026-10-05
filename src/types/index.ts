export type Discipline =
  | 'Civil'
  | 'Piping'
  | 'Static Equipment'
  | 'Rotating Equipment'
  | 'Electrical'
  | 'Instrumentation'
  | 'HSE';

export type ActivityStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED';

export interface PlanActivity {
  ActivityID: string;
  Name: string;
  WBS: string;
  Discipline: Discipline;
  Area: string;
  PlannedStart: string; // YYYY-MM-DD
  PlannedFinish: string; // YYYY-MM-DD
  PlannedDuration: number; // days
  Predecessors: string[]; // ActivityIDs
  Quantity: number;
  UoM: string;
  ActualStart?: string | null;
  ActualFinish?: string | null;
  ActualDuration?: number | null;
  PercentComplete: number;
  QuantityDone: number;
  Status: ActivityStatus;
  VarianceDays?: number;
  IsCritical?: boolean;
  LastUpdated?: string;
  LastSource?: string;
  LastConfidence?: number;
  DelayReason?: string | null;
  DelayCategory?: string | null;
  TaggedEquipment?: string[];
  Notes?: string;
}

export type EventType = 'START' | 'FINISH' | 'PROGRESS' | 'DELAY' | 'NEW_ACTIVITY';
export type DelayCategory =
  | 'material'
  | 'manpower'
  | 'weather'
  | 'permit'
  | 'equipment'
  | 'design'
  | 'other';

export interface CandidateScore {
  activityId: string;
  activityName: string;
  discipline: Discipline;
  area: string;
  score: number; // 0 - 100
  tagMatch: number;
  textMatch: number;
  disciplineAreaMatch: number;
  semanticMatch: number;
  reason: string;
}

export interface ExtractedEvent {
  id: string;
  discipline: Discipline;
  rawText: string;
  activityDescription: string;
  eventType: EventType;
  date: string;
  quantityDone: number | null;
  quantityTotal: number | null;
  percentComplete: number | null;
  location: string;
  tagIds: string[];
  delayReason: string | null;
  delayCategory: DelayCategory | null;
  sourceSpan: string;
  sourceDocument: string;
  matchedActivityId?: string | null;
  matchedActivityName?: string | null;
  confidence: number;
  routing: 'AUTO_COMMITTED' | 'NEEDS_APPROVAL' | 'REVIEW_INBOX' | 'NEW_ACTIVITY';
  status: 'PENDING_APPROVAL' | 'COMMITTED' | 'REJECTED' | 'NEW_ACTIVITY_ADDED';
  matchScores?: {
    tagMatch: number;
    textSimilarity: number;
    disciplineAreaMatch: number;
    semanticScore: number;
    reasoning: string;
  };
  topCandidates?: CandidateScore[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  activityId: string;
  activityName: string;
  sourceDocument: string;
  rawTextSnippet: string;
  extractor: 'AI_GEMINI' | 'MANUAL_SUPERVISOR' | 'CSV_INGEST' | 'PLANNER_OVERRIDE' | 'AUTO_LINK';
  confidence: number;
  user: string;
  previousValue: {
    actualStart?: string | null;
    actualFinish?: string | null;
    percentComplete: number;
    quantityDone: number;
    status: ActivityStatus;
  };
  newValue: {
    actualStart?: string | null;
    actualFinish?: string | null;
    percentComplete: number;
    quantityDone: number;
    status: ActivityStatus;
  };
  candidatesCount?: number;
  eventId?: string;
}

export interface ConflictAlert {
  id: string;
  type:
    | 'FINISH_BEFORE_START'
    | 'START_BEFORE_PREDECESSOR'
    | 'DUPLICATE_EVENT'
    | 'PROGRESS_OVER_100'
    | 'IMPLAUSIBLE_DURATION'
    | 'CONFLICTING_DATES';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  activityId: string;
  activityName: string;
  message: string;
  details: string;
  resolved: boolean;
  detectedAt: string;
}

export interface LearnedMapping {
  id: string;
  phrase: string;
  targetActivityId: string;
  targetActivityName: string;
  discipline: Discipline;
  frequency: number;
  learnedAt: string;
  synonymsAdded: string[];
}

export interface PastProjectActivity {
  name: string;
  discipline: Discipline;
  plannedDuration: number;
  actualDuration: number;
  varianceDays: number;
  productivityUnitPerDay: number;
  uom: string;
  delayCauses: string[];
  primaryDelayCategory: DelayCategory;
  area: string;
  weekNumber: number;
}

export interface PastProject {
  id: string;
  projectName: string;
  client: string;
  type: string;
  location: string;
  completedYear: number;
  activities: PastProjectActivity[];
}
