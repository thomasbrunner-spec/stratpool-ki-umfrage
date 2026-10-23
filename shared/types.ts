// Survey definition (survey/*.json) and answer/result types shared by server and client.

export interface Option {
  id: string;
  label: string;
  /** Group id for grouped multi-choice (e.g. usage depth level) */
  group?: string;
  /** Selecting this option deselects all others (e.g. "keine") */
  exclusive?: boolean;
  /** Option carries an additional free-text field ("Sonstiges") */
  other?: boolean;
}

export interface OptionGroup {
  id: string;
  label: string;
  /** Ordinal depth used for "highest level reached" analyses */
  level: number;
}

export interface ScaleLevel {
  value: number;
  title: string;
  description: string;
  /** Optional explanation shown to participants below the description */
  hint?: string;
  /** Semantic colour for traffic-light scales */
  tone?: 'good' | 'warn' | 'bad';
}

export interface Scale {
  levels: ScaleLevel[];
  /** Brackets drawn under a stairs scale, e.g. "Betriebsmodell 1.0" */
  brackets?: { from: number; to: number; label: string }[];
}

/** Question is only shown if question `q` has one of these options selected */
export interface ShowIf {
  q: string;
  anyOf: string[];
}

interface QuestionBase {
  id: string;
  block: string;
  showIf?: ShowIf;
  title: string;
  /** Alternative title for participants who do not attend the workshop */
  titleNonWorkshop?: string;
  help?: string;
  required: boolean;
  /** Short label for dashboards, exports and slides */
  short: string;
}

export interface ShortTextQuestion extends QuestionBase {
  type: 'short_text';
  maxLength: number;
  viz: 'wordcloud' | 'wall';
}

export interface LongTextQuestion extends QuestionBase {
  type: 'long_text';
  maxLength: number;
}

export interface TextListQuestion extends QuestionBase {
  type: 'text_list';
  fields: number;
  requiredFields: number;
  maxLength: number;
  placeholder?: string;
}

export interface SingleQuestion extends QuestionBase {
  type: 'single';
  options: Option[];
}

export interface MultiQuestion extends QuestionBase {
  type: 'multi';
  options: Option[];
  groups?: OptionGroup[];
  max?: number;
}

export interface SliderQuestion extends QuestionBase {
  type: 'slider';
  min: number;
  max: number;
  step: number;
  minLabel: string;
  maxLabel: string;
  unit?: string;
  viz: 'dots' | 'gauge';
}

export interface StairsQuestion extends QuestionBase {
  type: 'stairs';
  scale: string;
}

export interface GridRow {
  id: string;
  label: string;
  /** One description per scale level, same order as scale.levels (optional for traffic lights) */
  descriptions?: string[];
}

export interface GridQuestion extends QuestionBase {
  type: 'grid';
  scale: string;
  rows: GridRow[];
  naLabel: string;
  viz: 'profile' | 'ampel';
}

/** One maturity dimension, rated for today and for the target in three years */
export interface MaturityQuestion extends QuestionBase {
  type: 'maturity';
  scale: string;
  dimension: string;
  anchor: string;
  /** One description per scale level */
  descriptions: string[];
  naLabel: string;
}

export interface DataOption {
  id: string;
  label: string;
  /** Sensitivity 1 (public) … 5 (patient data); null = unknown */
  level: number | null;
}

/** Use-case profile: task, weekly hours, most sensitive data involved */
export interface UseCaseQuestion extends QuestionBase {
  type: 'usecase';
  maxLength: number;
  placeholder?: string;
  hoursLabel: string;
  hoursMax: number;
  hoursStep: number;
  dataLabel: string;
  dataOptions: DataOption[];
}

export interface PointsQuestion extends QuestionBase {
  type: 'points';
  budget: number;
  options: Option[];
}

export type Question =
  | ShortTextQuestion
  | LongTextQuestion
  | TextListQuestion
  | SingleQuestion
  | MultiQuestion
  | SliderQuestion
  | StairsQuestion
  | GridQuestion
  | MaturityQuestion
  | UseCaseQuestion
  | PointsQuestion;

export type QuestionType = Question['type'];

export interface Block {
  id: string;
  title: string;
  /** Shown above the first question of the block */
  intro?: string;
}

export type Widget =
  | { kind: 'question'; q: string }
  | { kind: 'depth'; q: string }
  | { kind: 'self_vs_depth'; self: string; depth: string }
  | { kind: 'matrix'; x: string; y: string; xLabel: string; yLabel: string; quadrants: [string, string, string, string] }
  | { kind: 'ai'; key: string }
  | { kind: 'participation' }
  /** Radar over maturity questions; 'build' reveals the target layer on the next key press */
  | { kind: 'cobweb'; qs: string[]; show: 'now' | 'both' | 'build' }
  /** Radar comparing groups: leadership vs. team (default) or one layer per company */
  | { kind: 'cobweb_split'; qs: string[]; by?: 'leader' | 'company' }
  | { kind: 'gaps'; qs: string[] }
  | { kind: 'blindspots'; qs: string[] }
  /** Big number: share of respondents who chose any of `options` */
  | { kind: 'hero'; q: string; options: string[]; text: string }
  /** Big number: weekly hours summed up and converted to full-time equivalents */
  | { kind: 'hero_fte'; q: string; hoursPerFte: number }
  | { kind: 'usecase_map'; q: string; ai: string }
  | { kind: 'pilots'; q: string; yes: string[] };

export interface DeckSlide {
  id: string;
  eyebrow: string;
  title: string;
  widgets: Widget[];
  /** Number of build steps (default 1) */
  steps?: number;
}

/** AI summary targets: free-text questions or the overall synthesis */
export interface AiTarget {
  key: string;
  label: string;
  /** Questions whose texts are summarised; empty for the synthesis */
  questions: string[];
  mode: 'clusters' | 'synthesis';
  /** Starting hypotheses (e.g. from the offer); themes outside them get flagged as new */
  hypotheses?: string[];
}

export interface SurveyDefinition {
  id: string;
  version: string;
  title: string;
  intro: { title: string; text: string; note: string };
  outro: { title: string; text: string };
  functions: string[];
  blocks: Block[];
  scales: Record<string, Scale>;
  questions: Question[];
  aiTargets: AiTarget[];
  deck: DeckSlide[];
}

// ---------- Answers ----------

export interface MultiAnswer {
  selected: string[];
  other?: string;
}

export interface MaturityAnswer {
  /** null = cannot judge */
  now: number | null;
  target?: number | null;
}

export interface UseCaseAnswer {
  task: string;
  hours: number | null;
  data: string | null;
}

export type AnswerValue =
  | string // short_text, long_text, single
  | string[] // text_list
  | number // slider, stairs
  | MultiAnswer // multi
  | MaturityAnswer // maturity
  | UseCaseAnswer // usecase
  | Record<string, number | null> // grid (null = cannot judge), points
  ;

export type AnswerMap = Record<string, AnswerValue>;

export interface ParticipantInfo {
  id: string;
  name: string;
  company: string;
  func: string;
  workshop: boolean;
  /** Management (GF) or head of department (AL) – used for the leadership vs. team comparison */
  leader?: boolean;
}

export interface ResultFilter {
  company?: string;
  func?: string;
  workshop?: boolean;
}
