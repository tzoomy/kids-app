export interface GameRule {
  id: string;
  /** Repo-relative path patterns (matched against forward-slash paths). */
  match: RegExp[];
  specs: string[];
}
export declare const SMOKE_SPECS: string[];
export declare const GAME_RULES: GameRule[];
export declare function parseChangedFiles(text: string): string[];
export declare function listSpecs(root: string): string[];
export declare function selectAffectedE2eOrSmokeOnDiffFailure(opts: {
  base?: string;
  head?: string;
  /** Returns `git diff --name-only <range>` output; may throw. */
  diff: (range: string) => string;
  existingSpecs?: string[];
}): { changed: string[]; specs: string[]; warning: string | null };
export declare function selectAffectedE2e(changedFiles: string[], existingSpecs?: string[]): string[];
export declare function parseArgs(argv: string[]): {
  base: string | null;
  head: string;
  files: string[] | null;
  githubOutput: boolean;
};
