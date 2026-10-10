import GithubSlugger from "github-slugger";
import { Marked, Renderer, type Token, type Tokens } from "marked";
import { highlight } from "./highlight";

/** One heading of a rendered document, for its table of contents. */
export interface Heading {
  readonly id: string;
  readonly text: string;
  readonly depth: number;
}

export interface Rendered {
  readonly html: string;
  /** The text of the document's leading `# h1`, if `dropTitle` took it out. */
  readonly title: string | undefined;
  readonly headings: readonly Heading[];
}

export interface RenderOptions {
  /** Maps a link's `href` to the one to publish. */
  readonly rewriteHref: (href: string) => string;
  /** Maps an image's `src` to the one to publish. */
  readonly rewriteSrc: (src: string) => string;
  /** Prepended to every heading id, for documents that share a page. */
  readonly idPrefix?: string;
  /** Added to every heading's level, for documents nested below a heading. */
  readonly headingOffset?: number;
  /** Take the leading `# h1` out of the body and return it as `title`. */
  readonly dropTitle?: boolean;
}

const entities: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};
const unescape = (text: string) =>
  text.replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => entities[entity]!);

/** The words of some inline Markdown, without its markup. */
export function plainText(tokens: readonly Token[]): string {
  return tokens
    .map((token) => {
      if ("tokens" in token && token.tokens) return plainText(token.tokens);
      return "text" in token ? unescape(String(token.text)) : "";
    })
    .join("");
}

/** The words of a run of inline Markdown, without its markup. */
export const inlineText = (source: string) =>
  plainText(new Marked().Lexer.lexInline(source));

/**
 * Markdown to HTML, at build time. GitHub-flavoured, with GitHub's heading
 * ids, rewritten links, scrollable tables and Shiki-highlighted code.
 */
export async function renderMarkdown(
  source: string,
  options: RenderOptions
): Promise<Rendered> {
  const marked = new Marked({ gfm: true });
  const tokens = marked.lexer(source);

  let title: string | undefined;
  if (options.dropTitle) {
    const first = tokens.findIndex((token) => token.type !== "space");
    const token = tokens[first];
    if (token?.type === "heading" && token.depth === 1) {
      title = plainText(token.tokens ?? []);
      tokens.splice(first, 1);
    }
  }

  const blocks: Tokens.Code[] = [];
  marked.walkTokens(tokens, (token) => {
    if (token.type === "link") token.href = options.rewriteHref(token.href);
    else if (token.type === "image") token.href = options.rewriteSrc(token.href);
    else if (token.type === "code") blocks.push(token as Tokens.Code);
  });
  const highlighted = new Map<Tokens.Code, string>(
    await Promise.all(
      blocks.map(
        async (block) =>
          [block, await highlight(block.text, block.lang ?? "")] as const
      )
    )
  );

  const slugger = new GithubSlugger();
  const headings: Heading[] = [];
  const offset = options.headingOffset ?? 0;
  const prefix = options.idPrefix ? `${options.idPrefix}-` : "";
  const base = new Renderer();

  marked.use({
    renderer: {
      heading(token) {
        const text = plainText(token.tokens);
        const id = `${prefix}${slugger.slug(text)}`;
        const depth = Math.min(token.depth + offset, 6);
        headings.push({ id, text, depth });
        return `<h${depth} id="${id}">${this.parser.parseInline(token.tokens)}</h${depth}>\n`;
      },
      code(token) {
        return highlighted.get(token) ?? base.code.call(this, token);
      },
      table(token) {
        return `<div class="table-wrap" tabindex="0">${base.table.call(this, token)}</div>\n`;
      },
    },
  });

  return { html: marked.parser(tokens), title, headings };
}
