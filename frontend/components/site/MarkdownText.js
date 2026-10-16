"use client";

/**
 * Tiny, safe Markdown renderer for AI chat replies.
 *
 * Gemini answers in Markdown (bold, lists, headings); printing that raw
 * shows customers literal "**stars**". This renders the subset chat
 * replies actually use — **bold**, *italic*, `code`, links, headings,
 * bullet/numbered lists and paragraphs — as React elements. It never
 * uses dangerouslySetInnerHTML, so model output cannot inject markup.
 */

const INLINE = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]\n]+\]\((?:https?:\/\/|\/)[^)\s]+\))/g;

function renderInline(text, keyBase) {
  const parts = String(text).split(INLINE);
  return parts.map((part, i) => {
    const key = `${keyBase}-${i}`;
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={key}>{part.slice(1, -1)}</code>;
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (link) {
      return (
        <a key={key} href={link[2]} target={link[2].startsWith("http") ? "_blank" : undefined} rel="noreferrer">
          {link[1]}
        </a>
      );
    }
    return part;
  });
}

export default function MarkdownText({ text }) {
  const lines = String(text || "").split("\n");
  const blocks = [];
  let paragraph = [];
  let list = null; // { ordered: boolean, items: string[] }

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: "p", lines: paragraph });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push({ type: list.ordered ? "ol" : "ul", items: list.items });
      list = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const heading = line.match(/^\s*#{1,4}\s+(.*)$/);
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);

    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: "h", lines: [heading[1]] });
    } else if (bullet) {
      flushParagraph();
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(bullet[1]);
    } else if (numbered) {
      flushParagraph();
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(numbered[1]);
    } else if (!line.trim()) {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();

  return (
    <div className="chat-md">
      {blocks.map((block, bi) => {
        if (block.type === "h") {
          return <h4 key={bi}>{renderInline(block.lines[0], `h${bi}`)}</h4>;
        }
        if (block.type === "ul" || block.type === "ol") {
          const Tag = block.type;
          return (
            <Tag key={bi}>
              {block.items.map((item, ii) => (
                <li key={ii}>{renderInline(item, `l${bi}-${ii}`)}</li>
              ))}
            </Tag>
          );
        }
        return (
          <p key={bi}>
            {block.lines.map((line, li) => (
              <span key={li}>
                {li > 0 && <br />}
                {renderInline(line, `p${bi}-${li}`)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
