import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeDiscountPercent,
  discountCallouts,
  formatPercentOff,
  parsePriceNumber,
} from "./discount";
import { generateVariations } from "./generate";
import type { ProductDraft } from "./types";

describe("parsePriceNumber", () => {
  it("parses pt-BR and plain decimals", () => {
    assert.equal(parsePriceNumber("72,90"), 72.9);
    assert.equal(parsePriceNumber("R$ 1.299,00"), 1299);
    assert.equal(parsePriceNumber("99.90"), 99.9);
    assert.equal(parsePriceNumber(""), null);
    assert.equal(parsePriceNumber("abc"), null);
  });
});

describe("computeDiscountPercent", () => {
  it("returns rounded integer % when original > current", () => {
    assert.equal(computeDiscountPercent("50", "100"), 50);
    assert.equal(computeDiscountPercent("33,00", "100,00"), 67);
    assert.equal(computeDiscountPercent("72,90", "149,90"), 51);
  });

  it("returns null without a real discount", () => {
    assert.equal(computeDiscountPercent("100", "100"), null);
    assert.equal(computeDiscountPercent("100", "80"), null);
    assert.equal(computeDiscountPercent("50", ""), null);
    assert.equal(computeDiscountPercent("", "100"), null);
  });
});

describe("formatPercentOff", () => {
  it("uses exact label for round tens and soft quase when close", () => {
    assert.equal(formatPercentOff(50, "exact"), "50% OFF");
    assert.equal(formatPercentOff(50, "soft"), "50% OFF");
    assert.equal(formatPercentOff(67, "soft"), "quase 70% OFF");
    assert.equal(formatPercentOff(68, "soft"), "quase 70% OFF");
    assert.equal(formatPercentOff(52, "soft"), "52% OFF");
  });
});

describe("discountCallouts", () => {
  it("returns five distinct hooks with discount", () => {
    const hooks = discountCallouts("Creatina 300g", 50);
    assert.equal(hooks.length, 5);
    assert.equal(hooks[0], "Creatina 300g 50% OFF");
    assert.match(hooks[1], /PROMOÇÃO DO DIA/i);
    assert.ok(new Set(hooks).size === 5);
  });

  it("returns empty hooks without discount", () => {
    assert.deepEqual(discountCallouts("X", null), ["", "", "", "", ""]);
  });
});

describe("generateVariations", () => {
  const base: ProductDraft = {
    affiliateLink: "https://mercadolivre.com/sec/abc",
    name: "Creatina 300g",
    price: "49,90",
    originalPrice: "",
    freeShipping: true,
    fastDelivery: false,
    category: "",
  };

  it("keeps neutral copy when there is no discount", () => {
    const vars = generateVariations(base);
    assert.equal(vars.length, 5);
    for (const v of vars) {
      assert.doesNotMatch(v.text, /%\s*OFF/i);
      assert.match(v.text, /Creatina 300g/);
      assert.match(v.text, /https:\/\/mercadolivre\.com\/sec\/abc/);
    }
    assert.match(vars[0].text, /preço ABSURDO/i);
  });

  it("weaves distinct % OFF callouts into every variation", () => {
    const vars = generateVariations({
      ...base,
      originalPrice: "99,80",
    });
    assert.equal(vars.length, 5);
    assert.match(vars[0].text, /Creatina 300g 50% OFF/);
    assert.match(vars[1].text, /PROMOÇÃO DO DIA/i);
    assert.match(vars[1].text, /50%\s*OFF/i);
    assert.match(vars[2].text, /50%\s*OFF/i);
    assert.match(vars[3].text, /Em promoção/i);
    assert.match(vars[4].text, /Desconto absurdo/i);
    for (const v of vars) {
      assert.match(v.text, /https:\/\/mercadolivre\.com\/sec\/abc/);
    }
  });
});
