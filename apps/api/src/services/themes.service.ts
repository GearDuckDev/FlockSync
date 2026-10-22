import { eq } from "drizzle-orm";
import { DEFAULT_THEME, ThemeSchema, type Theme, type ThemeState } from "@flocksync/shared-types";
import { db } from "../db/index.js";
import { themeDefaults, userThemes } from "../db/schema.js";

export const getThemes = (userId: string): ThemeState => {
  const shared = db.select().from(themeDefaults).where(eq(themeDefaults.id, "default")).get();
  const personal = db.select().from(userThemes).where(eq(userThemes.userId, userId)).get();
  return {
    defaultTheme: shared ? ThemeSchema.parse(JSON.parse(shared.themeJson)) : DEFAULT_THEME,
    userTheme: personal ? ThemeSchema.parse(JSON.parse(personal.themeJson)) : null
  };
};

export const saveDefaultTheme = (theme: Theme): void => {
  const themeJson = JSON.stringify(theme);
  db.insert(themeDefaults).values({ id: "default", themeJson })
    .onConflictDoUpdate({ target: themeDefaults.id, set: { themeJson } }).run();
};

export const saveUserTheme = (userId: string, theme: Theme | null): void => {
  if (theme === null) {
    db.delete(userThemes).where(eq(userThemes.userId, userId)).run();
    return;
  }
  const themeJson = JSON.stringify(theme);
  db.insert(userThemes).values({ userId, themeJson })
    .onConflictDoUpdate({ target: userThemes.userId, set: { themeJson } }).run();
};
