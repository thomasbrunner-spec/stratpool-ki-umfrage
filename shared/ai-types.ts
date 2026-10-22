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
  }[];
  keyStatements: string[];
}

export interface SynthesisSummary {
  mode: 'synthesis';
  headline: string;
  findings: { title: string; text: string }[];
  implications: { title: string; text: string }[];
  openQuestions: string[];
}

export type AiSummary = ClusterSummary | SynthesisSummary;

export interface StoredSummary {
  content: AiSummary;
  edited: boolean;
  generatedAt: string;
  model: string;
}
