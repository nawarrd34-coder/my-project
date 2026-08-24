#!/usr/bin/env node
/**
 * Generate `src/types/database.types.ts` by introspecting a live PostgreSQL
 * database, so the app's types cannot drift from the schema.
 *
 * On a real project you would normally run `supabase gen types typescript`.
 * This script produces the same shape from any reachable Postgres, which lets
 * CI verify types against the migrations without the Supabase toolchain.
 *
 *   node scripts/gen-types.mjs --psql "psql -h /tmp/pgsock -p 55432 -U postgres -d unistreak_test"
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
const psqlIndex = args.indexOf('--psql');
const PSQL = psqlIndex >= 0 ? args[psqlIndex + 1] : 'psql';
const OUT = resolve(process.cwd(), 'src/types/database.types.ts');

const query = (sql) => {
  const [cmd, ...rest] = PSQL.split(/\s+/);
  const out = execFileSync(cmd, [...rest, '-X', '-t', '-A', '-c', sql], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return JSON.parse(out.trim() || '[]');
};

/** Postgres type -> TypeScript type. */
const TS_TYPE = {
  uuid: 'string', text: 'string', varchar: 'string', bpchar: 'string', citext: 'string',
  int2: 'number', int4: 'number', int8: 'number', numeric: 'number',
  float4: 'number', float8: 'number',
  bool: 'boolean',
  timestamptz: 'string', timestamp: 'string', date: 'string', time: 'string',
  interval: 'string',
  jsonb: 'Json', json: 'Json',
};

const tsTypeFor = (udt, enums) => {
  if (enums.has(udt)) return `Database['public']['Enums']['${udt}']`;
  if (udt.startsWith('_')) {
    const inner = udt.slice(1);
    return `${tsTypeFor(inner, enums)}[]`;
  }
  return TS_TYPE[udt] ?? 'unknown';
};

const enumRows = query(`
  select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
    select t.typname as name, array_agg(e.enumlabel order by e.enumsortorder) as labels
      from pg_type t
      join pg_enum e on e.enumtypid = t.oid
      join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = 'public'
     group by t.typname order by t.typname
  ) t;
`);

const columnRows = query(`
  select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
    select c.relname as table_name,
           c.relkind as kind,
           a.attname as column_name,
           format_type(a.atttypid, null) as formatted,
           tp.typname as udt,
           a.attnotnull as not_null,
           pg_get_expr(d.adbin, d.adrelid) is not null as has_default,
           a.attnum as ordinal
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
      join pg_type tp on tp.oid = a.atttypid
      left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
     where n.nspname = 'public' and c.relkind in ('r','v')
     order by c.relname, a.attnum
  ) t;
`);

const functionRows = query(`
  select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
    select p.proname as name,
           pg_get_function_arguments(p.oid) as args,
           pg_get_function_result(p.oid) as result
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind = 'f'
       and has_function_privilege('authenticated', p.oid, 'execute')
     order by p.proname
  ) t;
`);

const tableNames = new Set(columnRows.filter((c) => c.kind === 'r').map((c) => c.table_name));

const relationshipRows = query(`
  select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
    select con.conname as constraint_name,
           src.relname as table_name,
           array_agg(sa.attname order by u.ord) as columns,
           tgt.relname as referenced_relation,
           array_agg(ta.attname order by u.ord) as referenced_columns,
           con.conkey,
           exists (
             select 1 from pg_index i
              where i.indrelid = con.conrelid
                and i.indisunique
                and i.indkey::int2[] @> con.conkey
                and array_length(i.indkey::int2[], 1) = array_length(con.conkey, 1)
           ) as is_one_to_one
      from pg_constraint con
      join pg_class src on src.oid = con.conrelid
      join pg_class tgt on tgt.oid = con.confrelid
      join pg_namespace n on n.oid = src.relnamespace
      cross join lateral unnest(con.conkey, con.confkey) with ordinality as u(srcatt, tgtatt, ord)
      join pg_attribute sa on sa.attrelid = con.conrelid and sa.attnum = u.srcatt
      join pg_attribute ta on ta.attrelid = con.confrelid and ta.attnum = u.tgtatt
     where con.contype = 'f' and n.nspname = 'public'
     group by con.conname, src.relname, tgt.relname, con.conkey, con.conrelid
     order by src.relname, con.conname
  ) t;
`);

