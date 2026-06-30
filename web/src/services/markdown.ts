import { marked } from 'marked';
import DOMPurify from 'dompurify';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// ---- marked math extensions (configured once at module scope) ----

marked.use({
  extensions: [
    {
      name: 'mathBlock',
      level: 'block',
      start(src: string) { return src.indexOf('$$'); },
      tokenizer(this: any, src: string) {
        const match = src.match(/^\$\$\n?([\s\S]*?)\n?\$\$/);
        if (match) {
          return { type: 'mathBlock', raw: match[0], text: match[1].trim() };
        }
      },
      renderer(this: any, token: any) {
        try {
          return `<p class="mentor-math-block">${katex.renderToString(token.text, { displayMode: true, throwOnError: false })}</p>`;
        } catch {
          return `<pre>${token.raw}</pre>`;
        }
      },
    },
    {
      name: 'mathInline',
      level: 'inline',
      start(src: string) { return src.indexOf('$'); },
      tokenizer(this: any, src: string) {
        const match = src.match(/^\$([^$\n]+?)\$/);
        if (match) {
          return { type: 'mathInline', raw: match[0], text: match[1] };
        }
      },
      renderer(this: any, token: any) {
        try {
          return katex.renderToString(token.text, { displayMode: false, throwOnError: false });
        } catch {
          return token.raw;
        }
      },
    },
  ],
});

// Allow KaTeX tags/attrs through DOMPurify
DOMPurify.addHook('uponSanitizeElement', (node, data) => {
  if (data.tagName === 'math' ||
      (data.tagName && data.tagName.match(/^(?:semantics|annotation|mrow|mi|mo|mn|msup|msub|mfrac|mtable|mtr|mtd|munder|mover|mspace|menclose|mstyle|mpadded)$/i))) {
    data.allowedTags[data.tagName] = true;
  }
});

/** Render markdown to sanitized HTML with KaTeX math support. */
export function renderMarkdown(source: string): string {
  const rawHtml = marked.parse(source, { async: false }) as string;
  return DOMPurify.sanitize(rawHtml);
}
