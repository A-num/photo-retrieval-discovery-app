import Link from "next/link";
import { ExternalLink, Star } from "lucide-react";
import type { Conversation } from "@/types";
import { SyntheticBadge, UserEvidenceLabel } from "@/components/labels";

/** Original user text, shown verbatim with its source metadata. */
export function EvidenceCard({ conversation: c, note }: { conversation: Conversation; note?: string }) {
  return (
    <article className="rounded-lg border border-evidence-border/70 bg-background p-4">
      <header className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <UserEvidenceLabel />
        {c.synthetic && <SyntheticBadge />}
        <span className="font-medium text-foreground">{c.source}</span>
        {c.date && <span>· {c.date}</span>}
        {c.rating !== undefined && (
          <span className="inline-flex items-center gap-0.5">
            · {c.rating}
            <Star className="size-3" />
          </span>
        )}
      </header>
      {c.title && <p className="mb-1 text-sm font-medium">{c.title}</p>}
      <blockquote className="border-l-2 border-evidence-border pl-3 text-sm leading-relaxed">“{c.text}”</blockquote>
      <footer className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        {c.sourceUrl ? (
          <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ai-foreground hover:underline">
            View source <ExternalLink className="size-3" />
          </a>
        ) : (
          <span className="text-muted-foreground">
            {c.synthetic ? "No source link (synthetic demo conversation)" : "No source link provided"}
          </span>
        )}
        <Link href={`/conversations/${c.id}`} className="text-muted-foreground hover:text-foreground hover:underline">
          {note ?? "Full analysis →"}
        </Link>
      </footer>
    </article>
  );
}
