// Run: node lib/__tests__/figure.test.mjs
import assert from "node:assert/strict";
import { figureAt, parseFigure, sameShape } from "../figure.ts";

const at = (printed, progress, from) =>
  figureAt(parseFigure(printed), progress, from === undefined ? undefined : parseFigure(from));

{
  assert.equal(parseFigure("—"), null, "nothing to count in a figure with no number");
  assert.equal(parseFigure(""), null);
}

{
  assert.equal(at("18,975", 0), "0", "a count starts from zero");
  assert.equal(at("18,975", 0.5), "9,488", "keeps the grouping on the way up");
  assert.equal(at("18,975", 1), "18,975", "and lands exactly on the printed figure");
  assert.equal(at("27,851,381", 1), "27,851,381");
}

{
  assert.equal(at("27.9m", 0), "0.0m", "keeps the decimals and the unit");
  assert.equal(at("27.9m", 0.25), "7.0m");
  assert.equal(at("27.9m", 1), "27.9m");
  assert.equal(at("8h", 0.5), "4h");
  assert.equal(at("45%", 1), "45%");
}

{
  assert.equal(at("291 / 221", 0.5), "146 / 111", "every number of the figure counts");
  assert.equal(at("291 / 221", 1), "291 / 221");
}

{
  assert.equal(at("6834", 0.5), "3417", "a figure printed without grouping stays without it");
}

{
  assert.equal(at("300 / 230", 0, "291 / 221"), "291 / 221", "a change starts from the old value");
  assert.equal(at("300 / 230", 0.5, "291 / 221"), "296 / 226");
  assert.equal(at("1,000", 0.5, "980"), "990", "and takes the new figure's grouping");
  assert.equal(at("12", 0.5, "20"), "16", "counts down as well as up");
}

{
  const shape = (a, b) => sameShape(parseFigure(a), parseFigure(b));
  assert.equal(shape("291 / 221", "300 / 230"), true);
  assert.equal(shape("980", "1,000"), true, "grouping is not part of the shape");
  assert.equal(shape("980k", "1.2m"), false, "a figure that changed unit cannot count across");
  assert.equal(shape("23h", "1d"), false);
  assert.equal(shape("12", "12 / 4"), false);
}

console.log("figure: ok");
