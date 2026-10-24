import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders lesson markdown on the server (no JavaScript sent to the browser). */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="lesson-prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
