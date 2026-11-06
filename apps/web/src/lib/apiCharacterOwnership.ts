import {
  CharacterOwnershipSchema, type CharacterOwnership
} from '@flocksync/shared-types';
import { z } from 'zod';
import { request } from './api';

export const fetchOwnCharacters = async (token: string): Promise<CharacterOwnership[]> =>
  z.array(CharacterOwnershipSchema).parse(await request('/api/character-ownership/mine', {}, token));
