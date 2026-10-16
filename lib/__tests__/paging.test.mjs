// Run: node lib/__tests__/paging.test.mjs
import assert from "node:assert/strict";
import { collectPages } from "../paging.ts";

/** A listing of `total` numbered rows, served `size` at a time, recording what it was asked. */
function listing(total, size) {
  const asked = [];
  const load = async (page) => {
    asked.push(page);
    const content = Array.from({ length: total }, (_, i) => i).slice(page * size, page * size + size);
    return { content, totalElements: total, totalPages: Math.ceil(total / size), number: page, size };
  };
  return { asked, load };
}

// Reads every page in order and stops at the last one.
{
  const { asked, load } = listing(120, 50);
  const result = await collectPages(load, { maxRows: 1000 });
  assert.equal(result.rows.length, 120);
  assert.equal(result.rows[119], 119);
  assert.deepEqual(asked, [0, 1, 2]);
  assert.equal(result.truncated, false);
}

// The cap cuts mid-page and says so; an exact fit is not a cut.
{
  const { asked, load } = listing(120, 50);
  const capped = await collectPages(load, { maxRows: 70 });
  assert.equal(capped.rows.length, 70);
  assert.deepEqual(capped, { ...capped, total: 120, truncated: true });
  assert.deepEqual(asked, [0, 1], "no page is read past the cap");
  const exact = await collectPages(listing(100, 50).load, { maxRows: 100 });
  assert.equal(exact.truncated, false);
}

// Nothing matching is one request and no rows.
{
  const { asked, load } = listing(0, 50);
  assert.deepEqual(await collectPages(load, { maxRows: 10 }), { rows: [], total: 0, truncated: false });
  assert.deepEqual(asked, [0]);
}

// Paced: a pause before every page after the first, none before it.
{
  const pauses = [];
  await collectPages(listing(120, 50).load, {
    maxRows: 1000,
    pauseMs: 100,
    sleep: async (ms) => void pauses.push(ms),
  });
  assert.deepEqual(pauses, [100, 100]);
}

console.log("paging checks passed");
