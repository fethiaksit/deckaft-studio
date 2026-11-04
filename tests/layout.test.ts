import { test } from "node:test";
import assert from "node:assert/strict";
import { isTabletLayout } from "../src/core/theme/layout";
test("phones retain phone tools in landscape while iPad mini gets a tablet panel", () => {
  assert.equal(isTabletLayout(393, 852), false);
  assert.equal(isTabletLayout(852, 393), false);
  assert.equal(isTabletLayout(744, 1133), true);
  assert.equal(isTabletLayout(1133, 744), true);
  assert.equal(isTabletLayout(430, 1024), false);
});