const enumNames = new Set(enumRows.map((e) => e.name));

const relationshipsByTable = new Map();
for (const rel of relationshipRows) {
  if (!relationshipsByTable.has(rel.table_name)) relationshipsByTable.set(rel.table_name, []);
  relationshipsByTable.get(rel.table_name).push(rel);
}

const renderRelationships = (tableName, indent) => {
  const rels = relationshipsByTable.get(tableName) ?? [];
  if (rels.length === 0) return [`${indent}Relationships: [];`];
  const out = [`${indent}Relationships: [`];
  for (const r of rels) {
    out.push(`${indent}  {`);
    out.push(`${indent}    foreignKeyName: '${r.constraint_name}';`);
    out.push(`${indent}    columns: [${r.columns.map((c) => `'${c}'`).join(', ')}];`);
    out.push(`${indent}    isOneToOne: ${r.is_one_to_one ? 'true' : 'false'};`);
    out.push(`${indent}    referencedRelation: '${r.referenced_relation}';`);
    out.push(`${indent}    referencedColumns: [${r.referenced_columns.map((c) => `'${c}'`).join(', ')}];`);
    out.push(`${indent}  },`);
  }
  out.push(`${indent}];`);
  return out;
};

/** Parse `pg_get_function_arguments` into typed, optional-aware Args. */
const parseArgs = (argString) => {
  if (!argString || !argString.trim()) return [];
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of argString) {
    if (ch === '(' || ch === '[') depth += 1;
    if (ch === ')' || ch === ']') depth -= 1;
    if (ch === ',' && depth === 0) { parts.push(current); current = ''; continue; }
    current += ch;
  }
  if (current.trim()) parts.push(current);

  return parts.map((raw) => {
    const text = raw.trim();
    const hasDefault = / DEFAULT /i.test(text);
    const withoutDefault = text.split(/ DEFAULT /i)[0].trim();
    const [name, ...typeParts] = withoutDefault.split(/\s+/);
    return { name, sqlType: typeParts.join(' ').trim(), optional: hasDefault };
  });
};

const SQL_TO_TS = {
  text: 'string', uuid: 'string', boolean: 'boolean', integer: 'number',
  bigint: 'number', smallint: 'number', 'double precision': 'number',
  numeric: 'number', real: 'number', jsonb: 'Json', json: 'Json',
  'timestamp with time zone': 'string', 'timestamp without time zone': 'string',
  date: 'string', interval: 'string', void: 'undefined', record: 'Record<string, unknown>',
  'character varying': 'string',
};

const sqlTypeToTs = (sqlType) => {
  const clean = sqlType.replace(/^public\./, '').replace(/\[\]$/, '');
  const isArray = sqlType.endsWith('[]');
  let base;
  if (SQL_TO_TS[clean]) base = SQL_TO_TS[clean];
  else if (enumNames.has(clean)) base = `Database['public']['Enums']['${clean}']`;
  else if (tableNames.has(clean)) base = `Database['public']['Tables']['${clean}']['Row']`;
  else base = 'unknown';
  return isArray ? `${base}[]` : base;
};

