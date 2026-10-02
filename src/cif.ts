// Copyright (c) 2013-2015 Marco Biasini
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
// DEALINGS IN THE SOFTWARE.

// A small, dependency-free mmCIF/STAR tokenizer and document model. This
// module only knows about CIF *syntax* (loop_ tables, quoted/unquoted
// values, ;-delimited multi-line text fields); it has no notion of what an
// _atom_site or _pdbx_struct_assembly_gen row means -- that's io.ts's job.
//
// CIF tags are case-insensitive per spec, so category and item names are
// normalized to lowercase everywhere in this module's API: callers must
// query with lowercase category/item names (e.g. `getValue('cell', 'length_a')`,
// `row.get('cartn_x')`), regardless of how the source file capitalized them.

type TokenType = 'tag' | 'value' | 'loop' | 'data';

// splits the raw text into a stream of tokens. A stream, rather than
// line-by-line, because loop_ values may wrap across lines and ;-delimited
// text fields are inherently multi-line -- neither can be parsed assuming
// one row per line. Tokens are read one at a time with next(), so that the
// tokens of a large file (some 50 million for a 2.4 million atom structure)
// never all exist at once.
class Tokenizer {
  // the current token, valid after next() returned true. The type is read
  // with type(), so that TypeScript doesn't narrow it across next() calls.
  text = '';
  private _type: TokenType = 'value';
  private _text: string;
  private _i = 0;

  constructor(text: string) {
    this._text = text;
  }

  private _set(type: TokenType, text: string): true {
    this._type = type;
    this.text = text;
    return true;
  }

  type(): TokenType {
    return this._type;
  }

  // advances to the next token; false at the end of the text.
  next(): boolean {
    const text = this._text;
    const n = text.length;
    let i = this._i;

    const atLineStart = (pos: number): boolean => pos === 0 || text[pos - 1] === '\n';

    while (i < n) {
      const c = text[i]!;

      // whitespace
      if (c === ' ' || c === '\t' || c === '\r' || c === '\n') {
        i++;
        continue;
      }

      // comment: runs to end of line
      if (c === '#') {
        while (i < n && text[i] !== '\n') {
          i++;
        }
        continue;
      }

      // ;-delimited multi-line text field: only recognized at the start of a
      // line (a ';' elsewhere is just a regular character in a bare value).
      if (c === ';' && atLineStart(i)) {
        let end = i + 1;
        let value = '';
        for (;;) {
          const lineEnd = text.indexOf('\n', end);
          const line = lineEnd === -1 ? text.substring(end) : text.substring(end, lineEnd);
          if (line.startsWith(';')) {
            // terminator line: everything after the leading ';' is discarded
            // per the CIF spec (it's only ever whitespace in practice).
            i = lineEnd === -1 ? n : lineEnd + 1;
            break;
          }
          value += (value.length ? '\n' : '') + line;
          if (lineEnd === -1) {
            i = n;
            break;
          }
          end = lineEnd + 1;
        }
        this._i = i;
        return this._set('value', value);
      }

      // quoted value: closed by the same quote character followed by
      // whitespace/EOL/EOF -- this is what allows unquoted atom names like
      // O5' to coexist with quoted values like "O5' water".
      if (c === '\'' || c === '"') {
        const quote = c;
        let j = i + 1;
        for (;;) {
          const close = text.indexOf(quote, j);
          if (close === -1) {
            j = n;
            break;
          }
          const after = text[close + 1];
          if (after === undefined || after === ' ' || after === '\t' ||
              after === '\r' || after === '\n') {
            j = close;
            break;
          }
          j = close + 1;
        }
        this._i = j + 1;
        return this._set('value', text.substring(i + 1, j));
      }

      // bare token: runs to the next whitespace character.
      let j = i;
      while (j < n) {
        const cj = text[j]!;
        if (cj === ' ' || cj === '\t' || cj === '\r' || cj === '\n') {
          break;
        }
        j++;
      }
      const word = text.substring(i, j);
      this._i = j;

      // only lowercase the few words that can be keywords, not every value
      const first = word[0];
      if ((first === 'l' || first === 'L') && word.toLowerCase() === 'loop_') {
        return this._set('loop', word);
      }
      if ((first === 'd' || first === 'D') && word.substring(0, 5).toLowerCase() === 'data_') {
        return this._set('data', word);
      }
      return this._set(first === '_' ? 'tag' : 'value', word);
    }
    this._i = n;
    return false;
  }
}

function splitTag(tag: string): [category: string, item: string] {
  const dot = tag.indexOf('.');
  if (dot === -1) {
    return [tag.substring(1).toLowerCase(), ''];
  }
  return [tag.substring(1, dot).toLowerCase(), tag.substring(dot + 1).toLowerCase()];
}

export interface CIFRow {
  // returns the raw column value, or undefined if the column doesn't exist
  // in this loop. Note this returns CIF's literal '.' (inapplicable) and
  // '?' (unknown) placeholders as-is -- their meaning is field-specific, so
  // interpreting them is left to the caller.
  get(item: string): string | undefined;
  // like get(), but parses the value as a float; returns undefined for a
  // missing column, '.', '?', or anything else that doesn't parse.
  getNumber(item: string): number | undefined;
}

