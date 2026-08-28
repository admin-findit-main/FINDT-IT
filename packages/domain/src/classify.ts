/**
 * Rule-based request classification. Swap this module later for AI;
 * routing still consumes ClassificationResult.
 */

import {
  FINDIT_CATALOG,
  catalogTypeByProductCategory,
  flattenCatalogKeywords,
  normalizeCatalogText,
  type CatalogBusinessType,
  type CatalogCategory,
  type CatalogSubcategory,
} from "./catalog";

export type ClassificationStatus = "confident" | "needs_confirm";
export type MatchKind = "keyword" | "subcategory" | "category" | "business_type";

export interface ClassificationResult {
  status: ClassificationStatus;
  productCategory: string | null;
  businessTypeId: string | null;
  businessTypeName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  subcategoryId: string | null;
  subcategoryName: string | null;
  keywordIds: string[];
  matchedKeywords: string[];
  confidence: "high" | "medium" | "low";
  reason: string;
  alternatives: Array<{
    businessTypeId: string;
    businessTypeName: string;
    productCategory: string;
    categoryName: string | null;
  }>;
}

interface Hit {
  score: number;
  type: CatalogBusinessType;
  category: CatalogCategory;
  subcategory: CatalogSubcategory | null;
  keywordId: string;
  keyword: string;
  quality: string;
}

const INDEX = flattenCatalogKeywords()
  .map((row) => ({
    ...row,
    needle: normalizeCatalogText(row.keyword.keyword),
  }))
  .sort((a, b) => b.needle.length - a.needle.length);

function includesToken(haystack: string, needle: string): boolean {
  if (!needle) return false;
  if (needle.includes(" ")) return haystack.includes(needle);
  return new RegExp(`(?:^|\\s)${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$)`).test(
    haystack
  );
}

function qualityScore(quality: string): number {
  if (quality === "brand") return 8;
  if (quality === "phrase") return 5;
  return 2;
}

export function classifyRequest(input: {
  productName?: string | null;
  description?: string | null;
  category?: string | null;
  confirmed?: boolean;
}): ClassificationResult {
  const haystack = normalizeCatalogText(
    `${input.productName || ""} ${input.description || ""}`
  );
  const empty: ClassificationResult = {
    status: "needs_confirm",
    productCategory: input.category?.trim() || null,
    businessTypeId: null,
    businessTypeName: null,
    categoryId: null,
    categoryName: null,
    subcategoryId: null,
    subcategoryName: null,
    keywordIds: [],
    matchedKeywords: [],
    confidence: "low",
    reason: "No catalog match. Ask the customer to confirm a category.",
    alternatives: [],
  };

  const hits: Hit[] = [];
  for (const row of INDEX) {
    if (!includesToken(haystack, row.needle)) continue;
    if (row.keyword.requiresAny?.length) {
      const ok = row.keyword.requiresAny.some((w) =>
        includesToken(haystack, normalizeCatalogText(w))
      );
      if (!ok) continue;
    }
    hits.push({
      score: qualityScore(row.keyword.quality) + Math.min(row.needle.length, 6) * 0.15,
      type: row.type,
      category: row.category,
      subcategory: row.subcategory,
      keywordId: row.keyword.id,
      keyword: row.keyword.keyword,
      quality: row.keyword.quality,
    });
  }

  const byType = new Map<string, Hit[]>();
  for (const hit of hits) {
    const list = byType.get(hit.type.id) || [];
    list.push(hit);
    byType.set(hit.type.id, list);
  }

  const ranked = [...byType.entries()]
    .map(([typeId, list]) => ({
      typeId,
      list,
      score: list.reduce((sum, h) => sum + h.score, 0),
      type: list[0].type,
    }))
    .sort((a, b) => b.score - a.score);

  const chosenCategory = catalogTypeByProductCategory(input.category || "");
  if (input.confirmed && chosenCategory) {
    const list = byType.get(chosenCategory.id) || [];
    const best = list.sort((a, b) => b.score - a.score)[0];
    return {
      status: "confident",
      productCategory: chosenCategory.productCategory,
      businessTypeId: chosenCategory.id,
      businessTypeName: chosenCategory.name,
      categoryId: best?.category.id || chosenCategory.categories[0]?.id || null,
      categoryName: best?.category.name || chosenCategory.categories[0]?.name || null,
      subcategoryId: best?.subcategory?.id || null,
      subcategoryName: best?.subcategory?.name || null,
      keywordIds: list.map((h) => h.keywordId),
      matchedKeywords: list.map((h) => h.keyword),
      confidence: list.some((h) => h.quality === "brand" || h.quality === "phrase")
        ? "high"
        : "medium",
      reason: `Customer confirmed ${chosenCategory.productCategory}.`,
      alternatives: [],
    };
  }

  if (!ranked.length) {
    if (chosenCategory) {
      return {
        ...empty,
        status: input.confirmed ? "confident" : "needs_confirm",
        productCategory: chosenCategory.productCategory,
        businessTypeId: chosenCategory.id,
        businessTypeName: chosenCategory.name,
        categoryId: chosenCategory.categories[0]?.id || null,
        categoryName: chosenCategory.categories[0]?.name || null,
        confidence: input.confirmed ? "medium" : "low",
        reason: input.confirmed
          ? `Customer selected ${chosenCategory.productCategory}.`
          : `No keyword match. Confirm ${chosenCategory.productCategory}?`,
      };
    }
    return empty;
  }

  const top = ranked[0];
  const second = ranked[1];
  const bestHit = [...top.list].sort((a, b) => b.score - a.score)[0];
  const uniqueTypes = ranked.length === 1;
  const strong =
    uniqueTypes &&
    top.list.some((h) => h.quality === "brand" || h.quality === "phrase");
  const closeSecond = second && second.score >= top.score * 0.75;
  const needsConfirm = !strong || Boolean(closeSecond);

  const alternatives = ranked.slice(0, 3).map((row) => ({
    businessTypeId: row.type.id,
    businessTypeName: row.type.name,
    productCategory: row.type.productCategory,
    categoryName: row.list.sort((a, b) => b.score - a.score)[0]?.category.name || null,
  }));

  const result: ClassificationResult = {
    status: needsConfirm ? "needs_confirm" : "confident",
    productCategory: top.type.productCategory,
    businessTypeId: top.type.id,
    businessTypeName: top.type.name,
    categoryId: bestHit.category.id,
    categoryName: bestHit.category.name,
    subcategoryId: bestHit.subcategory?.id || null,
    subcategoryName: bestHit.subcategory?.name || null,
    keywordIds: top.list.map((h) => h.keywordId),
    matchedKeywords: top.list.map((h) => h.keyword),
    confidence: strong ? "high" : uniqueTypes ? "medium" : "low",
    reason: strong
      ? `Matched ${bestHit.keyword} → ${top.type.name} / ${bestHit.category.name}.`
      : closeSecond
        ? `Ambiguous between ${top.type.name} and ${second.type.name}.`
        : `Likely ${top.type.name} / ${bestHit.category.name}. Confirm before routing.`,
    alternatives,
  };

  if (chosenCategory && chosenCategory.id !== top.type.id && !input.confirmed) {
    result.status = "needs_confirm";
    result.confidence = "low";
    result.reason = `Keywords suggest ${top.type.name}, customer chip is ${chosenCategory.productCategory}.`;
  }

  return result;
}

