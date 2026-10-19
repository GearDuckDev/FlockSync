import { ServerReturnPayloadSchema, type ServerReturnPayload } from '@flocksync/shared-types';

type TableValue = string | number | boolean | undefined | TableValue[] | { [key: string]: TableValue };

const luaString = (text: string): string =>
  `"${text.replace(/[\\"\x00-\x1f\x7f]/g, (character) => {
    if (character === '\\') return '\\\\';
    if (character === '"') return '\\"';
    return `\\${character.charCodeAt(0).toString().padStart(3, '0')}`;
  })}"`;

const serialize = (value: TableValue, depth = 0): string => {
  if (typeof value === 'string') return luaString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === undefined) return 'nil';
  const indent = '  '.repeat(depth);
  const entries = Array.isArray(value)
    ? value.map((entry) => serialize(entry, depth + 1))
    : Object.entries(value).filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => `[${luaString(key)}] = ${serialize(entry, depth + 1)}`);
  return entries.length === 0 ? '{}' : `{\n${entries.map((entry) => `${indent}  ${entry},`).join('\n')}\n${indent}}`;
};

export const serializeServerReturnToLua = (payload: ServerReturnPayload): string => {
  const validated = ServerReturnPayloadSchema.parse(payload);
  return `FlockSyncHelperDB = ${serialize({
    ...validated,
    isAuthorizedOfficer: validated.isAuthorizedOfficer ?? true,
  })}\n`;
};
