import { PlanActivity, ExtractedEvent, CandidateScore, LearnedMapping } from '../types';
import { DISCIPLINE_SYNONYMS } from '../data/synonyms';

// Levenshtein distance for fuzzy matching typos
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

// Token set Jaccard / Dice similarity
function tokenSetSimilarity(strA: string, strB: string): number {
  const cleanA = strA.toLowerCase().replace(/[^a-z0-9\s"-]/g, ' ');
  const cleanB = strB.toLowerCase().replace(/[^a-z0-9\s"-]/g, ' ');
  const setA = new Set(cleanA.split(/\s+/).filter((t) => t.length > 1));
  const setB = new Set(cleanB.split(/\s+/).filter((t) => t.length > 1));

  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) {
      intersection++;
    } else {
      // Check 1-char Levenshtein for OCR typo tolerance
      for (const b of setB) {
        if (Math.abs(item.length - b.length) <= 1 && levenshteinDistance(item, b) <= 1) {
          intersection += 0.8;
          break;
        }
      }
    }
  }

  const union = setA.size + setB.size - intersection;
  return union > 0 ? (intersection / union) * 100 : 0;
}

// Normalize and expand site jargon / OCR typos using synonym dictionary
export function normalizeAndExpandText(text: string): { normalized: string; expanded: string; tags: string[] } {
  let cleaned = text
    .toLowerCase()
    .replace(/\bgr0uting\b/g, 'grouting')
    .replace(/\bbseplate\b/g, 'baseplate')
    .replace(/\bcabl\b/g, 'cable')
    .replace(/\binstaltion\b/g, 'installation')
    .replace(/\bhydr0test\b/g, 'hydrotest')
    .replace(/\bdelyed\b/g, 'delayed')
    .replace(/\berctn\b/g, 'erection')
    .replace(/\bcomenced\b/g, 'commenced')
    .replace(/\bactvty\b/g, 'activity')
    .replace(/\bunplnd\b/g, 'unplanned');

  // Extract tags (Line numbers like 24"-PR-1042, 12"-HC-2001 or equipment tags P-101, C-201, T-101)
  const tags: string[] = [];
  const lineMatches = text.match(/\b(?:\d+["']?-|Line\s+)?[\w]+-[\w]+-\d+\b/gi) || [];
  const directLine = text.match(/\b\d+["']-[\w-]+/g) || [];
  const eqMatches = text.match(/\b([PTEC]-\d{3}|PT-\d{3}|FV-\d{3}|SS-\d{2}|TX-\d{2}|JB-\d{2}|D-\d{3})\b/gi) || [];

  [...lineMatches, ...directLine, ...eqMatches].forEach((t) => {
    const cleanTag = t.replace(/^Line\s+/i, '').trim();
    if (!tags.includes(cleanTag)) tags.push(cleanTag);
  });

  // Synonym expansions
  let expanded = cleaned;
  for (const entry of DISCIPLINE_SYNONYMS) {
    const termRegex = new RegExp(`\\b${entry.term.toLowerCase()}\\b`, 'gi');
    if (termRegex.test(cleaned)) {
      expanded += ' ' + entry.synonyms.join(' ');
    }
    for (const syn of entry.synonyms) {
      if (cleaned.includes(syn.toLowerCase())) {
        expanded += ' ' + entry.term.toLowerCase();
      }
    }
  }

  return { normalized: cleaned, expanded, tags };
}

// Hybrid Matching Function
export async function matchEventToActivities(
  event: ExtractedEvent,
  activities: PlanActivity[],
  learnedMappings: LearnedMapping[] = [],
  useLlmReRanker: boolean = true
): Promise<{
  bestMatch: PlanActivity | null;
  confidence: number;
  routing: 'AUTO_COMMITTED' | 'NEEDS_APPROVAL' | 'REVIEW_INBOX' | 'NEW_ACTIVITY';
  topCandidates: CandidateScore[];
  matchScores: {
    tagMatch: number;
    textSimilarity: number;
    disciplineAreaMatch: number;
    semanticScore: number;
    reasoning: string;
  };
}> {
  // If explicitly NEW_ACTIVITY, route immediately to review inbox
  if (event.eventType === 'NEW_ACTIVITY') {
    return {
      bestMatch: null,
      confidence: 15,
      routing: 'NEW_ACTIVITY',
      topCandidates: [],
      matchScores: {
        tagMatch: 0,
        textSimilarity: 10,
        disciplineAreaMatch: 20,
        semanticScore: 10,
        reasoning: 'Event explicitly flagged as an unplanned/new activity not in original baseline schedule.',
      },
    };
  }

  const { normalized, expanded, tags } = normalizeAndExpandText(
    `${event.activityDescription} ${event.rawText} ${(event.tagIds || []).join(' ')}`
  );

  // 1. Check Learned Mappings first!
  for (const mapping of learnedMappings) {
    const sim = tokenSetSimilarity(event.activityDescription, mapping.phrase);
    if (sim > 75 || normalized.includes(mapping.phrase.toLowerCase())) {
      const targetAct = activities.find((a) => a.ActivityID === mapping.targetActivityId);
      if (targetAct) {
        const topCand: CandidateScore = {
          activityId: targetAct.ActivityID,
          activityName: targetAct.Name,
          discipline: targetAct.Discipline,
          area: targetAct.Area,
          score: 96,
          tagMatch: 95,
          textMatch: 95,
          disciplineAreaMatch: 98,
          semanticMatch: 96,
          reason: `Exact match from Planner Learned institutional memory ("${mapping.phrase}" → ${targetAct.ActivityID}).`,
        };
        return {
          bestMatch: targetAct,
          confidence: 96,
          routing: 'AUTO_COMMITTED',
          topCandidates: [topCand],
          matchScores: {
            tagMatch: 95,
            textSimilarity: 95,
            disciplineAreaMatch: 98,
            semanticScore: 96,
            reasoning: topCand.reason,
          },
        };
      }
    }
  }

  // 2. Score all candidate activities
  const candidateScores: CandidateScore[] = activities.map((act) => {
    // a. Tag Match (35% weight)
    let tagMatch = 0;
    const actTags = [
      ...(act.TaggedEquipment || []),
      ...(act.Name.match(/\b([PTEC]-\d{3}|PT-\d{3}|FV-\d{3}|SS-\d{2}|TX-\d{2}|JB-\d{2}|D-\d{3})\b/gi) || []),
      ...(act.Name.match(/\b\d+["']-[\w-]+/g) || []),
    ];

    const allEventTags = [...(event.tagIds || []), ...tags];
    for (const eTag of allEventTags) {
      const cleanETag = eTag.toLowerCase().replace(/["\s]/g, '');
      for (const aTag of actTags) {
        const cleanATag = aTag.toLowerCase().replace(/["\s]/g, '');
        if (cleanETag === cleanATag || cleanETag.includes(cleanATag) || cleanATag.includes(cleanETag)) {
          tagMatch = 100;
          break;
        }
      }
      if (tagMatch === 100) break;
      if (act.Name.toLowerCase().includes(eTag.toLowerCase())) {
        tagMatch = 90;
        break;
      }
    }

    // b. Text Similarity (30% weight)
    const textSimRaw = tokenSetSimilarity(expanded, act.Name);
    const descSim = tokenSetSimilarity(event.activityDescription, act.Name);
    const textMatch = Math.min(100, Math.round(Math.max(textSimRaw, descSim * 1.1)));

    // c. Discipline & Area Match (20% weight)
    let discAreaScore = 30;
    if (act.Discipline.toLowerCase() === event.discipline.toLowerCase()) {
      discAreaScore += 45;
    }
    if (
      event.location &&
      (act.Area.toLowerCase().includes(event.location.toLowerCase()) ||
        event.location.toLowerCase().includes(act.Area.toLowerCase()))
    ) {
      discAreaScore += 25;
    }
    const disciplineAreaMatch = Math.min(100, discAreaScore);

    // d. Semantic Estimate (15% weight)
    let semanticScore = Math.round((textMatch * 0.6 + disciplineAreaMatch * 0.4));
    if (tagMatch > 80 && textMatch > 40) semanticScore = Math.min(100, semanticScore + 15);

    // Weighted composite
    let compositeScore = Math.round(
      0.35 * tagMatch + 0.30 * textMatch + 0.20 * disciplineAreaMatch + 0.15 * semanticScore
    );

    // If tag matches strongly and discipline matches, boost confidence
    if (tagMatch >= 90 && act.Discipline.toLowerCase() === event.discipline.toLowerCase()) {
      compositeScore = Math.max(compositeScore, 86);
    }

    let reason = '';
    if (tagMatch >= 90) {
      reason = `Strong tag match with ${act.TaggedEquipment?.join(', ') || 'equipment identifier'} in ${act.Discipline}.`;
    } else if (textMatch > 70) {
      reason = `High lexical and synonym overlap in ${act.Discipline}.`;
    } else {
      reason = `Partial keyword match (${compositeScore}%). Requires planner review.`;
    }

    return {
      activityId: act.ActivityID,
      activityName: act.Name,
      discipline: act.Discipline,
      area: act.Area,
      score: compositeScore,
      tagMatch,
      textMatch,
      disciplineAreaMatch,
      semanticMatch: semanticScore,
      reason,
    };
  });

  // Sort descending by score
  candidateScores.sort((a, b) => b.score - a.score);
  const topCandidates = candidateScores.slice(0, 5);
  const bestCandidate = topCandidates[0];

  let finalConfidence = bestCandidate ? bestCandidate.score : 0;
  let finalMatchActivity = bestCandidate ? activities.find((a) => a.ActivityID === bestCandidate.activityId) || null : null;
  let finalReasoning = bestCandidate ? bestCandidate.reason : 'No matching activities found.';
  let scoreBreakdown = bestCandidate
    ? {
        tagMatch: bestCandidate.tagMatch,
        textSimilarity: bestCandidate.textMatch,
        disciplineAreaMatch: bestCandidate.disciplineAreaMatch,
        semanticScore: bestCandidate.semanticMatch,
        reasoning: finalReasoning,
      }
    : {
        tagMatch: 0,
        textSimilarity: 0,
        disciplineAreaMatch: 0,
        semanticScore: 0,
        reasoning: 'No suitable candidate found.',
      };

  // 3. LLM Re-Ranker (if enabled and candidates exist)
  if (useLlmReRanker && topCandidates.length > 0 && finalConfidence >= 40 && finalConfidence < 92) {
    try {
      const res = await fetch('/api/rerank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event,
          candidates: topCandidates.map((c) => activities.find((a) => a.ActivityID === c.activityId)).filter(Boolean),
        }),
      });

      if (res.ok) {
        const rerankData = await res.json();
        if (rerankData.bestCandidateId && rerankData.bestCandidateId !== 'none') {
          const matched = activities.find((a) => a.ActivityID === rerankData.bestCandidateId);
          if (matched) {
            finalMatchActivity = matched;
            finalConfidence = rerankData.confidenceScore || finalConfidence;
            finalReasoning = rerankData.reasoning || finalReasoning;
            if (rerankData.breakdown) {
              scoreBreakdown = {
                tagMatch: rerankData.breakdown.tagMatch,
                textSimilarity: rerankData.breakdown.textMatch,
                disciplineAreaMatch: rerankData.breakdown.disciplineAreaMatch,
                semanticScore: rerankData.breakdown.semanticMatch,
                reasoning: finalReasoning,
              };
            }
          }
        }
      }
    } catch {
      // Fallback cleanly to deterministic scores
    }
  }

  // 4. Routing threshold logic
  let routing: 'AUTO_COMMITTED' | 'NEEDS_APPROVAL' | 'REVIEW_INBOX' | 'NEW_ACTIVITY';
  if (finalConfidence >= 85) {
    routing = 'AUTO_COMMITTED';
  } else if (finalConfidence >= 60) {
    routing = 'NEEDS_APPROVAL';
  } else {
    routing = 'REVIEW_INBOX';
  }

  return {
    bestMatch: finalMatchActivity,
    confidence: finalConfidence,
    routing,
    topCandidates: topCandidates.slice(0, 3),
    matchScores: scoreBreakdown,
  };
}
