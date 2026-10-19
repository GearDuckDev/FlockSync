/// <reference types="vite/client" />
import type { FlockSyncApi } from '../shared/ipc';

declare global {
  interface Window {
    flocksync: FlockSyncApi;
  }
}

export {};
