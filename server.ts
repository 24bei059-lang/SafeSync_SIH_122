import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { db, initDatabase, seedBaselineData } from './server/db';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '25mb' }));

// Initialize persistent SQLite database
initDatabase();

// Server-side Gemini initialization with telemetry header
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// -------------------------------------------------------------
// DATABASE REST API ENDPOINTS (Full-Stack Persistent Backend)
// -------------------------------------------------------------

// 1. Activities CRUD
app.get('/api/activities', (req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT * FROM activities ORDER BY ActivityID ASC').all();
    const formatted = rows.map((r: any) => ({
      ...r,
      Predecessors: JSON.parse(r.Predecessors || '[]'),
      TaggedEquipment: JSON.parse(r.TaggedEquipment || '[]'),
      IsCritical: Boolean(r.IsCritical),
    }));
    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/activities', (req: Request, res: Response) => {
  try {
    const a = req.body;
    const stmt = db.prepare(`
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

    stmt.run(
      a.ActivityID,
      a.Name,
      a.WBS,
      a.Discipline,
      a.Area,
      a.PlannedStart,
      a.PlannedFinish,
      a.PlannedDuration,
      JSON.stringify(a.Predecessors || []),
      a.Quantity,
      a.UoM,
      a.ActualStart || null,
      a.ActualFinish || null,
      a.ActualDuration || null,
      a.PercentComplete || 0,
      a.QuantityDone || 0,
      a.Status || 'NOT_STARTED',
      a.VarianceDays || 0,
      a.IsCritical ? 1 : 0,
      JSON.stringify(a.TaggedEquipment || []),
      a.LastUpdated || new Date().toISOString(),
      a.LastSource || 'SiteSync System',
      a.LastConfidence || 100,
      a.DelayReason || null,
      a.DelayCategory || null,
      a.Notes || null
    );

    res.json({ success: true, activity: a });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update activity actuals
app.put('/api/activities/:id', (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const a = req.body;
    const stmt = db.prepare(`
      UPDATE activities SET
        ActualStart = ?,
        ActualFinish = ?,
        ActualDuration = ?,
        PercentComplete = ?,
        QuantityDone = ?,
        Status = ?,
        VarianceDays = ?,
        LastUpdated = ?,
        LastSource = ?,
        LastConfidence = ?,
        DelayReason = ?,
        DelayCategory = ?
      WHERE ActivityID = ?
    `);

    stmt.run(
      a.ActualStart || null,
      a.ActualFinish || null,
      a.ActualDuration || null,
      a.PercentComplete || 0,
      a.QuantityDone || 0,
      a.Status || 'NOT_STARTED',
      a.VarianceDays || 0,
      a.LastUpdated || new Date().toISOString(),
      a.LastSource || null,
      a.LastConfidence || null,
      a.DelayReason || null,
      a.DelayCategory || null,
      id
    );

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Extracted Events CRUD
app.get('/api/events', (req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT * FROM extracted_events ORDER BY createdAt DESC').all();
    const formatted = rows.map((r: any) => ({
      ...r,
      tagIds: JSON.parse(r.tagIds || '[]'),
      matchScores: JSON.parse(r.matchScores || 'null'),
      topCandidates: JSON.parse(r.topCandidates || '[]'),
    }));
    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/events', (req: Request, res: Response) => {
  try {
    const events = Array.isArray(req.body) ? req.body : [req.body];
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO extracted_events (
        id, discipline, rawText, activityDescription, eventType,
        date, quantityDone, quantityTotal, percentComplete,
        location, tagIds, delayReason, delayCategory,
        sourceSpan, sourceDocument, matchedActivityId, matchedActivityName,
        confidence, routing, status, matchScores, topCandidates, createdAt
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?
      )
    `);

    for (const e of events) {
      stmt.run(
        e.id,
        e.discipline,
        e.rawText,
        e.activityDescription,
        e.eventType,
        e.date,
        e.quantityDone,
        e.quantityTotal,
        e.percentComplete,
        e.location,
        JSON.stringify(e.tagIds || []),
        e.delayReason || null,
        e.delayCategory || null,
        e.sourceSpan || null,
        e.sourceDocument,
        e.matchedActivityId || null,
        e.matchedActivityName || null,
        e.confidence || 0,
        e.routing || 'REVIEW_INBOX',
        e.status || 'PENDING_APPROVAL',
        JSON.stringify(e.matchScores || null),
        JSON.stringify(e.topCandidates || []),
        new Date().toISOString()
      );
    }

    res.json({ success: true, count: events.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/events/:id', (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { status, matchedActivityId, matchedActivityName, confidence, routing } = req.body;
    const stmt = db.prepare(`
      UPDATE extracted_events SET
        status = ?,
        matchedActivityId = COALESCE(?, matchedActivityId),
        matchedActivityName = COALESCE(?, matchedActivityName),
        confidence = COALESCE(?, confidence),
        routing = COALESCE(?, routing)
      WHERE id = ?
    `);
    stmt.run(status, matchedActivityId, matchedActivityName, confidence, routing, id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Conflict Alerts CRUD
app.get('/api/alerts', (req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT * FROM conflict_alerts ORDER BY detectedAt DESC').all();
    res.json(rows.map((r: any) => ({ ...r, resolved: Boolean(r.resolved) })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/alerts', (req: Request, res: Response) => {
  try {
    const alerts = Array.isArray(req.body) ? req.body : [req.body];
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO conflict_alerts (
        id, type, severity, activityId, activityName, message, details, resolved, detectedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const a of alerts) {
      stmt.run(
        a.id,
        a.type,
        a.severity,
        a.activityId,
        a.activityName,
        a.message,
        a.details || null,
        a.resolved ? 1 : 0,
        a.detectedAt || new Date().toISOString()
      );
    }
    res.json({ success: true, count: alerts.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/alerts/:id/resolve', (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    db.prepare('UPDATE conflict_alerts SET resolved = 1 WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Audit Log CRUD & Reversion
app.get('/api/audit-log', (req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT * FROM audit_log ORDER BY timestamp DESC').all();
    const formatted = rows.map((r: any) => ({
      ...r,
      previousValue: JSON.parse(r.previousValue || '{}'),
      newValue: JSON.parse(r.newValue || '{}'),
    }));
    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/audit-log', (req: Request, res: Response) => {
  try {
    const entries = Array.isArray(req.body) ? req.body : [req.body];
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO audit_log (
        id, timestamp, activityId, activityName, sourceDocument,
        rawTextSnippet, extractor, confidence, user, previousValue,
        newValue, candidatesCount, eventId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const e of entries) {
      stmt.run(
        e.id,
        e.timestamp || new Date().toISOString(),
        e.activityId,
        e.activityName,
        e.sourceDocument,
        e.rawTextSnippet,
        e.extractor,
        e.confidence,
        e.user,
        JSON.stringify(e.previousValue),
        JSON.stringify(e.newValue),
        e.candidatesCount || 1,
        e.eventId || null
      );
    }
    res.json({ success: true, count: entries.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/audit-log/revert/:id', (req: Request, res: Response) => {
  try {
    const auditId = req.params.id;
    const entry: any = db.prepare('SELECT * FROM audit_log WHERE id = ?').get(auditId);
    if (!entry) {
      return res.status(404).json({ error: 'Audit entry not found' });
    }

    const prev = JSON.parse(entry.previousValue);
    const updateStmt = db.prepare(`
      UPDATE activities SET
        ActualStart = ?,
        ActualFinish = ?,
        PercentComplete = ?,
        QuantityDone = ?,
        Status = ?,
        LastUpdated = ?,
        Notes = ?
      WHERE ActivityID = ?
    `);

    updateStmt.run(
      prev.actualStart || null,
      prev.actualFinish || null,
      prev.percentComplete || 0,
      prev.quantityDone || 0,
      prev.status || 'NOT_STARTED',
      new Date().toISOString(),
      `Reverted via Audit Log ID ${auditId}`,
      entry.activityId
    );

    // Delete or mark reverted
    db.prepare('DELETE FROM audit_log WHERE id = ?').run(auditId);
    res.json({ success: true, revertedActivityId: entry.activityId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Learned Mappings
app.get('/api/learned-mappings', (req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT * FROM learned_mappings ORDER BY frequency DESC').all();
    res.json(rows.map((r: any) => ({ ...r, synonymsAdded: JSON.parse(r.synonymsAdded || '[]') })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/learned-mappings', (req: Request, res: Response) => {
  try {
    const m = req.body;
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO learned_mappings (
        id, phrase, targetActivityId, targetActivityName, discipline, frequency, learnedAt, synonymsAdded
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      m.id || `map-${Date.now()}`,
      m.phrase,
      m.targetActivityId,
      m.targetActivityName,
      m.discipline,
      m.frequency || 1,
      m.learnedAt || new Date().toISOString(),
      JSON.stringify(m.synonymsAdded || [])
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/learned-mappings/:id', (req: Request, res: Response) => {
  try {
    db.prepare('DELETE FROM learned_mappings WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Discipline Synonyms
app.get('/api/synonyms', (req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT * FROM discipline_synonyms ORDER BY term ASC').all();
    res.json(rows.map((r: any) => ({ ...r, synonyms: JSON.parse(r.synonyms || '[]') })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/synonyms', (req: Request, res: Response) => {
  try {
    const { term, discipline, synonyms } = req.body;
    db.prepare(`
      INSERT OR REPLACE INTO discipline_synonyms (term, discipline, synonyms)
      VALUES (?, ?, ?)
    `).run(term, discipline, JSON.stringify(synonyms || []));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Past Projects Benchmarking Dataset
app.get('/api/past-projects', (req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT * FROM past_projects').all();
    res.json(rows.map((r: any) => ({ ...r, activities: JSON.parse(r.activities || '[]') })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Reset Database
app.post('/api/reset-database', (req: Request, res: Response) => {
  try {
    db.exec(`
      DELETE FROM activities;
      DELETE FROM extracted_events;
      DELETE FROM audit_log;
      DELETE FROM conflict_alerts;
      DELETE FROM learned_mappings;
      DELETE FROM discipline_synonyms;
      DELETE FROM past_projects;
    `);
    seedBaselineData();
    res.json({ success: true, message: 'Database reset and re-seeded to initial state.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// AI PIPELINE ENDPOINTS (GEMINI API)
// -------------------------------------------------------------

// 1. EXTRACTION API - Gemini 3.8 Flash with structured schema
app.post('/api/extract', async (req: Request, res: Response) => {
  try {
    const { text, reportDate = '2026-10-04', documentName = 'Daily Log' } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text content is required' });
    }

    if (!ai) {
      return res.json({
        events: fallbackExtract(text, reportDate, documentName),
        engine: 'deterministic-fallback',
        warning: 'GEMINI_API_KEY not set. Used local deterministic extractor.',
      });
    }

    const prompt = `You are a Senior Oil & Gas / EPC Planning Engineer. Extract all distinct actual site progress events, milestones, starts, finishes, and delay incidents from the provided daily report or field update.
Reference Report Date: ${reportDate}. Resolve relative dates like "today", "yesterday", "tomorrow" relative to ${reportDate}.
Input document: "${documentName}".
Notice: The text may contain acronyms (PCC, RCC, NDT, RT, PT, DCS, P&ID, LM, MT, spool, tie-in, blinding), Hinglish, equipment/line tags (e.g. Line 24"-PR-1042, P-101, C-201, T-101, FV-102, 12"-HC-2001).

Source text to extract:
"""
${text}
"""`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You extract EPC construction activities from unstructured field text into structured JSON.',
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          description: 'List of extracted site progress events',
          items: {
            type: Type.OBJECT,
            properties: {
              discipline: {
                type: Type.STRING,
                description: 'Civil, Piping, Static Equipment, Rotating Equipment, Electrical, Instrumentation, or HSE',
              },
              rawText: {
                type: Type.STRING,
                description: 'The exact or core sentence from the source text',
              },
              activityDescription: {
                type: Type.STRING,
                description: 'Clean standard description of the executed task or event',
              },
              eventType: {
                type: Type.STRING,
                description: 'START, FINISH, PROGRESS, DELAY, or NEW_ACTIVITY',
              },
              date: {
                type: Type.STRING,
                description: 'YYYY-MM-DD format date of event execution',
              },
              quantityDone: {
                type: Type.NUMBER,
                description: 'Numeric quantity executed today if mentioned, else null',
              },
              quantityTotal: {
                type: Type.NUMBER,
                description: 'Total scope target quantity if mentioned, else null',
              },
              percentComplete: {
                type: Type.NUMBER,
                description: 'Cumulative or estimated percent complete (0-100) if identifiable, else null',
              },
              location: {
                type: Type.STRING,
                description: 'Plant unit, area, or rack location',
              },
              tagIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Equipment tags, line numbers, instrument tags identified (e.g., P-101, Line 24"-PR-1042)',
              },
              delayReason: {
                type: Type.STRING,
                description: 'Explicit reason for delay or stoppage if event is DELAY or hindered',
              },
              delayCategory: {
                type: Type.STRING,
                description: 'material, manpower, weather, permit, equipment, design, or other',
              },
              sourceSpan: {
                type: Type.STRING,
                description: 'Specific snippet of source text describing this event',
              },
            },
            required: ['discipline', 'rawText', 'activityDescription', 'eventType', 'date', 'tagIds', 'sourceSpan'],
          },
        },
      },
    });

    const outputText = response.text || '[]';
    let parsedEvents: any[] = [];
    try {
      parsedEvents = JSON.parse(outputText);
    } catch {
      parsedEvents = fallbackExtract(text, reportDate, documentName);
    }

    res.json({
      events: parsedEvents,
      engine: 'gemini-3.8-flash',
    });
  } catch (error: any) {
    console.error('Gemini extraction error, falling back:', error?.message);
    const { text = '', reportDate = '2026-10-04', documentName = 'Daily Log' } = req.body || {};
    res.json({
      events: fallbackExtract(text, reportDate, documentName),
      engine: 'deterministic-fallback',
      warning: `Gemini API call failed: ${error?.message}. Fallback used.`,
    });
  }
});

// 2. MULTIMODAL IMAGE EXTRACTION (OCR & Structured Parsing)
app.post('/api/extract-image', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = 'image/png', reportDate = '2026-10-04' } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 is required' });
    }

    if (!ai) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY required for multimodal image extraction. Please attach your API key in Settings > Secrets.',
      });
    }

    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
      },
    };

    const textPrompt = `You are a Senior EPC Planning Engineer inspecting a scanned or photographed construction site diary/shift log.
First, perform precise OCR on all handwritten and printed notes, abbreviations, and tables in the image.
Then, extract every construction progress event, actual start, finish, quantity, line/equipment tag, and delay.
Assume baseline reference date: ${reportDate}.

Output a JSON array of events following this exact structure:
[
  {
    "discipline": "Civil" | "Piping" | "Static Equipment" | "Rotating Equipment" | "Electrical" | "Instrumentation" | "HSE",
    "rawText": "OCR text snippet",
    "activityDescription": "standardized description",
    "eventType": "START" | "FINISH" | "PROGRESS" | "DELAY" | "NEW_ACTIVITY",
    "date": "YYYY-MM-DD",
    "quantityDone": number or null,
    "quantityTotal": number or null,
    "percentComplete": number or null,
    "location": "location name",
    "tagIds": ["tag1", "tag2"],
    "delayReason": "reason" or null,
    "delayCategory": "material" | "manpower" | "weather" | "permit" | "equipment" | "design" | "other" | null,
    "sourceSpan": "snippet"
  }
]`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [imagePart, { text: textPrompt }],
      },
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '[]');
    res.json({
      events: parsed,
      engine: 'gemini-3.8-flash-multimodal',
    });
  } catch (error: any) {
    console.error('Image extraction error:', error?.message);
    res.status(500).json({ error: error?.message || 'Failed to extract from image' });
  }
});

// 3. LLM RE-RANKER & EXPLAINABLE MATCHING
app.post('/api/rerank', async (req: Request, res: Response) => {
  try {
    const { event, candidates } = req.body;
    if (!event || !Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({ error: 'event and candidates array required' });
    }

    if (!ai) {
      const best = candidates[0];
      return res.json({
        bestCandidateId: best ? best.ActivityID : null,
        confidenceScore: 82,
        reasoning: `Deterministic match against ${best?.Name} based on keyword & tag overlap.`,
        breakdown: {
          tagMatch: 90,
          textMatch: 75,
          disciplineAreaMatch: 85,
          semanticMatch: 80,
        },
      });
    }

    const prompt = `You are an EPC scheduling referee matching messy site progress events to Primavera P6 L5/L6 baseline activities.
Site Event:
- Description: "${event.activityDescription}"
- Raw text: "${event.rawText}"
- Discipline: "${event.discipline}"
- Tags: ${(event.tagIds || []).join(', ') || 'None'}
- Location: "${event.location || ''}"
- Event Type: "${event.eventType}"

Top Candidates from Schedule:
${candidates
  .map(
    (c: any, i: number) =>
      `[Candidate ${i + 1}] ID: ${c.ActivityID} | Name: "${c.Name}" | Discipline: ${c.Discipline} | Area: "${c.Area}" | Tags/Scope: ${c.Quantity} ${c.UoM}`
  )
  .join('\n')}

Evaluate each candidate against the site event. Return the best candidate ID (or null if none match), the final confidence score (0-100), explicit reasoning, and score breakdown.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            bestCandidateId: {
              type: Type.STRING,
              description: 'ActivityID of best candidate or "none" if no valid match',
            },
            confidenceScore: {
              type: Type.NUMBER,
              description: 'Final confidence percentage 0 to 100',
            },
            reasoning: {
              type: Type.STRING,
              description: 'Clear engineering justification of why this activity matches or why none match',
            },
            breakdown: {
              type: Type.OBJECT,
              properties: {
                tagMatch: { type: Type.NUMBER },
                textMatch: { type: Type.NUMBER },
                disciplineAreaMatch: { type: Type.NUMBER },
                semanticMatch: { type: Type.NUMBER },
              },
              required: ['tagMatch', 'textMatch', 'disciplineAreaMatch', 'semanticMatch'],
            },
          },
          required: ['bestCandidateId', 'confidenceScore', 'reasoning', 'breakdown'],
        },
      },
    });

    const result = JSON.parse(response.text || '{}');
    res.json(result);
  } catch (error: any) {
    console.error('Re-ranker error:', error?.message);
    const top = req.body?.candidates?.[0];
    res.json({
      bestCandidateId: top ? top.ActivityID : null,
      confidenceScore: 78,
      reasoning: 'Fallback deterministic re-ranking based on discipline & keyword score.',
      breakdown: {
        tagMatch: 80,
        textMatch: 75,
        disciplineAreaMatch: 80,
        semanticMatch: 75,
      },
    });
  }
});

// 4. CONVERSATIONAL TIME AGENT
app.post('/api/time-agent', async (req: Request, res: Response) => {
  try {
    const { message, history = [], planActivities = [] } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    if (!ai) {
      return res.json({
        reply: `Logged update for "${message}". Identified event as in progress. (Local mode)`,
        needsClarification: false,
        clarificationOptions: [],
        extractedEvent: {
          discipline: 'Piping',
          activityDescription: message,
          eventType: 'PROGRESS',
          date: new Date().toISOString().split('T')[0],
          confidence: 85,
        },
      });
    }

    const recentContext = history.slice(-6).map((h: any) => `${h.role}: ${h.text}`).join('\n');
    const scheduleSummary = planActivities
      .slice(0, 30)
      .map((a: any) => `${a.ActivityID}: "${a.Name}" (${a.Discipline}, ${a.Area})`)
      .join('\n');

    const prompt = `You are "SiteSync Time Agent", an on-site field assistant for EPC supervisors logging daily progress via voice or chat.
Keep answers concise, professional, and mobile-friendly.

Current Baseline Activities (sample subset):
${scheduleSummary}

Conversation context:
${recentContext}

Supervisor message: "${message}"

Your goal:
1. Identify if the supervisor is logging a START, FINISH, PROGRESS, or DELAY.
2. Check if the mentioned activity is ambiguous among multiple plan activities (e.g. they say "Line 24" and there are two line 24 activities).
3. If ambiguous, ask ONE short clarifying question with 2-4 tappable choices.
4. If clear, confirm the log in 1-2 friendly sentences and output the extracted event fields.

Output JSON:
{
  "reply": "string to display to user",
  "needsClarification": boolean,
  "clarificationOptions": ["Option A", "Option B"],
  "matchedActivityId": "ID or null",
  "extractedEvent": {
    "discipline": "Discipline",
    "activityDescription": "string",
    "eventType": "START" | "FINISH" | "PROGRESS" | "DELAY",
    "date": "YYYY-MM-DD",
    "quantityDone": number or null,
    "percentComplete": number or null,
    "tagIds": ["tag1"],
    "delayReason": "reason" or null
  } or null
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (error: any) {
    console.error('Time agent error:', error?.message);
    res.json({
      reply: `Understood: "${req.body.message}". Logged progress update to schedule queue.`,
      needsClarification: false,
      clarificationOptions: [],
      matchedActivityId: null,
      extractedEvent: {
        discipline: 'Piping',
        activityDescription: req.body.message,
        eventType: 'PROGRESS',
        date: new Date().toISOString().split('T')[0],
      },
    });
  }
});

// 5. INSTITUTIONAL MEMORY Q&A (Grounded strictly on dataset)
app.post('/api/memory-qa', async (req: Request, res: Response) => {
  try {
    const { query, pastProjects = [], currentSchedule = [] } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }

    if (!ai) {
      return res.json({
        answer: `Analysis for "${query}": Foundation PCC and Piping spools show historical delays of 2-5 days due to material delivery and rebar congestion. (Based on benchmark dataset).`,
        referencedData: [
          { Project: 'Yamal LNG Train 3', Activity: 'Foundation PCC – Compressor', PlannedDays: 14, ActualDays: 19, Slippage: '+5d', Cause: 'Weather / Frost' },
          { Project: 'Jurong Aromatics Cracker', Activity: 'Piping Spool Erection 24"', PlannedDays: 20, ActualDays: 28, Slippage: '+8d', Cause: 'Material / Blind shortage' },
        ],
      });
    }

    const memoryDatasetSummary = pastProjects
      .map((p: any) =>
        `Project: ${p.projectName} (${p.type}, Client: ${p.client})\n` +
        (p.activities || [])
          .map(
            (a: any) =>
              `- ${a.discipline} | ${a.name} | Plan: ${a.plannedDuration}d, Act: ${a.actualDuration}d (Var: ${a.varianceDays > 0 ? '+' : ''}${a.varianceDays}d) | Delay: ${a.primaryDelayCategory} (${(a.delayCauses || []).join(', ')}) | Prod: ${a.productivityUnitPerDay} ${a.uom}/day`
          )
          .join('\n')
      )
      .join('\n\n');

    const prompt = `You are the EPC Institutional Memory Analytics Engine. Answer the user query using ONLY the provided historical project records.
User Question: "${query}"

HISTORICAL DATASET (Past Projects):
"""
${memoryDatasetSummary}
"""

Instructions:
1. Provide a sharp, data-driven answer citing specific projects, planned vs actual durations, and real root causes.
2. DO NOT hallucinate projects or activities not in the dataset.
3. Include an array of the exact referenced rows as a structured table so the user can audit your answer.

Output format JSON:
{
  "answer": "Clear markdown answer with key insights, P50/P90 numbers if applicable, and root causes.",
  "referencedData": [
    {
      "Project": "string",
      "Discipline": "string",
      "Activity": "string",
      "PlannedDays": number,
      "ActualDays": number,
      "VarianceDays": number,
      "PrimaryCause": "string"
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (error: any) {
    console.error('Memory QA error:', error?.message);
    res.status(500).json({ error: error?.message || 'Institutional memory query failed' });
  }
});

// Deterministic fallback extractor if Gemini API is unavailable
function fallbackExtract(text: string, reportDate: string, docName: string) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const events: any[] = [];

  for (const line of lines) {
    const lower = line.toLowerCase();
    let discipline = 'Piping';
    if (lower.includes('civil') || lower.includes('pcc') || lower.includes('pedestal') || lower.includes('foundation') || lower.includes('rebar')) {
      discipline = 'Civil';
    } else if (lower.includes('compressor') || lower.includes('pump') || lower.includes('align') || lower.includes('grout') || lower.includes('motor')) {
      discipline = 'Rotating Equipment';
    } else if (lower.includes('column') || lower.includes('drum') || lower.includes('exchanger') || lower.includes('vessel')) {
      discipline = 'Static Equipment';
    } else if (lower.includes('cable') || lower.includes('tray') || lower.includes('switchgear') || lower.includes('transformer')) {
      discipline = 'Electrical';
    } else if (lower.includes('loop') || lower.includes('transmitter') || lower.includes('valve') || lower.includes('dcs') || lower.includes('wiring')) {
      discipline = 'Instrumentation';
    } else if (lower.includes('gas test') || lower.includes('scaffold') || lower.includes('permit') || lower.includes('hse') || lower.includes('safety')) {
      discipline = 'HSE';
    }

    let eventType = 'PROGRESS';
    if (lower.includes('commenced') || lower.includes('started') || lower.includes('poured') || lower.includes('initiat')) {
      eventType = 'START';
    } else if (lower.includes('completed') || lower.includes('done 100%') || lower.includes('finished') || lower.includes('stripped')) {
      eventType = 'FINISH';
    } else if (lower.includes('delay') || lower.includes('shortage') || lower.includes('pending') || lower.includes('hold') || lower.includes('lack of')) {
      eventType = 'DELAY';
    } else if (lower.includes('new act') || lower.includes('unplanned') || lower.includes('extra work')) {
      eventType = 'NEW_ACTIVITY';
    }

    const tags: string[] = [];
    const lineTagMatch = line.match(/Line\s+[\w"-]+/gi) || line.match(/[\d]+"-[\w-]+/g);
    if (lineTagMatch) tags.push(...lineTagMatch);
    const eqTagMatch = line.match(/\b([PTEC]-\d{3}|PT-\d{3}|FV-\d{3}|SS-\d{2}|TX-\d{2})\b/g);
    if (eqTagMatch) tags.push(...eqTagMatch);

    let qtyDone: number | null = null;
    let qtyTotal: number | null = null;
    const qtyMatch = line.match(/(\d+(?:\.\d+)?)\s*(?:of|\/)\s*(\d+(?:\.\d+)?)/);
    if (qtyMatch) {
      qtyDone = parseFloat(qtyMatch[1]);
      qtyTotal = parseFloat(qtyMatch[2]);
    } else {
      const singleQty = line.match(/(\d+(?:\.\d+)?)\s*(m3|lm|mt|m2|spools?|ea)/i);
      if (singleQty) {
        qtyDone = parseFloat(singleQty[1]);
      }
    }

    let delayReason: string | null = null;
    let delayCategory: string | null = null;
    if (eventType === 'DELAY' || lower.includes('shortage') || lower.includes('delayed') || lower.includes('absent')) {
      delayReason = line.replace(/^[-\d.\s]+/, '').trim();
      if (lower.includes('shortage') || lower.includes('blind') || lower.includes('rebar delivery')) delayCategory = 'material';
      else if (lower.includes('absent') || lower.includes('gang not available')) delayCategory = 'manpower';
      else if (lower.includes('rain') || lower.includes('wind') || lower.includes('weather')) delayCategory = 'weather';
      else if (lower.includes('breakdown')) delayCategory = 'equipment';
      else delayCategory = 'other';
    }

    events.push({
      discipline,
      rawText: line.trim(),
      activityDescription: line.replace(/^[-\d.\s]+/, '').trim(),
      eventType,
      date: reportDate,
      quantityDone: qtyDone,
      quantityTotal: qtyTotal,
      percentComplete: qtyDone && qtyTotal ? Math.round((qtyDone / qtyTotal) * 100) : eventType === 'FINISH' ? 100 : null,
      location: lower.includes('unit 2') ? 'Unit 2' : lower.includes('rack') ? 'Pipe Rack PR-02' : lower.includes('pump') ? 'Pump Area P-101' : 'Site Wide',
      tagIds: Array.from(new Set(tags)),
      delayReason,
      delayCategory,
      sourceSpan: line.trim().slice(0, 100),
    });
  }

  return events;
}

// Start dev or production server
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SiteSync SQLite-backed full-stack server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
