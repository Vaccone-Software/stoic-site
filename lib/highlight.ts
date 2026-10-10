import {
  bundledLanguages,
  createHighlighter,
  type Highlighter,
  type ThemeRegistration,
} from "shiki";

// Code is highlighted when the site builds, so no highlighter ships to the
// browser. The theme is the landing page's palette: bone for text, dim for
// comments, verdigris for keywords and nothing else loud. The colours repeat
// the tokens in globals.css, which a TextMate theme cannot read.
const bone = "#e6ddca";
const body = "#cfc6b3";
const dim = "#9b917e";
const accent = "#78a08d";
const accentLight = "#9dbfac";
const aged = "#d6c59c";

export const stoicTheme: ThemeRegistration = {
  name: "stoic",
  type: "dark",
  colors: { "editor.background": "#1a1815", "editor.foreground": body },
  fg: body,
  bg: "#1a1815",
  settings: [
    { settings: { foreground: body, background: "#1a1815" } },
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: dim, fontStyle: "italic" },
    },
    {
      scope: [
        "keyword",
        "storage",
        "storage.type",
        "storage.modifier",
        "keyword.control",
        "keyword.operator.new",
        "variable.language",
      ],
      settings: { foreground: accent },
    },
    {
      scope: ["string", "string.quoted", "punctuation.definition.string"],
      settings: { foreground: aged },
    },
    {
      scope: ["constant", "constant.numeric", "constant.language", "support.constant"],
      settings: { foreground: aged },
    },
    {
      scope: [
        "entity.name.type",
        "entity.name.class",
        "entity.name.struct",
        "entity.name.enum",
        "entity.name.protocol",
        "support.type",
        "support.class",
        "meta.return-type",
      ],
      settings: { foreground: bone },
    },
    {
      scope: ["entity.name.function", "support.function", "meta.function-call"],
      settings: { foreground: bone },
    },
    {
      scope: [
        "storage.type.attribute",
        "keyword.other.attribute",
        "meta.attribute",
        "entity.name.function.macro",
        "support.variable.attribute",
      ],
      settings: { foreground: accentLight },
    },
    {
      scope: ["keyword.operator", "punctuation", "meta.brace"],
      settings: { foreground: dim },
    },
    {
      scope: ["support.type.property-name", "meta.object-literal.key"],
      settings: { foreground: bone },
    },
  ],
};

let highlighter: Promise<Highlighter> | undefined;
const get = () =>
  (highlighter ??= createHighlighter({
    themes: [stoicTheme],
    langs: ["swift", "json", "bash"],
  }));

const aliases: Record<string, string> = { sh: "bash", shell: "bash", zsh: "bash" };

/**
 * A fenced block as highlighted HTML. A language Shiki does not know, or none
 * at all, is set as plain text.
 */
export async function highlight(code: string, info: string): Promise<string> {
  const h = await get();
  const asked = (info.trim().split(/\s+/)[0] ?? "").toLowerCase();
  const name = aliases[asked] ?? asked;
  let lang = "text";
  if (name in bundledLanguages) {
    await h.loadLanguage(name as keyof typeof bundledLanguages);
    lang = name;
  }
  return h.codeToHtml(code, { lang, theme: "stoic" });
}
