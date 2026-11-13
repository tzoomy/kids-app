export interface GameRule {
  id: string;
  /** Repo-relative path patterns (matched against forward-slash paths). */
  match: RegExp[];
  specs: string[];
}
export declare const SMOKE_SPECS: string[];
export declare const GAME_RULES: GameRule[];
export declare function parseChangedFiles(text: string): string[];
export declare function selectAffectedE2e(changedFiles: string[], existingSpecs?: string[]): string[];
