export interface ClusterSummary {
  mode: 'clusters';
  answerCount: number;
  themes: {
    title: string;
    description: string;
    count: number;
    quotes: { text: string; pid: string | null }[];
    /** respondents assigned to the theme (used e.g. for the use-case map) */
    pids?: string[];
    /** theme lies outside the target's starting hypotheses */
    novel?: boolean;
  }[];
  keyStatements: string[];
}

/** Short answers (e.g. "one word about AI") condensed to canonical 1–2-word terms for the word cloud. */
export interface TermsSummary {
  mode: 'terms';
  answerCount: number;
  terms: { text: string; count: number }[];
}

export interface SynthesisSummary {
  mode: 'synthesis';
  headline: string;
  findings: { title: string; text: string }[];
  implications: { title: string; text: string }[];
  openQuestions: string[];
}

export type AiSummary = ClusterSummary | TermsSummary | SynthesisSummary;

export interface StoredSummary {
  content: AiSummary;
  edited: boolean;
  generatedAt: string;
  model: string;
}

// ---------- Chat about the survey ----------

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatSource {
  /** answer reference as shown to the model, e.g. "R03·H3" */
  ref: string;
  question: string;
  /** respondent group, never a name, e.g. "Führung · HumanTech Spine · Qualitätsmanagement" */
  group: string;
  quote: string;
}

export interface ChatReply {
  answer: string;
  /** full: completely answerable from the survey · partial: only partly · none: not answerable */
  coverage: 'full' | 'partial' | 'none';
  questionsUsed: { id: string; short: string }[];
  sources: ChatSource[];
  /** quotes the model gave that could not be found word for word in the answers (removed) */
  droppedQuotes: number;
}
