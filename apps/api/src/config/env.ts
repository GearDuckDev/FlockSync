import "dotenv/config";
import { z } from "zod";

const EnvironmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  HOST: z.string().min(1).default("0.0.0.0"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  GITHUB_REPOSITORY: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9_.-]+$/)
    .refine((value) => ![".", ".."].includes(value.split("/")[1] ?? ""), "Expected a GitHub owner/repository")
    .default("GearDuckDev/FlockSync"),
  INITIAL_ADMIN_EMAIL: z.string().email().optional(),
  INITIAL_ADMIN_PASSWORD: z.string().min(16).optional()
}).strict().superRefine((value, context) => {
  if (Boolean(value.INITIAL_ADMIN_EMAIL) !== Boolean(value.INITIAL_ADMIN_PASSWORD)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD must be set together"
    });
  }
});

const parsedEnvironment = EnvironmentSchema.safeParse({
  PORT: process.env.PORT,
  HOST: process.env.HOST,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY,
  INITIAL_ADMIN_EMAIL: process.env.INITIAL_ADMIN_EMAIL || undefined,
  INITIAL_ADMIN_PASSWORD: process.env.INITIAL_ADMIN_PASSWORD || undefined
});

if (!parsedEnvironment.success) {
  const details = parsedEnvironment.error.issues
    .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid API environment configuration: ${details}`);
}

export const env = parsedEnvironment.data;
