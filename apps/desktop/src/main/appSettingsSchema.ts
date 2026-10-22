import { UpdateChannelSchema } from '@flocksync/shared-types';
import { z } from 'zod';

export const AppSettingsPatchSchema = z.object({
  minimizeToTray: z.boolean(),
  startMinimized: z.boolean(),
  startOnBoot: z.boolean(),
  updateChannel: UpdateChannelSchema,
}).partial().strict();
