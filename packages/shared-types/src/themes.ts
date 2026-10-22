import { z } from "zod";

export const ThemeImageSchema = z.enum(["none", "alliance", "horde", "warcraft", "custom"]);
export const ThemeColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex color");
export const DEFAULT_THEME_COLOR = "#020617";
export const ThemeSchema = z.object({
  image: ThemeImageSchema,
  opacity: z.number().min(0).max(0.4),
  uiColor: ThemeColorSchema.optional(),
  backgroundColor: ThemeColorSchema.optional(),
  separateColors: z.boolean().optional(),
  customImage: z.string().max(750_000)
    .regex(/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/).optional()
}).strict().superRefine((theme, context) => {
  if ((theme.image === "custom") !== (theme.customImage !== undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Custom image is required only for the custom background" });
  }
});
export type Theme = z.infer<typeof ThemeSchema>;
export const DEFAULT_THEME: Theme = { image: "none", opacity: 0.12 };
export const ThemeStateSchema = z.object({
  defaultTheme: ThemeSchema,
  userTheme: ThemeSchema.nullable()
}).strict();
export type ThemeState = z.infer<typeof ThemeStateSchema>;
