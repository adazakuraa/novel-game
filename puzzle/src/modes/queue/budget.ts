/** 探索量の上限を超えた（その候補は採用しない） */
export class SolverBudgetError extends Error {
  constructor() { super('solver budget exceeded'); }
}
