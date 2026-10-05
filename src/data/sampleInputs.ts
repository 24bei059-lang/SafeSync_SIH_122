export interface SampleInput {
  id: string;
  name: string;
  format: 'text' | 'csv' | 'ocr_snippet' | 'diary_image';
  description: string;
  documentName: string;
  reportDate: string;
  content: string;
  imageBase64?: string;
}

// SVG canvas simulated site diary image converted to data URL
const createDiarySvgDataUrl = () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" style="background:#f7f4ea;font-family:monospace;font-size:14px;color:#1e293b;">
    <defs>
      <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2d9c2" stroke-width="0.7"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="#fbf9f1"/>
    <rect width="100%" height="100%" fill="url(#grid)"/>
    <!-- Diary Header -->
    <rect x="30" y="25" width="740" height="55" fill="#ebe4d0" stroke="#b8ab90" rx="4"/>
    <text x="45" y="48" font-size="16" font-weight="bold" fill="#0f172a">PETROCHEM EPC PACKAGE-4 // DAILY SITE DIARY &amp; SHIFT LOG</text>
    <text x="45" y="68" font-size="12" fill="#475569">DATE: 2026-10-04 | AREA: UNIT 100 / PR-02 | SUPERVISOR: K. RAJESH | WEATHER: 37°C CLEAR</text>

    <!-- Stamp -->
    <circle cx="700" cy="52" r="22" fill="none" stroke="#dc2626" stroke-width="2" stroke-dasharray="4 2"/>
    <text x="680" y="56" font-size="10" font-weight="bold" fill="#dc2626" transform="rotate(-15 700 52)">VERIFIED</text>

    <!-- Handwritten notes simulation -->
    <g font-family="'Courier New', monospace" fill="#1e3a8a">
      <text x="45" y="115" font-size="15" font-weight="bold">1. CIVIL WORKS - FOUNDATIONS:</text>
      <text x="65" y="140">• Pump P-101 foundation PCC casting 18 m3 completed 100% at 11:30 hrs.</text>
      <text x="65" y="165">• Shuttering stripped for P-102 pedestal, no honeycombing observed.</text>
      <text x="65" y="190">• Raft rebar tying for Compressor C-201 pedestal started with 6 barbenders.</text>

      <text x="45" y="230" font-size="15" font-weight="bold">2. PIPING &amp; MECHANICAL ERECTION:</text>
      <text x="65" y="255">• 24" line spool (Line 24"-PR-1042) erected near pump area - 6 spools of 14 erected.</text>
      <text x="65" y="280">• Crane-2 demobbed to heavy lift yard at 16:00 hrs.</text>
      <text x="65" y="305">• Hydrotest Line 12"-HC-2001 DELAYED - blind flanges missing in warehouse.</text>

      <text x="45" y="345" font-size="15" font-weight="bold">3. ELECTRICAL &amp; INSTRUMENTATION:</text>
      <text x="65" y="370">• Cable tray installation Unit 2 commenced today: 120 LM completed vs 350 LM scope.</text>
      <text x="65" y="395">• Loop check on PT-104 pressure transmitter started with DCS console engineer.</text>
      <text x="65" y="420">• Control valve FV-102 bench calibration completed in field instrument workshop.</text>

      <text x="45" y="460" font-size="15" font-weight="bold">4. HSE &amp; PERMITS TO WORK:</text>
      <text x="65" y="485">• Confined space gas test conducted in Column T-101 before tray crew entered (0% LEL).</text>
      <text x="65" y="510">• Tool box talk conducted for 42 workers at 07:15 AM regarding hydration &amp; pinch points.</text>
    </g>

    <!-- Footer Signatures -->
    <line x1="45" y1="550" x2="350" y2="550" stroke="#64748b" stroke-width="1"/>
    <text x="45" y="568" font-size="11" fill="#64748b">Resident Site Engineer Sign / Date</text>

    <line x1="450" y1="550" x2="740" y2="550" stroke="#64748b" stroke-width="1"/>
    <text x="450" y="568" font-size="11" fill="#64748b">Quality Assurance Inspector Stamp</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const SAMPLE_INPUTS: SampleInput[] = [
  {
    id: 'sample-1',
    name: 'Sample 1: Messy Field Report (Hinglish + Abbreviations)',
    format: 'text',
    description: 'Real-world daily field log mixing abbreviations (PCC, RT, LM), site tags, and delay notes.',
    documentName: 'DPR_Unit100_2026-10-04.txt',
    reportDate: '2026-10-04',
    content: `SITE DAILY EXECUTION LOG - 2026-10-04
Site: Petrochem EPC Unit 100 & Pipe Rack PR-02
Weather: 38C clear sky, high afternoon wind
Shift: Day (07:00 - 18:30)

1. Civil team update: Foundation PCC poured for pump P-101 today morning. Approx 18 m3 poured out of 18 m3 target, 100% complete, cube samples taken. Formwork stripped on P-102 pedestal, finishing ok. Stormwater trench precast work continuing slowly, only 15 LM laid.

2. Piping discipline: 24in line spool erected near pump area (Line 24"-PR-1042). 6 spools of 14 done by riggers gang today. Crane was idle for 1 hr due to rigging sling check. Par hydrotest pending line 12"-HC-2001 due to blind shortage from warehouse. Subcon bolting gang not available for flange torque tightening.

3. Electrical crew: Unit 2 cable tray installation commenced, 120 LM completed today vs 350 LM total scope. Bracket welding delayed 2 hrs due to power tripping at DB-4.

4. Rotating Equipment: Lube oil flushing ongoing for gas compressor C-201, day 2 completed. Filter differential pressure within limit.

5. Instrumentation: Control valve FV-102 bench calibration done, moved to site. Loop check PT-104 started, 4 loops verified with DCS room.

6. HSE: Confined space continuous gas testing done inside T-101 crude column before tray installation crew entered. Zero LEL recorded, permit approved.`,
  },
  {
    id: 'sample-2',
    name: 'Sample 2: Civil Discipline CSV (Mismatched Columns)',
    format: 'csv',
    description: 'Subcontractor spreadsheet with non-standard column headers (Site Ref, Work Package Desc, Exec Qty).',
    documentName: 'Civil_Daily_Subcon_Export_04Oct.csv',
    reportDate: '2026-10-04',
    content: `Site Ref,Discipline Code,Work Package Desc,Execution Date,Qty Executed,Planned Scope,Unit,Crew Count,Hold Blocker Reason
CIV-SITE-081,CIVIL,PCC casting pump P101 foundation,2026-10-04,18,18,M3,8,None - Ready for pedestal
CIV-SITE-082,CIVIL,Pedestal rebar tying pump P-102,2026-10-04,1.4,2.8,MT,6,Rebar delivery delayed 2 hrs
CIV-SITE-083,CIVIL,Backfilling road crossing pipe trench,2026-10-03,45,150,M3,4,Compactor breakdown 3 hrs
CIV-SITE-084,CIVIL,Paving concrete pour Substation SS-01,2026-10-02,35,70,M2,10,Rain stoppage 40 mins
CIV-SITE-085,CIVIL,Compressor C-201 pedestal anchor bolts alignment,2026-10-04,8,8,Ea,5,None - Checked with total station`,
  },
  {
    id: 'sample-3',
    name: 'Sample 3: Site Diary OCR Snippet (Typo Simulation)',
    format: 'ocr_snippet',
    description: 'Simulated noisy OCR scan with common character misrecognitions (4 for A, 0 for O, missing letters).',
    documentName: 'OCR_Diary_Scan_PR02_Shift2.txt',
    reportDate: '2026-10-04',
    content: `SITE DI4RY - 04/10/2026 [SC4NNED COURIER SITE LOG]
Loc: PR-02 & Unit 200 Gas Comp
Eng: K. Sharma / Supv: J. Roy

- 12"-HC-2001 hydr0test delyed, lack of wtr filling conn and blinds not rcvd from warehouse store.
- P-101 bseplate gr0uting started at 14:00 hrs, non-shrnk grout applied 100%.
- cabl tray instaltion unit 2 comenced, progress 120 lm done vs 350 total.
- Line 24"-PR-1042 spool fitup & erctn: 6 of 14 spools placed on pipe rack tier 1.
- New unplnd actvty: Fabricate temporary stormwtr sump near compressor pad to avoid rainwater seepage during monsoon.`,
  },
  {
    id: 'sample-4',
    name: 'Sample 4: Scanned Diary Photo (Multimodal OCR Scan)',
    format: 'diary_image',
    description: 'High-contrast scanned site diary sheet with stamps, signatures, and multi-discipline bullet notes.',
    documentName: 'Scanned_Diary_Page_104.png',
    reportDate: '2026-10-04',
    content: '[Simulated scanned site diary document loaded. Click "Extract with Gemini Multimodal" to run AI OCR and structured extraction.]',
    imageBase64: createDiarySvgDataUrl(),
  },
];
