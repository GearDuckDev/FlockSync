import { useEffect, useState } from 'react';
import { UpdateChannelSchema, type UpdateChannel } from '@flocksync/shared-types';

const CHANNEL_KEY = 'flocksync.serverUpdateChannel';
export const SERVER_UPDATE_CHANGED = 'flocksync-server-update-changed';

const readChannel = (): UpdateChannel => {
  try {
    const value = UpdateChannelSchema.safeParse(localStorage.getItem(CHANNEL_KEY));
    return value.success ? value.data : 'release';
  } catch {
    return 'release';
  }
};

export const useServerUpdateChannel = () => {
  const [channel, setChannel] = useState<UpdateChannel>(readChannel);
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    const refresh = (): void => setChannel(readChannel());
    window.addEventListener('storage', refresh);
    window.addEventListener(SERVER_UPDATE_CHANGED, refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener(SERVER_UPDATE_CHANGED, refresh);
    };
  }, []);
  const saveChannel = (next: UpdateChannel): void => {
    setChannel(next);
    try {
      localStorage.setItem(CHANNEL_KEY, next);
      setStorageError(false);
      window.dispatchEvent(new Event(SERVER_UPDATE_CHANGED));
    } catch {
      setStorageError(true);
    }
  };
  return { channel, saveChannel, storageError };
};
