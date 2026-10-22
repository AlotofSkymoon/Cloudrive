// 仅用于本地冒烟测试的极简 D1 / R2 模拟实现（不需要真实 Cloudflare 环境）
// 支持本项目用到的 SQL 子集：CREATE / INSERT / UPDATE / DELETE / SELECT(含 JOIN、COUNT、ORDER BY、LIMIT)
class Stmt {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql.trim().replace(/\s+/g, ' ');
    this.params = [];
  }
  bind(...p) {
    this.params = p;
    return this;
  }
  async run() {
    this.exec();
    return { success: true, meta: {} };
  }
  async all() {
    return { results: this.exec().rows || [] };
  }
  async first() {
    const r = this.exec();
    return r.rows && r.rows[0] ? r.rows[0] : null;
  }
  exec() {
    const sql = this.sql;
    const q = [...this.params];

    if (/^CREATE TABLE/i.test(sql)) {
      const name = /CREATE TABLE IF NOT EXISTS (\w+)/i.exec(sql)[1];
      if (!this.db.tables[name]) this.db.tables[name] = [];
      return {};
    }
    if (/^CREATE INDEX/i.test(sql)) return {};

    if (/^INSERT/i.test(sql)) {
      // 支持 INSERT INTO t (cols) VALUES (...) [ON CONFLICT(col) DO UPDATE SET ...]
      const m = /^INSERT INTO (\w+)\s*\(([^)]*)\)\s*VALUES\s*\((.*?)\)(?:\s*ON CONFLICT.*)?$/i.exec(sql);
      if (!m) throw new Error('MiniD1 不支持的 INSERT: ' + sql);
      const cols = m[2].split(',').map((s) => s.trim());
      const vals = splitTop(m[3]).map((s) => s.trim());
      const row = {};
      cols.forEach((c, i) => {
        row[c] = vals[i] === '?' ? q.shift() : literal(vals[i]);
      });
      const table = (this.db.tables[m[1]] = this.db.tables[m[1]] || []);
      const conflict = /\s+ON CONFLICT\s*\((\w+)\)\s*DO UPDATE SET\s+(.*)$/i.exec(sql);
      if (conflict) {
        const key = conflict[1];
        const hit = table.find((r) => String(r[key]) === String(row[key]));
        if (hit) {
          for (const a of splitTop(conflict[2])) {
            const am = /^(\w+)\s*=\s*(.*)$/.exec(a.trim());
            if (am) hit[am[1]] = evalArith(am[2], hit, q, row);
          }
          return { changes: 1 };
        }
      }
      table.push(row);
      return { changes: 1 };
    }

    if (/^UPDATE/i.test(sql)) {
      const m = /^UPDATE (\w+) SET (.*?)(?: WHERE (.*))?$/i.exec(sql);
      const rows = this.db.tables[m[1]] || [];
      const assigns = splitTop(m[2]);
      // 参数按 SQL 文本顺序绑定：SET 子句的占位符先消耗，剩下的留给 WHERE
      const setParams = q.splice(0, countPlaceholders(m[2]));
      const whereParams = q;
      let n = 0;
      for (const row of rows) {
        const wq = [...whereParams];
        if (m[3] && !evalBool(row, m[3], wq)) continue;
        const sq = [...setParams];
        for (const a of assigns) {
          const am = /^(\w+)\s*=\s*(.*)$/.exec(a.trim());
          if (am) row[am[1]] = evalArith(am[2], row, sq);
        }
        n++;
      }
      return { changes: n };
    }

    if (/^DELETE/i.test(sql)) {
      const m = /^DELETE FROM (\w+)(?: WHERE (.*))?$/i.exec(sql);
      const rows = this.db.tables[m[1]] || [];
      this.db.tables[m[1]] = rows.filter((r) => !(m[2] ? evalBool(r, m[2], q) : true));
      return {};
    }

    if (/^SELECT/i.test(sql)) {
      const m = /^SELECT (.*?) FROM (.*?)(?: WHERE (.*?))?(?: ORDER BY (.*?))?(?: LIMIT (\d+|\?))?(?: OFFSET (\d+|\?))?$/i.exec(sql);
      const fromRaw = m[2];
      const joinM = /\s+(?:LEFT\s+)?(?:INNER\s+)?JOIN\s+(\w+)\s*(\w+)?\s*ON\s*(.+)$/i.exec(fromRaw);
      const mainPart = (joinM ? fromRaw.slice(0, joinM.index) : fromRaw).trim();
      const mm = /^(\w+)(?:\s+(\w+))?$/.exec(mainPart);
      const t1 = mm[1];
      const a1 = mm[2] || t1;

      let rows = (this.db.tables[t1] || []).map((r) => ({ [a1]: r }));
      if (joinM) {
        const t2 = joinM[1];
        const a2 = joinM[2] || t2;
        const on = joinM[3];
        const out = [];
        for (const r of rows) {
          let hit = false;
          for (const jr of this.db.tables[t2] || []) {
            if (matchJoin(r, jr, on, a1, a2)) {
              out.push({ ...r, [a2]: jr });
              hit = true;
            }
          }
          if (!hit && /LEFT JOIN/i.test(fromRaw)) out.push({ ...r, [a2]: {} });
        }
        rows = out;
      }

      // 参数顺序：WHERE → LIMIT → OFFSET；WHERE 用副本逐行求值，这里按占位符数跳过
      const rest = q.slice(m[3] ? countPlaceholders(m[3]) : 0);
      const lim = m[5] ? (m[5] === '?' ? Number(rest.shift()) : Number(m[5])) : 0;
      const off = m[6] ? (m[6] === '?' ? Number(rest.shift()) : Number(m[6])) : 0;
      // 每一行都用参数副本，避免占位符被前一行消耗掉
      let res = rows.filter((r) => (m[3] ? evalBool(r, m[3], [...q]) : true));
      if (m[4]) {
        const om = /^([\w.]+)\s*(ASC|DESC)?/i.exec(m[4].trim());
        const col = om[1].split('.').pop();
        const dir = (om[2] || 'ASC').toUpperCase();
        res = res.slice().sort((x, y) => {
          const a = pick(x, col);
          const b = pick(y, col);
          return dir === 'DESC' ? (a < b ? 1 : a > b ? -1 : 0) : a > b ? 1 : a < b ? -1 : 0;
        });
      }
      if (off) res = res.slice(off);
      if (lim) res = res.slice(0, lim);

      if (/COUNT\(\*\)/i.test(m[1])) {
        const cname = /AS\s+(\w+)/i.exec(m[1])?.[1] || 'c';
        return { rows: [{ [cname]: res.length }] };
      }
      return { rows: res.map((r) => project(r, m[1])) };
    }
    throw new Error('MiniD1 不支持的 SQL: ' + sql);
  }
}

