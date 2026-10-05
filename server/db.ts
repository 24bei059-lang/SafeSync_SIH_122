import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { INITIAL_SCHEDULE } from '../src/data/syntheticSchedule';
import { PAST_PROJECTS } from '../src/data/pastProjects';
import { DISCIPLINE_SYNONYMS } from '../src/data/synonyms';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists
const dataDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'sitesync.db');
export const db = new DatabaseSync(dbPath);

// Initialize relational schema
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS activities (
      ActivityID TEXT PRIMARY KEY,
      Name TEXT NOT NULL,
      WBS TEXT NOT NULL,
      Discipline TEXT NOT NULL,
      Area TEXT NOT NULL,
      PlannedStart TEXT NOT NULL,
      PlannedFinish TEXT NOT NULL,
      PlannedDuration INTEGER NOT NULL,
      Predecessors TEXT NOT NULL, -- JSON array
      Quantity REAL NOT NULL,
      UoM TEXT NOT NULL,
      ActualStart TEXT,
      ActualFinish TEXT,
      ActualDuration INTEGER,
      PercentComplete REAL NOT NULL DEFAULT 0,
      QuantityDone REAL NOT NULL DEFAULT 0,
      Status TEXT NOT NULL DEFAULT 'NOT_STARTED',
      VarianceDays INTEGER DEFAULT 0,
      IsCritical INTEGER DEFAULT 0,
      TaggedEquipment TEXT, -- JSON array
      LastUpdated TEXT,
      LastSource TEXT,
      LastConfidence REAL,
      DelayReason TEXT,
      DelayCategory TEXT,
      Notes TEXT
    );

    CREATE TABLE IF NOT EXISTS extracted_events (
      id TEXT PRIMARY KEY,
      discipline TEXT NOT NULL,
      rawText TEXT NOT NULL,
      activityDescription TEXT NOT NULL,
      eventType TEXT NOT NULL,
      date TEXT NOT NULL,
      quantityDone REAL,
      quantityTotal REAL,
      percentComplete REAL,
      location TEXT,
      tagIds TEXT, -- JSON array
      delayReason TEXT,
      delayCategory TEXT,
      sourceSpan TEXT,
      sourceDocument TEXT NOT NULL,
      matchedActivityId TEXT,
      matchedActivityName TEXT,
      confidence REAL DEFAULT 0,
      routing TEXT NOT NULL,
      status TEXT NOT NULL,
      matchScores TEXT, -- JSON object
      topCandidates TEXT, -- JSON array
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      activityId TEXT NOT NULL,
      activityName TEXT NOT NULL,
      sourceDocument TEXT NOT NULL,
      rawTextSnippet TEXT NOT NULL,
      extractor TEXT NOT NULL,
      confidence REAL NOT NULL,
      user TEXT NOT NULL,
      previousValue TEXT NOT NULL, -- JSON
      newValue TEXT NOT NULL, -- JSON
      candidatesCount INTEGER DEFAULT 1,
      eventId TEXT
    );

    CREATE TABLE IF NOT EXISTS conflict_alerts (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      severity TEXT NOT NULL,
      activityId TEXT NOT NULL,
      activityName TEXT NOT NULL,
      message TEXT NOT NULL,
      details TEXT,
      resolved INTEGER DEFAULT 0,
      detectedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS learned_mappings (
      id TEXT PRIMARY KEY,
      phrase TEXT NOT NULL,
      targetActivityId TEXT NOT NULL,
      targetActivityName TEXT NOT NULL,
      discipline TEXT NOT NULL,
      frequency INTEGER DEFAULT 1,
      learnedAt TEXT NOT NULL,
      synonymsAdded TEXT -- JSON array
    );

    CREATE TABLE IF NOT EXISTS discipline_synonyms (
      term TEXT PRIMARY KEY,
      discipline TEXT NOT NULL,
      synonyms TEXT NOT NULL -- JSON array
    );

    CREATE TABLE IF NOT EXISTS past_projects (
      id TEXT PRIMARY KEY,
      projectName TEXT NOT NULL,
      client TEXT NOT NULL,
      type TEXT NOT NULL,
      location TEXT NOT NULL,
      completedYear INTEGER NOT NULL,
      activities TEXT NOT NULL -- JSON array
    );
  `);

  // Seed baseline schedule if empty
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM activities');
  const result: any = countStmt.get();
  if (result.count === 0) {
    seedBaselineData();
  }
}

export function seedBaselineData() {
  const insertAct = db.prepare(`
    INSERT OR REPLACE INTO activities (
      ActivityID, Name, WBS, Discipline, Area,
      PlannedStart, PlannedFinish, PlannedDuration,
      Predecessors, Quantity, UoM, ActualStart, ActualFinish,
      ActualDuration, PercentComplete, QuantityDone, Status,
      VarianceDays, IsCritical, TaggedEquipment, LastUpdated,
      LastSource, LastConfidence, DelayReason, DelayCategory, Notes
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?
    )
  `);

  for (const act of INITIAL_SCHEDULE) {
    insertAct.run(
      act.ActivityID,
      act.Name,
      act.WBS,
      act.Discipline,
      act.Area,
      act.PlannedStart,
      act.PlannedFinish,
      act.PlannedDuration,
      JSON.stringify(act.Predecessors || []),
      act.Quantity,
      act.UoM,
      act.ActualStart || null,
      act.ActualFinish || null,
      act.ActualDuration || null,
      act.PercentComplete || 0,
      act.QuantityDone || 0,
      act.Status || 'NOT_STARTED',
      act.VarianceDays || 0,
      act.IsCritical ? 1 : 0,
      JSON.stringify(act.TaggedEquipment || []),
      act.LastUpdated || null,
      act.LastSource || null,
      act.LastConfidence || null,
      act.DelayReason || null,
      act.DelayCategory || null,
      act.Notes || null
    );
  }

  // Seed past projects
  const insertPast = db.prepare(`
    INSERT OR REPLACE INTO past_projects (
      id, projectName, client, type, location, completedYear, activities
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const proj of PAST_PROJECTS) {
    insertPast.run(
      proj.id,
      proj.projectName,
      proj.client,
      proj.type,
      proj.location,
      proj.completedYear,
      JSON.stringify(proj.activities)
    );
  }

  // Seed synonyms
  const insertSyn = db.prepare(`
    INSERT OR REPLACE INTO discipline_synonyms (term, discipline, synonyms)
    VALUES (?, ?, ?)
  `);

  for (const syn of DISCIPLINE_SYNONYMS) {
    insertSyn.run(syn.term, syn.discipline, JSON.stringify(syn.synonyms));
  }

  // Seed initial learned mappings
  const insertLearn = db.prepare(`
    INSERT OR REPLACE INTO learned_mappings (
      id, phrase, targetActivityId, targetActivityName, discipline, frequency, learnedAt, synonymsAdded
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertLearn.run(
    'init-map-1',
    '24in line spool erected near pump area',
    'PIP-201',
    'Erect Line 24"-PR-1042 Spool',
    'Piping',
    2,
    '2026-10-04T10:00:00Z',
    JSON.stringify(['24in line spool', 'pipe rack tier 1'])
  );

  insertLearn.run(
    'init-map-2',
    'P-101 bseplate gr0uting started',
    'ROT-402',
    'Shaft Alignment & Baseplate Grouting – Pump P-101',
    'Rotating Equipment',
    1,
    '2026-10-04T11:00:00Z',
    JSON.stringify(['bseplate gr0uting', 'non-shrnk grout'])
  );

  console.log('SiteSync SQLite database seeded successfully.');
}
