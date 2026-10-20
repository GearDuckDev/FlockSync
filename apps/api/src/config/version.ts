import { readFileSync } from "node:fs";
import { z } from "zod";
import { ReleaseVersionSchema } from "@flocksync/shared-types";

const readVersion = (): string => {
  try {
    const value: unknown = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
    return z.object({ version: ReleaseVersionSchema }).parse(value).version;
  } catch (error) {
    console.error({ error }, "Unable to read the installed server version");
    throw error;
  }
};

export const currentServerVersion = readVersion();
