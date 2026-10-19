export type LuaValue = string | number | boolean | null | LuaTable;
export interface LuaTable {
  array: LuaValue[];
  hash: Map<string, LuaValue>;
}

export class LuaParseError extends Error {}

/** Minimal, eval-free reader for Lua table literals (SavedVariables files). */
class Reader {
  private pos = 0;
  constructor(private readonly src: string) {}

  private fail(msg: string): never {
    throw new LuaParseError(`${msg} at offset ${this.pos}`);
  }

  private skipSpace(): void {
    for (;;) {
      const c = this.src[this.pos];
      if (c !== undefined && /\s/.test(c)) this.pos++;
      else if (this.src.startsWith('--', this.pos)) this.skipComment();
      else return;
    }
  }

  private skipComment(): void {
    const long = /^--\[(=*)\[/.exec(this.src.slice(this.pos, this.pos + 40));
    if (long) {
      const close = `]${long[1] ?? ''}]`;
      const end = this.src.indexOf(close, this.pos);
      this.pos = end === -1 ? this.src.length : end + close.length;
      return;
    }
    const nl = this.src.indexOf('\n', this.pos);
    this.pos = nl === -1 ? this.src.length : nl + 1;
  }

  private expect(ch: string): void {
    this.skipSpace();
    if (this.src[this.pos] !== ch) this.fail(`Expected '${ch}'`);
    this.pos++;
  }

  parseAssignment(name: string): LuaValue {
    this.skipSpace();
    if (!this.src.startsWith(name, this.pos)) this.fail(`Expected assignment to ${name}`);
    this.pos += name.length;
    this.expect('=');
    return this.parseValue();
  }

  private parseValue(): LuaValue {
    this.skipSpace();
    const c = this.src[this.pos];
    if (c === '{') return this.parseTable();
    if (c === '"' || c === "'") return this.parseString(c);
    const word = /^(?:true|false|nil)\b/.exec(this.src.slice(this.pos, this.pos + 6));
    if (word) {
      this.pos += word[0].length;
      return word[0] === 'nil' ? null : word[0] === 'true';
    }
    const num = /^-?(?:0[xX][0-9a-fA-F]+|\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+)/.exec(
      this.src.slice(this.pos, this.pos + 40),
    );
    if (!num) return this.fail('Unexpected token');
    this.pos += num[0].length;
    return Number(num[0]);
  }

  private parseString(quote: string): string {
    this.pos++;
    let out = '';
    for (;;) {
      const c = this.src[this.pos++];
      if (c === undefined) return this.fail('Unterminated string');
      if (c === quote) return out;
      if (c !== '\\') {
        out += c;
        continue;
      }
      const e = this.src[this.pos++];
      if (e === undefined) return this.fail('Unterminated escape');
      const simple: Record<string, string> = { n: '\n', t: '\t', r: '\r', a: '\x07', b: '\b', f: '\f', v: '\v' };
      if (e in simple) out += simple[e];
      else if (/\d/.test(e)) {
        const digits = /^\d{1,3}/.exec(this.src.slice(this.pos - 1, this.pos + 2));
        const text = digits?.[0] ?? e;
        this.pos += text.length - 1;
        out += String.fromCharCode(Number(text));
      } else out += e === '\n' ? '\n' : e;
    }
  }

  private parseKey(): string | null {
    this.skipSpace();
    if (this.src[this.pos] === '[') {
      this.pos++;
      const key = this.parseValue();
      this.expect(']');
      this.expect('=');
      if (typeof key === 'object' && key !== null) this.fail('Table keys cannot be tables');
      return String(key);
    }
    const ident = /^[A-Za-z_][A-Za-z0-9_]*\s*=(?!=)/.exec(this.src.slice(this.pos, this.pos + 80));
    if (!ident) return null;
    this.pos += ident[0].length;
    return ident[0].replace(/\s*=$/, '');
  }

  private parseTable(): LuaTable {
    this.expect('{');
    const table: LuaTable = { array: [], hash: new Map() };
    for (;;) {
      this.skipSpace();
      if (this.src[this.pos] === '}') {
        this.pos++;
        return table;
      }
      const key = this.parseKey();
      const value = this.parseValue();
      if (key === null) table.array.push(value);
      else table.hash.set(key, value);
      this.skipSpace();
      const sep = this.src[this.pos];
      if (sep === ',' || sep === ';') this.pos++;
      else if (sep !== '}') this.fail("Expected ',' or '}'");
    }
  }
}

export const parseLuaAssignment = (source: string, variable: string): LuaValue =>
  new Reader(source).parseAssignment(variable);

/** Convert a parsed Lua table to plain JS: pure sequences become arrays, others objects. */
export const luaToJs = (value: LuaValue): unknown => {
  if (typeof value !== 'object' || value === null) return value;
  const { array, hash } = value;
  if (hash.size === 0) return array.map(luaToJs);
  const obj: Record<string, unknown> = {};
  array.forEach((v, i) => {
    obj[String(i + 1)] = luaToJs(v);
  });
  for (const [k, v] of hash) if (v !== null) obj[k] = luaToJs(v);
  return obj;
};