function literal(v) {
  v = String(v).trim();
  if (/^'.*'$/.test(v)) return v.slice(1, -1);
  if (/^-?\d+$/.test(v)) return Number(v);
  return v;
}
function countPlaceholders(s) {
  return (s.match(/\?/g) || []).length;
}
// 解析右值：? 占位符 / 字面量 / excluded.col（UPSERT 的待插入行）/ 当前行某列
function resolveVal(v, row, q, excl) {
  v = String(v).trim();
  if (v === '?') return q.shift();
  if (/^excluded\./i.test(v)) return excl ? excl[v.split('.')[1]] : undefined;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (/^'.*'$/.test(v)) return v.slice(1, -1);
  return pick(row, v.split('.').pop());
}
// 支持: col + ? / col + N / col + excluded.col / 纯值
function evalArith(expr, row, q = [], excl = null) {
  const e = String(expr).trim();
  const m = /^([\w.]+)\s*\+\s*(.+)$/.exec(e);
  if (m) return (Number(pick(row, m[1].split('.').pop())) || 0) + Number(resolveVal(m[2], row, q, excl));
  return resolveVal(e, row, q, excl);
}
function splitTop(s, re) {
  const out = [];
  let depth = 0;
  let cur = '';
  if (re) {
    // 按正则切分，但跳过括号内部（如 WHERE a = ? AND (b = 0 OR c < d)）
    let buf = '';
    for (let i = 0; i < s.length; ) {
      const ch = s[i];
      if (ch === '(') {
        depth++;
        buf += ch;
        i++;
        continue;
      }
      if (ch === ')') {
        depth--;
        buf += ch;
        i++;
        continue;
      }
      if (depth === 0) {
        const m = re.exec(s.slice(i));
        if (m && m.index === 0) {
          out.push(buf);
          buf = '';
          i += m[0].length;
          continue;
        }
      }
      buf += ch;
      i++;
    }
    out.push(buf);
    return out;
  }
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}
function pick(row, col) {
  if (col in row && typeof row[col] !== 'object') return row[col];
  for (const v of Object.values(row)) if (v && typeof v === 'object' && col in v) return v[col];
  return undefined;
}
// 剥离完整包裹整段的外层括号：'(a OR b)' -> 'a OR b'，'(a) AND (b)' 保持不动
function stripOuter(s) {
  let str = String(s).trim();
  while (str.startsWith('(')) {
    let depth = 0;
    let end = -1;
    for (let i = 0; i < str.length; i++) {
      if (str[i] === '(') depth++;
      else if (str[i] === ')') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end !== str.length - 1) break;
    str = str.slice(1, -1).trim();
  }
  return str;
}
function evalBool(row, expr, q) {
  const top = stripOuter(expr);
  const ors = splitTop(top, /\s+OR\s+/i);
  if (ors.length > 1) {
    let ok = false;
    for (const o of ors) if (evalBool(row, o, q)) ok = true;
    return ok;
  }
  const ands = splitTop(top, /\s+AND\s+/i);
  if (ands.length > 1) return ands.map((a) => evalBool(row, a, q)).every(Boolean);
  const s = stripOuter(expr.trim());
  const likeM = /^([\w.]+)\s+LIKE\s+(.+)$/i.exec(s);
  if (likeM) {
    const cur = String(pick(row, likeM[1].split('.').pop()) ?? '');
    let pat = String(resolveVal(likeM[2].trim(), row, q) ?? '').replace(/(^%|%$)/g, '');
    return cur.toLowerCase().includes(pat.toLowerCase());
  }
  const m = /^([\w.]+)\s*(=|>=|<=|>|<)\s*(.*)$/.exec(s);
  if (!m) return true;
  const cur = pick(row, m[1].split('.').pop());
  const rhs = m[3].trim();
  // 右值可能是 ? 占位、字面量，或另一个列名
  const val = rhs === '?' ? q.shift() : /^-?\d+$/.test(rhs) || /^'.*'$/.test(rhs) ? literal(rhs) : pick(row, rhs.split('.').pop());
  switch (m[2]) {
    case '=':
      return String(cur) === String(val);
    case '>':
      return Number(cur) > Number(val);
    case '<':
      return Number(cur) < Number(val);
    case '>=':
      return Number(cur) >= Number(val);
    default:
      return Number(cur) <= Number(val);
  }
}
function matchJoin(row, jr, on, a1, a2) {
  const m = /(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)/.exec(on);
  const side = (alias, col) => (alias === a1 ? row[a1] || {} : alias === a2 ? jr : {})[col];
  return String(side(m[1], m[2])) === String(side(m[3], m[4]));
}
function project(row, select) {
  const out = {};
  for (const raw of splitTop(select)) {
    const s = raw.trim();
    const asM = /\s+AS\s+(\w+)$/i.exec(s);
    const name = asM ? asM[1] : s.split('.').pop();
    const expr = asM ? s.replace(/\s+AS\s+\w+$/i, '').trim() : s;
    if (/^\w+\.\*$/.test(expr)) {
      Object.assign(out, row[expr.split('.')[0]] || {});
      continue;
    }
    if (expr === '*') {
      for (const v of Object.values(row)) if (v && typeof v === 'object') Object.assign(out, v);
      continue;
    }
    if (expr.includes('.')) {
      const [a, c] = expr.split('.');
      out[name] = (row[a] || {})[c];
      continue;
    }
    out[name] = pick(row, expr);
  }
  return out;
}