// one row of a loop, looked up through the loop's column index
class Row implements CIFRow {
  _columnIndex: Map<string, number>;
  _values: string[];

  constructor(columnIndex: Map<string, number>, values: string[]) {
    this._columnIndex = columnIndex;
    this._values = values;
  }

  get(item: string): string | undefined {
    const idx = this._columnIndex.get(item);
    return idx === undefined ? undefined : this._values[idx];
  }

  getNumber(item: string): number | undefined {
    const idx = this._columnIndex.get(item);
    if (idx === undefined) {
      return undefined;
    }
    const raw = this._values[idx]!;
    if (raw === '.' || raw === '?') {
      return undefined;
    }
    const num = parseFloat(raw);
    return isNaN(num) ? undefined : num;
  }
}

function indexColumns(columns: string[]): Map<string, number> {
  const columnIndex = new Map<string, number>();
  for (let i = 0; i < columns.length; ++i) {
    columnIndex.set(columns[i]!, i);
  }
  return columnIndex;
}

class Loop {
  private _columnIndex: Map<string, number>;
  private _rows: string[][];

  constructor(columnIndex: Map<string, number>, rows: string[][]) {
    this._columnIndex = columnIndex;
    this._rows = rows;
  }

  get length(): number {
    return this._rows.length;
  }

  row(index: number): CIFRow {
    return new Row(this._columnIndex, this._rows[index]!);
  }
}

export interface CIFDocument {
  // returns the single value associated with `_category.item`, or
  // undefined if no such key-value pair (or loop column) exists.
  getValue(category: string, item: string): string | undefined;
  // returns every row of the `_category.*` table, or an empty array if the
  // document has no such category. A category written as key-value pairs
  // rather than a loop is a table with a single row (mmCIF does this e.g. for
  // entries with only one assembly or one helix).
  loopRows(category: string): CIFRow[];
}

export interface ParseOptions {
  // called with each row of each loop_ table as soon as it is read; the rows
  // it returns false for are dropped right away, never stored. Lets a caller
  // keep just part of a very large table, e.g. some of the _atom_site rows
  // of a huge structure. The row passed in is only valid during the call.
  keepRow?: (category: string, row: CIFRow) => boolean;
}

export function parseCIF(text: string, options?: ParseOptions): CIFDocument {
  const keepRow = options?.keepRow;
  const tokens = new Tokenizer(text);
  const loops = new Map<string, Loop>();
  const values = new Map<string, string>();
  // key-value pairs grouped by category, exposed as single row tables
  const pairs = new Map<string, { columns: string[]; row: string[] }>();

  let more = tokens.next();
  while (more) {
    if (tokens.type() === 'data') {
      more = tokens.next();
      continue;
    }
    if (tokens.type() === 'loop') {
      more = tokens.next();
      const columns: string[] = [];
      let category: string | null = null;
      while (more && tokens.type() === 'tag') {
        const [cat, item] = splitTag(tokens.text);
        if (category === null) {
          category = cat;
        }
        columns.push(item);
        more = tokens.next();
      }
      const columnIndex = indexColumns(columns);
      const filter = keepRow && category !== null ? new Row(columnIndex, []) : null;
      const rows: string[][] = [];
      let row: string[] = [];
      while (more && tokens.type() === 'value') {
        row.push(tokens.text);
        more = tokens.next();
        if (row.length === columns.length) {
          if (filter !== null) {
            filter._values = row;
          }
          if (filter === null || keepRow!(category!, filter)) {
            rows.push(row);
          }
          row = [];
        }
      }
      if (category !== null && columns.length > 0) {
        loops.set(category, new Loop(columnIndex, rows));
      }
      continue;
    }
    if (tokens.type() === 'tag') {
      const [category, item] = splitTag(tokens.text);
      more = tokens.next();
      if (more && tokens.type() === 'value') {
        values.set(category + '.' + item, tokens.text);
        let entry = pairs.get(category);
        if (entry === undefined) {
          entry = { columns: [], row: [] };
          pairs.set(category, entry);
        }
        entry.columns.push(item);
        entry.row.push(tokens.text);
        more = tokens.next();
      }
      continue;
    }
    // stray value token outside of a loop/tag context: skip it.
    more = tokens.next();
  }

  pairs.forEach(function(entry, category) {
    if (!loops.has(category)) {
      loops.set(category, new Loop(indexColumns(entry.columns), [entry.row]));
    }
  });

  return {
    getValue(category: string, item: string): string | undefined {
      return values.get(category.toLowerCase() + '.' + item.toLowerCase());
    },
    loopRows(category: string): CIFRow[] {
      const loop = loops.get(category.toLowerCase());
      if (loop === undefined) {
        return [];
      }
      const result: CIFRow[] = [];
      for (let r = 0; r < loop.length; ++r) {
        result.push(loop.row(r));
      }
      return result;
    },
  };
}
