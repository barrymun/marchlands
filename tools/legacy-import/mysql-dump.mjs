// Minimal streaming parser for phpMyAdmin/mysqldump INSERT statements.
// Yields { table, columns, row } for every tuple in `INSERT INTO ... VALUES (...), (...);`.

import fs from 'node:fs';
import readline from 'node:readline';

/** Parse one SQL tuple list body, e.g. "(1, 'a', NULL), (2, 'b\'c', 3.5)" */
export function parseTuples(text) {
  const rows = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    while (i < n && text[i] !== '(') i++;
    if (i >= n) break;
    i++; // (
    const row = [];
    for (;;) {
      while (text[i] === ' ' || text[i] === '\n' || text[i] === '\r' || text[i] === '\t') i++;
      if (text[i] === "'") {
        i++;
        let s = '';
        for (;;) {
          const c = text[i];
          if (c === '\\') {
            const e = text[i + 1];
            // eslint-disable-next-line marchlands/no-string-compare -- MySQL's escape letters, fixed by the dump format
            s += e === 'n' ? '\n' : e === 'r' ? '\r' : e === 't' ? '\t' : e === '0' ? '\0' : e;
            i += 2;
          } else if (c === "'" && text[i + 1] === "'") {
            s += "'";
            i += 2;
          } else if (c === "'") {
            i++;
            break;
          } else {
            s += c;
            i++;
          }
        }
        row.push(s);
      } else {
        let j = i;
        while (text[j] !== ',' && text[j] !== ')') j++;
        const raw = text.slice(i, j).trim();
        // eslint-disable-next-line marchlands/no-string-compare -- MySQL's NULL, fixed by the dump format
        row.push(raw === 'NULL' ? null : Number(raw));
        i = j;
      }
      while (text[i] === ' ') i++;
      if (text[i] === ',') {
        i++;
        continue;
      }
      if (text[i] === ')') {
        i++;
        break;
      }
      throw new Error(`Unexpected char ${JSON.stringify(text[i])} at ${i}`);
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Stream a dump file and invoke onRows(table, columns, rows[]) for each INSERT statement
 * of the requested tables. Statements may span many lines; they end with ");".
 */
export async function readInserts(file, tables, onRows) {
  const rl = readline.createInterface({ input: fs.createReadStream(file, 'utf8'), crlfDelay: Infinity });
  let current = null;
  let buf = [];
  const re = /^INSERT INTO `([^`]+)` \(([^)]*)\) VALUES\s*(\S.*)?$/;
  for await (const line of rl) {
    if (!current) {
      const m = re.exec(line);
      if (!m) continue;
      if (!tables.includes(m[1])) continue;
      current = { table: m[1], columns: m[2].split(',').map((c) => c.trim().replace(/`/g, '')) };
      buf = [m[3] ?? ''];
    } else {
      buf.push(line);
    }
    if (current && /\);\s*$/.test(line)) {
      const body = buf.join('\n').replace(/;\s*$/, '');
      onRows(current.table, current.columns, parseTuples(body));
      current = null;
      buf = [];
    }
  }
}

export function toObjects(columns, rows) {
  return rows.map((r) => Object.fromEntries(columns.map((c, i) => [c, r[i]])));
}
