export type DecisionEntry = {
  id: number;
  move: string;
  confidence: number;
  probabilities: Record<string, number>;
  score: number;
  highest: number;
  model: string;
  latencyMs: number;
};
