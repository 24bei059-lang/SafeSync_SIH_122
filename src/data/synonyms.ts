export interface SynonymEntry {
  term: string;
  discipline: string;
  synonyms: string[];
}

export const DISCIPLINE_SYNONYMS: SynonymEntry[] = [
  {
    term: 'PCC',
    discipline: 'Civil',
    synonyms: ['plain cement concrete', 'blinding concrete', 'lean concrete', 'mud mat', 'sub-base concrete', 'blinding'],
  },
  {
    term: 'RCC',
    discipline: 'Civil',
    synonyms: ['reinforced cement concrete', 'structural concrete', 'rebar concrete', 'cast-in-place concrete', 'raft concrete'],
  },
  {
    term: 'Pedestal',
    discipline: 'Civil',
    synonyms: ['equipment plinth', 'concrete pier', 'foundation upstand', 'pump pier', 'anchor pedestal'],
  },
  {
    term: 'Spool',
    discipline: 'Piping',
    synonyms: ['pipe spool', 'prefabricated spool', 'isometric spool', 'pipe section', 'piping spool', 'line spool'],
  },
  {
    term: 'Erected',
    discipline: 'Piping',
    synonyms: ['erection', 'rigged', 'placed on rack', 'hung', 'lifted into position', 'installed', 'slung'],
  },
  {
    term: 'Hydrotest',
    discipline: 'Piping',
    synonyms: ['hydro test', 'hydrostatic test', 'pressure test', 'water test', 'strength test', 'leak test'],
  },
  {
    term: 'Fit-up',
    discipline: 'Piping',
    synonyms: ['fitup', 'tack welding', 'bevel alignment', 'joint preparation', 'pipe fit'],
  },
  {
    term: 'RT / NDT',
    discipline: 'Piping',
    synonyms: ['radiography', 'radiographic testing', 'x-ray test', 'non-destructive testing', 'gamma ray inspection'],
  },
  {
    term: 'Baseplate Grouting',
    discipline: 'Rotating Equipment',
    synonyms: ['bseplate gr0uting', 'grout pour', 'non-shrink grout', 'chockfast', 'epoxy grout', 'soleplate grout'],
  },
  {
    term: 'Alignment',
    discipline: 'Rotating Equipment',
    synonyms: ['laser alignment', 'dial indicator alignment', 'coupling alignment', 'shaft alignment', 'rim and face check'],
  },
  {
    term: 'Lube Oil Flushing',
    discipline: 'Rotating Equipment',
    synonyms: ['oil circulation', 'flushing loop', 'degreasing run', 'oil particulate test'],
  },
  {
    term: 'Cable Tray',
    discipline: 'Electrical',
    synonyms: ['cabl tray', 'ladder tray', 'perforated tray', 'wireway', 'raceway', 'cable trunking'],
  },
  {
    term: 'Cable Pulling',
    discipline: 'Electrical',
    synonyms: ['cable haul', 'cable laying', 'cable winching', 'power cable run'],
  },
  {
    term: 'Switchgear',
    discipline: 'Electrical',
    synonyms: ['swg', '11kv board', 'distribution board', 'breaker panel', 'mcc panel'],
  },
  {
    term: 'Loop Check',
    discipline: 'Instrumentation',
    synonyms: ['loop test', 'cold loop check', 'hot loop check', 'dcs loop verification', 'signal continuity check'],
  },
  {
    term: 'Bench Calibration',
    discipline: 'Instrumentation',
    synonyms: ['shop calibration', 'valve stroking', 'transmitter zero/span', 'workshop test'],
  },
  {
    term: 'Gas Test',
    discipline: 'HSE',
    synonyms: ['atmospheric test', 'lel test', 'oxygen measurement', 'gas monitoring', 'confined space test'],
  },
];
