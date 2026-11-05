// Run: node lib/__tests__/comments.test.mjs
import assert from "node:assert/strict";
import { appendPage, firstPageWithItems, refreshFirstPage } from "../comments.ts";

const comment = (id, extra = {}) => ({ commentId: id, deletedAt: null, ...extra });
const page = (ids, nextCursor, extra = {}) => ({
  items: ids.map((id) => (typeof id === "string" ? comment(id) : id)),
  authors: {},
  parents: {},
  nextCursor,
  hasMore: nextCursor !== null,
  ...extra,
});
const ids = (view) => view.items.map((c) => c.commentId);

// Load more appends, and the cursor moves on to the new page's.
{
  const view = appendPage(page(["c5", "c4"], "after-c4"), page(["c3", "c2"], "after-c2"));
  assert.deepEqual(ids(view), ["c5", "c4", "c3", "c2"]);
  assert.equal(view.nextCursor, "after-c2");
}

// A refresh that changed nothing keeps what Load more brought in, and where it continues from.
{
  const loaded = page(["c5", "c4", "c3", "c2"], "after-c2");
  const view = refreshFirstPage(loaded, page(["c5", "c4"], "after-c4"));
  assert.deepEqual(ids(view), ["c5", "c4", "c3", "c2"]);
  assert.equal(view.nextCursor, "after-c2");
  assert.equal(view.hasMore, true);
}

// A removal on the first page shows, in place.
{
  const loaded = page(["c5", "c4", "c3"], null);
  const view = refreshFirstPage(loaded, page([comment("c5"), comment("c4", { deletedAt: "now" })], "after-c4"));
  assert.deepEqual(ids(view), ["c5", "c4", "c3"]);
  assert.equal(view.items[1].deletedAt, "now");
  assert.equal(view.hasMore, false, "the end of the thread was already on screen");
}

// A new comment on top pushes the last one off the first page; it stays on screen below.
{
  const loaded = page(["c5", "c4"], "after-c4");
  const view = refreshFirstPage(loaded, page(["c6", "c5"], "after-c5"));
  assert.deepEqual(ids(view), ["c6", "c5", "c4"]);
  assert.equal(view.nextCursor, "after-c4", "continues after the last row on screen");
}

// Only the first page on screen: the refreshed one replaces it, cursor and all.
{
  const view = refreshFirstPage(page(["c5", "c4"], "after-c4"), page(["c5", "c4"], "after-c4-again"));
  assert.equal(view.nextCursor, "after-c4-again");
}

// Lookups from both are kept, the refreshed ones winning.
{
  const loaded = page(["c5", "c4"], null, { authors: { u1: "old", u2: "kept" } });
  const view = refreshFirstPage(loaded, page(["c5"], null, { authors: { u1: "new" } }));
  assert.deepEqual(view.authors, { u1: "new", u2: "kept" });
}

// Answers from a script of pages, and remembers the cursors it was asked with.
const scripted = (...pages) => {
  const asked = [];
  return {
    asked,
    fetchPage: async (cursor) => {
      asked.push(cursor);
      return pages[asked.length - 1];
    },
  };
};

// An empty page with more behind it is not an answer: the row that was removed is further down.
{
  const { asked, fetchPage } = scripted(page([], "c1"), page([], "c2"), page(["c9"], "c3"));
  const found = await firstPageWithItems(fetchPage, null, 5);
  assert.deepEqual(ids(found), ["c9"]);
  assert.equal(found.nextCursor, "c3");
  assert.deepEqual(asked, [null, "c1", "c2"]);
}

// A page with something in it is the answer, however little it holds.
{
  const { asked, fetchPage } = scripted(page(["c9"], "c1"));
  await firstPageWithItems(fetchPage, "start", 5);
  assert.deepEqual(asked, ["start"], "starts from the cursor it was given, and asks once");
}

// Empty with nothing behind it is the one page that really does mean none.
{
  const { asked, fetchPage } = scripted(page([], null));
  const found = await firstPageWithItems(fetchPage, null, 5);
  assert.equal(found.hasMore, false);
  assert.equal(asked.length, 1);
}

// The walk is bounded, and what it hands back still says there is more to look through.
{
  const { asked, fetchPage } = scripted(page([], "c1"), page([], "c2"), page([], "c3"));
  const found = await firstPageWithItems(fetchPage, null, 3);
  assert.equal(asked.length, 3);
  assert.equal(found.items.length, 0);
  assert.equal(found.hasMore, true);
  assert.equal(found.nextCursor, "c3", "so the next click carries on from here");
}

console.log("comments checks passed");
