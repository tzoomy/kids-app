export interface Criterion {
  id: string;
  struck: boolean;
  pass: number | null;
  methods: string[];
}
export declare const AUTOMATED_METHODS: string[];
export declare const KNOWN_METHODS: string[];
export declare function parsePassInProgress(markdown: string): number | null;
export declare function parseAcceptanceCriteria(markdown: string): { criteria: Criterion[]; errors: string[] };
export declare function extractTestTitles(source: string): string[];
export declare function testFileBelongsToGame(relPath: string, gameId: string): boolean;
export declare function checkCoverage(
  specs: Array<{ gameId: string; markdown: string }>,
  testFiles: Array<{ path: string; source: string }>,
): { problems: string[]; checked: number };
export declare function loadRepo(root: string): {
  specs: Array<{ gameId: string; markdown: string }>;
  testFiles: Array<{ path: string; source: string }>;
};
