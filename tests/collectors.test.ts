import { describe, expect, it } from "vitest";
import { parseFeed } from "@/scripts/collect/app-store.mjs";
import { parseThread, threadIdFromUrl } from "@/scripts/collect/community.mjs";
import { parseListing } from "@/scripts/collect/reddit.mjs";
import { toCsv, stripHtml, looksRetrievalRelated } from "@/scripts/collect/lib.mjs";
import { parseConversationsCsv } from "@/lib/csv";
import { isRetrievalRelevant } from "@/lib/ai/heuristic";

describe("App Store feed", () => {
  it("keeps reviews and skips the app-metadata entry", () => {
    const rows = parseFeed({
      feed: {
        entry: [
          { "im:name": { label: "Google Photos" } },
          {
            id: { label: "1" },
            updated: { label: "2026-09-20T10:00:00-07:00" },
            title: { label: "Search broke" },
            content: { label: "Date searches return zero results" },
            "im:rating": { label: "1" },
          },
        ],
      },
    });
    expect(rows).toEqual([
      { id: "1", source: "App Store", date: "2026-09-20", title: "Search broke", text: "Date searches return zero results", rating: 1 },
    ]);
  });

  it("handles an empty feed", () => {
    expect(parseFeed({ feed: {} })).toEqual([]);
  });
});

describe("Community thread parser", () => {
  // Shape of the inline data on a thread page (JS-escaped quotes, JSON-escaped HTML in the body).
  const page = (marker: string) =>
    `<title>Can’t find my Camaro photo - Google Photos Community</title><script>var x='[[42,\\x22123\\x22,24053,1],null,\\x22Can’t find my Camaro photo\\x22,43,null,${marker},\\x22I\\x27m looking for my \\\\u003cb\\\\u003ewhite\\\\u003c/b\\\\u003e Camaro.\\\\u003cdiv\\\\u003eSearch shows every other car.\\\\u003c/div\\\\u003e\\x22,\\x22en\\x22,40,[[\\x22platform\\x22,\\x22ios\\x22]],1715084175061398,null]';</script>`;

  it("extracts title, body text and date", () => {
    expect(parseThread(page("[0]"), "42")).toEqual({
      title: "Can’t find my Camaro photo",
      text: "I'm looking for my white Camaro.\nSearch shows every other car.",
      date: "2024-05-07",
    });
  });

  it("handles the older thread format", () => {
    expect(parseThread(page("[13,null,null,[1]]"), "42")?.text).toMatch(/^I'm looking for my white Camaro/);
  });

  it("returns null when the structure isn't there", () => {
    expect(parseThread("<html></html>", "42")).toBeNull();
  });

  it("reads thread ids from URLs", () => {
    expect(threadIdFromUrl("https://support.google.com/photos/thread/273154473/can-t-find?hl=en")).toBe("273154473");
    expect(threadIdFromUrl("https://support.google.com/drive/thread/1")).toBeNull();
  });
});

describe("Reddit listing parser", () => {
  it("maps posts and drops removed or NSFW ones", () => {
    const rows = parseListing({
      data: {
        children: [
          { data: { name: "t3_a", permalink: "/r/googlephotos/comments/a/x/", created_utc: 1735689600, title: "Can't find a screenshot", selftext: "Searched 'ticket', nothing", subreddit: "googlephotos" } },
          { data: { name: "t3_b", permalink: "/r/x/b", created_utc: 1, title: "t", selftext: "[removed]" } },
          { data: { name: "t3_c", permalink: "/r/x/c", created_utc: 1, title: "t", selftext: "x", over_18: true } },
        ],
      },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ source: "Reddit", date: "2025-01-01", sourceUrl: "https://www.reddit.com/r/googlephotos/comments/a/x/" });
  });
});

describe("CSV output", () => {
  it("round-trips through the importer, including commas, quotes and newlines", () => {
    const csv = toCsv([{ source: "Reddit", sourceUrl: "https://x.test/1", date: "2025-01-01", title: 'He said "hi", ok', text: "line 1\nline 2", rating: 3 }]);
    const { conversations } = parseConversationsCsv(csv, "b");
    expect(conversations[0]).toMatchObject({ title: 'He said "hi", ok', text: "line 1\nline 2", rating: 3, sourceUrl: "https://x.test/1" });
  });

  it("strips HTML to text", () => {
    expect(stripHtml("<div>a&nbsp;b</div><div>c &amp; d</div>")).toBe("a b\nc & d");
  });
});

describe("screening real-world phrasing", () => {
  it.each([
    ["Half of my date searches now return zero results.", true],
    ["Why the heck can't we search for albums when trying to add media??", true],
    ["Great app, just wish I could search by day of the week for my photos.", true],
    ["I enjoy how they categorize pics. Makes it easy to find a photo.", false],
    ["I cannot find anywhere in my settings to unsync my photos.", false],
    ["I lost a lot of holiday photos because of the sync.", false],
  ])("%s → %s", (text, expected) => {
    expect(isRetrievalRelevant(text)).toBe(expected);
  });

  it("collector pre-filter is looser than the screen (recall first)", () => {
    expect(looksRetrievalRelated("Makes it easy to find a photo")).toBe(true);
  });
});
