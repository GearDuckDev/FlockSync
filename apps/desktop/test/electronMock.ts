import { join } from 'node:path';

export const fixtureRoot = join(process.cwd(), `.flocksync-updater-fixture-${process.pid}`);
export const ipcHandlers = new Map<string, (...args: unknown[]) => unknown>();
export const ipcListeners = new Map<string, (...args: unknown[]) => unknown>();
export const ipcMain = {
  handle: (name: string, callback: (...args: unknown[]) => unknown): void => {
    ipcHandlers.set(name, callback);
  },
  on: (name: string, callback: (...args: unknown[]) => unknown): void => {
    ipcListeners.set(name, callback);
  },
};
export const app = {
  getVersion: (): string => '0.1.0-alpha',
  getPath: (): string => fixtureRoot,
  isPackaged: false,
};
const defaultFetchImplementation = async (): Promise<Response> => {
  throw new Error('Unexpected GitHub request');
};
let fetchImplementation: (url: string, init?: RequestInit) => Promise<Response> = defaultFetchImplementation;
export const setFetchImplementation = (implementation: (url: string, init?: RequestInit) => Promise<Response>): void => {
  fetchImplementation = implementation;
};
export const resetFetchImplementation = (): void => {
  fetchImplementation = defaultFetchImplementation;
};
export const net = {
  fetch: (url: string, init?: RequestInit): Promise<Response> => fetchImplementation(url, init),
};
