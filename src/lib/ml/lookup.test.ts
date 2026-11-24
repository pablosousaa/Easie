import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cleanProductName,
  extractMlId,
  extractMlIdFromHtml,
  formatPrice,
  parseEmbeddedMlPrices,
  priceFromTitle,
} from "./lookup";

describe("formatPrice", () => {
  it("formats BR currency decimals", () => {
    assert.equal(formatPrice(34), "34,00");
    assert.equal(formatPrice(59.99), "59,99");
  });
});

describe("cleanProductName / priceFromTitle", () => {
  it("strips trailing R$ from share titles", () => {
    const raw =
      "Kit 4 Capa Almofada Natal Papai Noel Decoração Natalina Vermelho - R$ 34";
    assert.equal(
      cleanProductName(raw),
      "Kit 4 Capa Almofada Natal Papai Noel Decoração Natalina Vermelho",
    );
    assert.equal(priceFromTitle(raw), 34);
  });

  it("parses comma decimals in titles", () => {
    assert.equal(priceFromTitle("Produto — R$ 59,99"), 59.99);
  });
});

describe("parseEmbeddedMlPrices", () => {
  it("reads previous_price + current_price from social HTML", () => {
    const html = `{"type":"price","id":"price","price":{"previous_price":{"value":59.99,"currency":"BRL"},"current_price":{"value":34,"currency":"BRL"},"discount_pct":43}}`;
    assert.deepEqual(parseEmbeddedMlPrices(html), {
      price: 34,
      originalPrice: 59.99,
    });
  });

  it("reads current_price alone", () => {
    const html = `"current_price":{"value":44.9,"currency":"BRL"}`;
    assert.deepEqual(parseEmbeddedMlPrices(html), {
      price: 44.9,
      originalPrice: null,
    });
  });
});

describe("extractMlId / extractMlIdFromHtml", () => {
  it("extracts MLB from product URLs", () => {
    assert.equal(
      extractMlId("https://www.mercadolivre.com.br/foo-MLB1234567890"),
      "MLB1234567890",
    );
  });

  it("extracts MLB from og:image CDN urls", () => {
    const html = `<meta property="og:image" content="https://http2.mlstatic.com/D_NQ_NP_903183-MLB116018559557_082026-P.webp"/>`;
    assert.equal(extractMlIdFromHtml(html), "MLB116018559557");
  });
});
