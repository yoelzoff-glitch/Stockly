import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { parseCompetitorUrl } from "../../src/services/meli/competitor/urlParser";
import { CompetitorAnalysisError } from "../../src/services/meli/competitor/types";

describe("Sprint: Competitor URL Parser Unit Tests", () => {
  test("parses standard MLA direct ID", () => {
    const result = parseCompetitorUrl("MLA1234567890");
    assert.equal(result.itemId, "MLA1234567890");
    assert.equal(result.probableType, "item");
    assert.equal(result.hasWid, false);
    assert.equal(result.siteId, "MLA");
  });

  test("parses MLA with hyphen (MLA-1234567890)", () => {
    const result = parseCompetitorUrl("MLA-1234567890");
    assert.equal(result.itemId, "MLA1234567890");
    assert.equal(result.probableType, "item");
    assert.equal(result.hasWid, false);
    assert.equal(result.siteId, "MLA");
  });

  test("parses standard Mercado Libre article URL", () => {
    const url = "https://articulo.mercadolibre.com.ar/MLA-1420556112-auriculares-inalambricos-bluetooth-_JM";
    const result = parseCompetitorUrl(url);
    assert.equal(result.itemId, "MLA1420556112");
    assert.equal(result.probableType, "item");
    assert.equal(result.hasWid, false);
  });

  test("parses URL with wid query parameter", () => {
    const url = "https://www.mercadolibre.com.ar/p/MLA19523456?wid=MLA1357924680&source=search";
    const result = parseCompetitorUrl(url);
    assert.equal(result.itemId, "MLA1357924680");
    assert.equal(result.hasWid, true);
    assert.equal(result.catalogProductId, "MLA19523456");
    assert.equal(result.probableType, "item"); // with wid, targeted item takes precedence
  });

  test("parses catalog URL with /p/", () => {
    const url = "https://www.mercadolibre.com.ar/p/MLA29481726";
    const result = parseCompetitorUrl(url);
    assert.equal(result.catalogProductId, "MLA29481726");
    assert.equal(result.probableType, "catalog");
    assert.equal(result.hasWid, false);
  });

  test("parses catalog URL with /up/", () => {
    const url = "https://www.mercadolibre.com.ar/up/MLA39581723";
    const result = parseCompetitorUrl(url);
    assert.equal(result.catalogProductId, "MLA39581723");
    assert.equal(result.probableType, "catalog");
  });

  test("parses catalog ID with MLAU prefix", () => {
    const result = parseCompetitorUrl("MLAU28491823");
    assert.equal(result.catalogProductId, "MLAU28491823");
    assert.equal(result.probableType, "catalog");
  });

  test("parses URL with complex tracking query strings and recommendations", () => {
    const url = "https://articulo.mercadolibre.com.ar/MLA-9876543210-termo-acero-1l-_JM?searchVariation=123#polycard_client=recommendations&recos_listing_type=default";
    const result = parseCompetitorUrl(url);
    assert.equal(result.itemId, "MLA9876543210");
    assert.equal(result.probableType, "item");
  });

  test("parses mobile link format", () => {
    const url = "http://articulo.mercadolibre.com.ar/MLA-3724535440-soporte-celular";
    const result = parseCompetitorUrl(url);
    assert.equal(result.itemId, "MLA3724535440");
    assert.equal(result.probableType, "item");
  });

  test("throws CompetitorAnalysisError for empty or invalid URL", () => {
    assert.throws(
      () => parseCompetitorUrl(""),
      (err: any) => {
        assert.ok(err instanceof CompetitorAnalysisError);
        assert.equal(err.competitorCode, "INVALID_COMPETITOR_URL");
        assert.equal(err.statusCode, 400);
        return true;
      }
    );

    assert.throws(
      () => parseCompetitorUrl("https://www.google.com/search?q=test"),
      (err: any) => {
        assert.ok(err instanceof CompetitorAnalysisError);
        assert.equal(err.competitorCode, "INVALID_COMPETITOR_URL");
        return true;
      }
    );
  });
});
