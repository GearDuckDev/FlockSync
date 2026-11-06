import {
  CharacterOwnershipCatalogSchema, CharacterOwnershipSchema,
  type CharacterOwnership, type CharacterOwnershipCatalog, type SetCharacterOwner, type SetGroupOwner
} from '@flocksync/shared-types';
import { z } from 'zod';
import { request } from './api';

export const fetchCharacterOwnership = async (token: string): Promise<CharacterOwnershipCatalog> =>
  CharacterOwnershipCatalogSchema.parse(await request('/api/character-ownership', {}, token));

export const fetchOwnCharacters = async (token: string): Promise<CharacterOwnership[]> =>
  z.array(CharacterOwnershipSchema).parse(await request('/api/character-ownership/mine', {}, token));

export const setCharacterOwner = async (
  token: string, guid: string, input: SetCharacterOwner
): Promise<CharacterOwnership | null> =>
  CharacterOwnershipSchema.nullable().parse(await request(
    `/api/character-ownership/${encodeURIComponent(guid)}`,
    { method: 'PUT', body: JSON.stringify(input) }, token
  ));

export const setGroupOwner = async (token: string, input: SetGroupOwner): Promise<CharacterOwnershipCatalog> =>
  CharacterOwnershipCatalogSchema.parse(await request('/api/character-ownership/group', {
    method: 'PUT', body: JSON.stringify(input)
  }, token));