export function classificationLabel(result: ClassificationResult): string {
  if (!result.businessTypeName) return "Choose a category";
  if (result.categoryName && result.businessTypeName !== result.categoryName) {
    return `${result.businessTypeName} → ${result.categoryName}`;
  }
  return result.businessTypeName;
}

export function matchKindForStore(input: {
  classification: ClassificationResult;
  store: {
    businessTypeId?: string | null;
    catalogCategoryIds?: string[];
    catalogSubcategoryIds?: string[];
    catalogKeywordIds?: string[];
    customKeywords?: string[];
    categories?: string[];
  };
}): MatchKind | null {
  const c = input.classification;
  if (!c.businessTypeId && !c.productCategory) return null;
  const cats = input.store.catalogCategoryIds || [];
  const subs = input.store.catalogSubcategoryIds || [];
  const keys = input.store.catalogKeywordIds || [];
  const custom = (input.store.customKeywords || []).map(normalizeCatalogText);
  const legacy = (input.store.categories || []).map((x) => x.toLowerCase());

  const keywordHit =
    c.keywordIds.some((id) => keys.includes(id)) ||
    c.matchedKeywords.some((word) => custom.includes(normalizeCatalogText(word)));
  if (keywordHit) return "keyword";
  if (c.subcategoryId && subs.includes(c.subcategoryId)) return "subcategory";
  if (c.categoryId && cats.includes(c.categoryId)) return "category";
  if (c.businessTypeId && input.store.businessTypeId === c.businessTypeId) {
    if (cats.length === 0) return "business_type";
    if (c.categoryId && cats.includes(c.categoryId)) return "category";
    return null;
  }
  if (c.productCategory && legacy.includes(c.productCategory.toLowerCase())) {
    return "category";
  }
  const type = FINDIT_CATALOG.find((t) => t.id === c.businessTypeId);
  if (type && legacy.includes(type.storeCategory.toLowerCase())) return "business_type";
  return null;
}
