import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// JSON.parse silently keeps the last of two equal keys, so a merge that keeps both sides can hide a duplicate
// (here: gamePicker.sortingBeds and gamePicker.whoIsHiding after merging main into the station trail branch).

/** Dotted paths of object keys that appear twice in the same object of a JSON text. */
function duplicateKeys(text: string): string[] {
  const dups: string[] = [];
  const stack: { keys: Set<string> | null; name: string }[] = [];
  let pendingKey = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      const str = text.slice(i + 1, j);
      let k = j + 1;
      while (/\s/.test(text[k] ?? '')) k++;
      const top = stack[stack.length - 1];
      if (text[k] === ':' && top?.keys) {
        if (top.keys.has(str)) dups.push(`${[...stack.map((s) => s.name).filter(Boolean), str].join('.')}`);
        top.keys.add(str);
        pendingKey = str;
      }
      i = j;
    } else if (c === '{') stack.push({ keys: new Set(), name: pendingKey });
    else if (c === '[') stack.push({ keys: null, name: pendingKey });
    else if (c === '}' || c === ']') stack.pop();
  }
  return dups;
}

describe('he.json', () => {
  it('the duplicate-key detector finds a repeated key in the same object only', () => {
    expect(duplicateKeys('{"a":{"x":1,"x":2},"b":{"x":3},"c":[{"y":1},{"y":2}]}')).toEqual(['a.x']);
    expect(duplicateKeys('{"a":"x","b":"x"}')).toEqual([]);
  });

  it('has no duplicate keys (gamePicker.sortingBeds and gamePicker.whoIsHiding exist once)', () => {
    const text = fs.readFileSync(path.join('src', 'content', 'i18n', 'he.json'), 'utf8');
    expect(duplicateKeys(text)).toEqual([]);
  });
});
