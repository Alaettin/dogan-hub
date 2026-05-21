import { Fragment, type ReactNode } from "react";

// Schlanker, sicherer Markdown-Renderer — baut React-Nodes (kein
// dangerouslySetInnerHTML, kein XSS). Unterstützt: Überschriften (#, ##, ###),
// Aufzählungen (-, *), sowie inline **fett**, *kursiv*, `code`.

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    if (match[2] !== undefined) nodes.push(<strong key={key++}>{match[2]}</strong>);
    else if (match[3] !== undefined) nodes.push(<em key={key++}>{match[3]}</em>);
    else if (match[4] !== undefined) nodes.push(<code key={key++}>{match[4]}</code>);
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Markdown({ text }: { text: string }) {
  if (!text.trim()) return <p className="notes-md__empty">Kein Inhalt.</p>;

  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let listBuffer: string[] = [];
  let key = 0;

  function flushList() {
    if (listBuffer.length === 0) return;
    const items = listBuffer;
    blocks.push(
      <ul key={key++}>
        {items.map((li, i) => (
          <li key={i}>{renderInline(li)}</li>
        ))}
      </ul>,
    );
    listBuffer = [];
  }

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      listBuffer.push(bullet[1]);
      continue;
    }
    flushList();
    if (!line.trim()) continue;
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const content = renderInline(heading[2]);
      blocks.push(
        level === 1 ? (
          <h3 key={key++}>{content}</h3>
        ) : level === 2 ? (
          <h4 key={key++}>{content}</h4>
        ) : (
          <h5 key={key++}>{content}</h5>
        ),
      );
      continue;
    }
    blocks.push(<p key={key++}>{renderInline(line)}</p>);
  }
  flushList();

  return (
    <div className="notes-md">
      {blocks.map((b, i) => (
        <Fragment key={i}>{b}</Fragment>
      ))}
    </div>
  );
}
