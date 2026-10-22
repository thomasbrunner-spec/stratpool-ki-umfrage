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
}

export interface Scale {
  levels: ScaleLevel[];
  /** Brackets drawn under a stairs scale, e.g. "Betriebsmodell 1.0" */
  brackets?: { from: number; to: number; label: string }[];
}

interface QuestionBase {
  id: string;
  block: string;
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
  /** One description per scale level, same order as scale.levels */
  descriptions: string[];
}

export interface GridQuestion extends QuestionBase {
  type: 'grid';
  scale: string;
  rows: GridRow[];
  naLabel: string;
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
  | PointsQuestion;

export type QuestionType = Question['type'];

export interface Block {
  id: string;
  title: string;
}

export type Widget =
  | { kind: 'question'; q: string }
  | { kind: 'compare_stairs'; today: string; target: string }
  | { kind: 'depth'; q: string }
  | { kind: 'self_vs_depth'; self: string; depth: string }
  | { kind: 'matrix'; x: string; y: string; xLabel: string; yLabel: string; quadrants: [string, string, string, string] }
  | { kind: 'ai'; key: string }
  | { kind: 'participation' };

export interface DeckSlide {
  id: string;
  eyebrow: string;
  title: string;
  widgets: Widget[];
}

/** AI summary targets: free-text questions or the overall synthesis */
export interface AiTarget {
  key: string;
  label: string;
  /** Questions whose texts are summarised; empty for the synthesis */
  questions: string[];
  mode: 'clusters' | 'synthesis';
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

export type AnswerValue =
  | string // short_text, long_text, single
  | string[] // text_list
  | number // slider, stairs
  | MultiAnswer // multi
  | Record<string, number | null> // grid (null = cannot judge), points
  ;

export type AnswerMap = Record<string, AnswerValue>;

export interface ParticipantInfo {
  id: string;
  name: string;
  company: string;
  func: string;
  workshop: boolean;
}

export interface ResultFilter {
  company?: string;
  func?: string;
  workshop?: boolean;
}