export class FakeD1 {
  constructor() {
    this.tables = {};
  }
  prepare(sql) {
    return new Stmt(this, sql);
  }
}

export class FakeBucket {
  constructor() {
    this.store = new Map();
  }
  async put(key, body, opts = {}) {
    const buf = body ? new Uint8Array(await new Response(body).arrayBuffer()) : new Uint8Array();
    this.store.set(key, { buf, ct: opts?.httpMetadata?.contentType || 'application/octet-stream' });
    return { key, size: buf.length };
  }
  async head(key) {
    const o = this.store.get(key);
    return o ? { size: o.buf.length, httpMetadata: { contentType: o.ct }, etag: '"e"' } : null;
  }
  async get(key, range) {
    const o = this.store.get(key);
    if (!o) return null;
    const buf = range ? o.buf.slice(range.offset, range.offset + range.length) : o.buf;
    return {
      body: new ReadableStream({
        start(c) {
          c.enqueue(buf);
          c.close();
        },
      }),
      size: o.buf.length,
      httpMetadata: { contentType: o.ct },
      etag: '"e"',
    };
  }
  async delete(key) {
    this.store.delete(key);
  }
  async list({ limit = 1000, cursor } = {}) {
    const keys = [...this.store.keys()];
    const start = cursor ? Number(cursor) : 0;
    const slice = keys.slice(start, start + limit);
    return {
      objects: slice.map((k) => ({ key: k, size: this.store.get(k).buf.length, uploaded: new Date() })),
      truncated: start + limit < keys.length,
      cursor: String(start + limit),
    };
  }
}
