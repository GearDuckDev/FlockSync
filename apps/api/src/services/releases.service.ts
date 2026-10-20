import { env } from "../config/env.js";
import { createReleaseCatalog } from "./releaseCatalog.js";

export const releaseCatalog = createReleaseCatalog({ repository: env.GITHUB_REPOSITORY });
