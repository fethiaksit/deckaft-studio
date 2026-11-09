import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateCutting } from "../src/modules/cutting/engine";
import { member, plan } from "./cutting-fixtures";
test("3000 + 3000 cannot share a 6000 stock with 3 mm kerf", () => {
  const result = estimateCutting(plan([member("A", 3000), member("B", 3000)]));
  assert.equal(result.stocks.length, 2);
  assert.equal(result.totalKerfMm, 6);
  assert.equal(result.totalRemainderMm, 5994);
  assert.equal(result.validForFabrication, false);
});
test("2450 + 1800 + 1700 fit with three kerfs", () => {
  const result = estimateCutting(
    plan([member("A", 2450), member("B", 1800), member("C", 1700)]),
  );
  assert.equal(result.stocks.length, 1);
  assert.equal(result.totalRemainderMm, 41);
});
test("different profile sections never mix", () => {
  const result = estimateCutting(
    plan([member("A", 1500), member("B", 1500, { wall: 3 })]),
  );
  assert.equal(result.stocks.length, 2);
  assert.equal(result.groups.length, 2);
});
test("unresolved long member is excluded, never automatically split", () => {
  const result = estimateCutting(plan([member("A", 7200), member("B", 1200)]));
  assert.equal(result.exclusions.length, 1);
  assert.equal(result.exclusions[0]?.memberId, "A");
  assert.equal(result.totalPieceMm, 1200);
  assert.equal(result.allMembersIncluded, false);
});
test("splice flagged even on short member is excluded", () => {
  const result = estimateCutting(plan([member("A", 2500, { splice: true })]));
  assert.equal(result.exclusions.length, 1);
});
test("invalid measured length is excluded", () => {
  const result = estimateCutting(
    plan([{ ...member("A", 2000), lengthMm: 1990 }]),
  );
  assert.equal(result.exclusions.length, 1);
});
test("invalid kerf is rejected", () => {
  const p = plan([member("A", 1500)]);
  p.settings.kerfMm = -1;
  assert.throws(() => estimateCutting(p), /testere/i);
});
test("same input produces identical estimate", () => {
  const p = plan([member("A", 1200), member("B", 2200), member("C", 1400)]);
  assert.deepEqual(estimateCutting(p), estimateCutting(p));
});

test("exact search improves a known BFD counterexample and certifies minimum stocks", () => {
  const p = plan(
    [3600, 3000, 1800, 1200, 1200, 1200].map((n, i) => member(String(i), n)),
  );
  p.settings.kerfMm = 0;
  const r = estimateCutting(p);
  assert.equal(r.stocks.length, 2);
  assert.equal(r.optimizationStatus, "optimal");
  assert.equal(r.minimumStockCount, 2);
});
test("bounded search reports feasible rather than claiming an unproven minimum", () => {
  const p = plan(
    [3600, 3000, 1800, 1200, 1200, 1200].map((n, i) => member(String(i), n)),
  );
  p.settings.kerfMm = 0;
  const r = estimateCutting(p, { maxSearchNodes: 0 });
  assert.equal(r.stocks.length, 3);
  assert.equal(r.optimizationStatus, "feasible");
  assert.equal(r.minimumStockCount, null);
  assert.equal(r.stockLowerBound, 2);
});
test("trim cuts, reusable remnants and sawdust balance purchased material", () => {
  const r = estimateCutting(
    plan([member("a", 2450), member("b", 1800), member("c", 1700)]),
    { startTrimMm: 5, endTrimMm: 5, minReusableMm: 500 },
  );
  assert.equal(r.totalTrimMm, 10);
  assert.equal(r.totalKerfMm, 15);
  assert.equal(r.totalRemainderMm, 25);
  assert.equal(r.totalWasteMm, 50);
  assert.equal(r.remnants.length, 0);
  const reuse = estimateCutting(plan([member("a", 3000)]), {
    minReusableMm: 500,
  });
  assert.equal(reuse.remnants.length, 1);
  assert.equal(reuse.totalReusableMm, 2997);
  assert.equal(reuse.totalWasteMm, 3);
  assert.equal(
    reuse.totalPurchasedMm,
    reuse.totalPieceMm + reuse.totalReusableMm + reuse.totalWasteMm,
  );
  const short = estimateCutting(plan([member("a", 3000)]), {
    minReusableMm: 3000,
  });
  assert.equal(short.totalWasteMm, 3000);
});
test("invalid input is separate from an empty uncomputed solution, with robust exclusions", () => {
  assert.equal(estimateCutting(plan([])).optimizationStatus, "not-computed");
  const a = member("bad", 1000);
  a.section.wallMm = 30;
  assert.equal(estimateCutting(plan([a])).optimizationStatus, "invalid-input");
  const b = member("nan", 1000);
  b.end.x = NaN;
  assert.equal(estimateCutting(plan([b])).optimizationStatus, "invalid-input");
  assert.equal(
    estimateCutting(plan([member("long", 7000)])).optimizationStatus,
    "not-computed",
  );
  const c = member("dup", 1000);
  assert.throws(
    () => estimateCutting(plan([c, { ...c, id: "other" }])),
    /kod/i,
  );
  assert.throws(() => estimateCutting(plan([c]), { minReusableMm: NaN }));
});
test("material, dimensions, wall and layers retain their identities", () => {
  const ms = [
    member("a", 1000),
    member("b", 1000),
    member("c", 1000),
    member("d", 1000),
  ];
  ms[1]!.section.material = "aluminium";
  ms[2]!.section.widthMm = 50;
  ms[3]!.section.wallMm = 3;
  const r = estimateCutting(plan(ms));
  assert.equal(r.groups.length, 4);
  assert.equal(r.stocks.length, 4);
  assert.equal(r.stocks[0]!.pieces[0]!.layer, "upper");
});
// Independent exhaustive assignment oracle: tries every bin, no production solver imports.
function oracle(lengths: number[], capacity: number, kerf: number): number {
  let best = lengths.length;
  const bins: number[] = [];
  function visit(i: number) {
    if (i === lengths.length) {
      best = Math.min(best, bins.length);
      return;
    }
    const need = lengths[i]! + kerf;
    for (let j = 0; j < bins.length; j++)
      if (bins[j]! + need <= capacity) {
        bins[j]! += need;
        visit(i + 1);
        bins[j]! -= need;
      }
    if (bins.length < best) {
      bins.push(need);
      visit(i + 1);
      bins.pop();
    }
  }
  visit(0);
  return best;
}
test("small exact results match an independent exhaustive oracle on seeded inputs", () => {
  let seed = 193;
  for (let k = 0; k < 80; k++) {
    const lengths = Array.from({ length: 4 + (k % 5) }, () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return 400 + (seed % 4700);
    });
    const r = estimateCutting(
      plan(lengths.map((n, i) => member(String(i), n))),
    );
    assert.equal(
      r.stocks.length,
      oracle(lengths, 6000, 3),
      JSON.stringify(lengths),
    );
    assert.equal(r.optimizationStatus, "optimal");
    assert.ok(
      Math.abs(
        r.totalPurchasedMm -
          r.totalPieceMm -
          r.totalWasteMm -
          r.totalReusableMm,
      ) < 1e-6,
    );
    assert.ok(r.stocks.every((b) => b.usedMm <= b.stockLengthMm));
  }
});
test("rounding cannot overfill a bar and exact 6000 requires a saw allowance", () => {
  const r = estimateCutting(
    plan([member("a", 2997.000001), member("b", 2997.000001)]),
  );
  assert.equal(r.stocks.length, 2);
  assert.equal(estimateCutting(plan([member("a", 6000)])).stocks.length, 0);
});