const parseResult = (result) => {
  const trimmed = (result || '').trim();
  if (/^TABLE\(/i.test(trimmed)) return 'Record<string, unknown>[]';
  const setof = /^SETOF\s+(.*)$/i.exec(trimmed);
  if (setof) return `${sqlTypeToTs(setof[1].trim())}[]`;
  return sqlTypeToTs(trimmed);
};


const tables = new Map();
for (const col of columnRows) {
  if (!tables.has(col.table_name)) {
    tables.set(col.table_name, { kind: col.kind, columns: [] });
  }
  tables.get(col.table_name).columns.push(col);
}

const lines = [];
lines.push('/**');
lines.push(' * GENERATED FILE - do not edit by hand.');
lines.push(' *');
lines.push(' * Regenerate with:  npm run db:types');
lines.push(' * Source of truth:  supabase/migrations/*.sql');
lines.push(' */');
lines.push('');
lines.push('export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];');
lines.push('');
lines.push('export interface Database {');
lines.push('  public: {');

// Tables and views
lines.push('    Tables: {');
for (const [name, meta] of [...tables].filter(([, m]) => m.kind === 'r')) {
  lines.push(`      ${name}: {`);
  lines.push('        Row: {');
  for (const c of meta.columns) {
    const ts = tsTypeFor(c.udt, enumNames);
    lines.push(`          ${c.column_name}: ${ts}${c.not_null ? '' : ' | null'};`);
  }
  lines.push('        };');
  lines.push('        Insert: {');
  for (const c of meta.columns) {
    const ts = tsTypeFor(c.udt, enumNames);
    // Optional when nullable or defaulted; required otherwise.
    const optional = !c.not_null || c.has_default;
    lines.push(`          ${c.column_name}${optional ? '?' : ''}: ${ts}${c.not_null ? '' : ' | null'};`);
  }
  lines.push('        };');
  lines.push('        Update: {');
  for (const c of meta.columns) {
    const ts = tsTypeFor(c.udt, enumNames);
    lines.push(`          ${c.column_name}?: ${ts}${c.not_null ? '' : ' | null'};`);
  }
  lines.push('        };');
  lines.push(...renderRelationships(name, '        '));
  lines.push('      };');
}
lines.push('    };');

lines.push('    Views: {');
for (const [name, meta] of [...tables].filter(([, m]) => m.kind === 'v')) {
  lines.push(`      ${name}: {`);
  lines.push('        Row: {');
  for (const c of meta.columns) {
    const ts = tsTypeFor(c.udt, enumNames);
    // Every view column is nullable in practice: outer joins and CASE
    // expressions defeat Postgres' not-null inference.
    lines.push(`          ${c.column_name}: ${ts} | null;`);
  }
  lines.push('        };');
  lines.push('        Relationships: [];');
  lines.push('      };');
}
lines.push('    };');

// Enums
lines.push('    Enums: {');
for (const e of enumRows) {
  lines.push(`      ${e.name}: ${e.labels.map((l) => `'${l}'`).join(' | ')};`);
}
lines.push('    };');

// Functions - argument names and result types, documented for reference.
lines.push('    Functions: {');
for (const f of functionRows) {
  const args = parseArgs(f.args);
  lines.push(`      ${f.name}: {`);
  if (args.length === 0) {
    lines.push('        Args: Record<PropertyKey, never>;');
  } else {
    lines.push('        Args: {');
    for (const a of args) {
      lines.push(`          ${a.name}${a.optional ? '?' : ''}: ${sqlTypeToTs(a.sqlType)};`);
    }
    lines.push('        };');
  }
  lines.push(`        Returns: ${parseResult(f.result)};`);
  lines.push('      };');
}
lines.push('    };');
lines.push('  };');
lines.push('}');
lines.push('');
lines.push('/** Convenience aliases. */');
lines.push("export type Tables<T extends keyof Database['public']['Tables']> =");
lines.push("  Database['public']['Tables'][T]['Row'];");
lines.push("export type TablesInsert<T extends keyof Database['public']['Tables']> =");
lines.push("  Database['public']['Tables'][T]['Insert'];");
lines.push("export type TablesUpdate<T extends keyof Database['public']['Tables']> =");
lines.push("  Database['public']['Tables'][T]['Update'];");
lines.push("export type Views<T extends keyof Database['public']['Views']> =");
lines.push("  Database['public']['Views'][T]['Row'];");
lines.push("export type Enums<T extends keyof Database['public']['Enums']> =");
lines.push("  Database['public']['Enums'][T];");
lines.push('');

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, lines.join('\n'));
console.log(
  `wrote ${OUT}: ${[...tables].filter(([, m]) => m.kind === 'r').length} tables, ` +
  `${[...tables].filter(([, m]) => m.kind === 'v').length} views, ` +
  `${enumRows.length} enums, ${functionRows.length} functions`,
);
