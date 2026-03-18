// ── i18n (deerbox) ───────────────────────────────────────────────────
//
// Minimal language detection for the sandbox layer.
// The full string table and t() function live in deer's src/i18n.ts.

export type Lang = "en" | "ja" | "zh" | "ko" | "ru";

/**
 * Detect language from CLI args, CLAUDE_CODE_LOCALE, or system LANG.
 * Priority: --lang=<code> > CLAUDE_CODE_LOCALE > system LANG > "en"
 * @duplicate src/i18n.ts — keep both in sync
 */
export function detectLang(): Lang {
  const langArg = process.argv.find((a) => a.startsWith("--lang="));
  if (langArg) {
    const val = langArg.split("=")[1]?.toLowerCase();
    if (val === "jp" || val === "ja") return "ja";
    if (val === "zh" || val === "zh-cn" || val === "zh_cn") return "zh";
    if (val === "ko") return "ko";
    if (val === "ru") return "ru";
  }

  const claudeLocale = process.env.CLAUDE_CODE_LOCALE;
  if (claudeLocale?.toLowerCase().startsWith("ja")) return "ja";
  if (claudeLocale?.toLowerCase().startsWith("zh")) return "zh";
  if (claudeLocale?.toLowerCase().startsWith("ko")) return "ko";
  if (claudeLocale?.toLowerCase().startsWith("ru")) return "ru";

  const sysLang = process.env.LANG;
  if (sysLang?.toLowerCase().startsWith("ja")) return "ja";
  if (sysLang?.toLowerCase().startsWith("zh")) return "zh";
  if (sysLang?.toLowerCase().startsWith("ko")) return "ko";
  if (sysLang?.toLowerCase().startsWith("ru")) return "ru";

  return "en";
}
