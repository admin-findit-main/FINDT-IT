/**
 * FINDIT V1 catalog — controlled business types, categories, and keywords.
 * Classification is rule-based (no AI). Add types here; routing stays the same.
 */

export type KeywordQuality = "brand" | "phrase" | "word";

export interface CatalogKeyword {
  id: string;
  keyword: string;
  quality: KeywordQuality;
  /** If set, this keyword only counts when one of these words is also present. */
  requiresAny?: string[];
}

export interface CatalogSubcategory {
  id: string;
  name: string;
  keywords: CatalogKeyword[];
}

export interface CatalogCategory {
  id: string;
  name: string;
  keywords: CatalogKeyword[];
  subcategories: CatalogSubcategory[];
}

export interface CatalogBusinessType {
  id: string;
  name: string;
  /** Customer-facing product category chip / request.category */
  productCategory: string;
  /** Store join / settings label (STORE_CATEGORIES) */
  storeCategory: string;
  ageRestricted?: boolean;
  categories: CatalogCategory[];
}

function k(
  id: string,
  keyword: string,
  quality: KeywordQuality = "word",
  requiresAny?: string[]
): CatalogKeyword {
  return { id, keyword, quality, requiresAny };
}

export const FINDIT_CATALOG: CatalogBusinessType[] = [
  {
    id: "smoke_shop",
    name: "Smoke Shop",
    productCategory: "Tobacco & Vape",
    storeCategory: "Smoke Shop",
    ageRestricted: true,
    categories: [
      {
        id: "vapes",
        name: "Vapes",
        keywords: [
          k("vape", "vape", "word"),
          k("vapes", "vapes", "word"),
          k("disposable", "disposable", "word", ["vape", "bar", "geek", "elf", "raz", "mary"]),
          k("disposables", "disposables", "phrase"),
          k("disposable_vape", "disposable vape", "phrase"),
          k("e_liquid", "e-liquid", "phrase"),
          k("e_liquid2", "e liquid", "phrase"),
          k("ejuice", "ejuice", "word"),
          k("pods", "pods", "word", ["vape", "elf", "geek", "juul"]),
          k("geek_bar", "geek bar", "brand"),
          k("raz", "raz", "brand", ["vape", "bar", "disposable"]),
          k("lost_mary", "lost mary", "brand"),
          k("elf_bar", "elf bar", "brand"),
          k("juicy_bar", "juicy bar", "brand"),
        ],
        subcategories: [
          {
            id: "disposable_vapes",
            name: "Disposables",
            keywords: [k("bc5000", "bc5000", "brand"), k("miami_mint", "miami mint", "phrase")],
          },
          {
            id: "vape_batteries",
            name: "Vape batteries",
            keywords: [
              k("18650", "18650", "phrase"),
              k("vape_battery", "vape battery", "phrase"),
            ],
          },
        ],
      },
      {
        id: "cigars",
        name: "Cigars",
        keywords: [
          k("cigar", "cigar", "word"),
          k("cigars", "cigars", "word"),
          k("cigarillo", "cigarillo", "word"),
        ],
        subcategories: [],
      },
      {
        id: "hookah",
        name: "Hookah",
        keywords: [k("hookah", "hookah", "word"), k("shisha", "shisha", "word")],
        subcategories: [],
      },
      {
        id: "smoke_snacks",
        name: "Snacks",
        keywords: [],
        subcategories: [],
      },
      {
        id: "smoke_drinks",
        name: "Drinks",
        keywords: [],
        subcategories: [],
      },
      {
        id: "smoke_accessories",
        name: "Accessories",
        keywords: [
          k("grinder", "grinder", "word"),
          k("bong", "bong", "word"),
          k("pipe", "pipe", "word", ["smoke", "tobacco", "weed"]),
        ],
        subcategories: [],
      },
      {
        id: "phone_accessories",
        name: "Phone Accessories",
        keywords: [
          k("phone_case_smoke", "phone case", "phrase"),
          k("charger_smoke", "charger", "word", ["phone", "iphone", "android"]),
        ],
        subcategories: [],
      },
    ],
  },
  {
    id: "coffee_shop",
    name: "Coffee Shop",
    productCategory: "Coffee",
    storeCategory: "Coffee Shop",
    categories: [
      {
        id: "coffee",
        name: "Coffee",
        keywords: [
          k("coffee", "coffee", "word"),
          k("espresso", "espresso", "word"),
          k("latte", "latte", "word"),
          k("cappuccino", "cappuccino", "word"),
          k("americano", "americano", "word"),
        ],
        subcategories: [],
      },
      {
        id: "tea",
        name: "Tea",
        keywords: [k("tea", "tea", "word"), k("chai", "chai", "word")],
        subcategories: [],
      },
      {
        id: "matcha",
        name: "Matcha",
        keywords: [k("matcha", "matcha", "word")],
        subcategories: [],
      },
      {
        id: "pastries",
        name: "Pastries",
        keywords: [
          k("pastry", "pastry", "word"),
          k("croissant", "croissant", "word"),
          k("muffin", "muffin", "word"),
        ],
        subcategories: [],
      },
      {
        id: "breakfast",
        name: "Breakfast",
        keywords: [k("breakfast", "breakfast", "word"), k("bagel", "bagel", "word")],
        subcategories: [],
      },
      {
        id: "cold_drinks",
        name: "Cold Drinks",
        keywords: [
          k("cold_brew", "cold brew", "phrase"),
          k("iced_coffee", "iced coffee", "phrase"),
        ],
        subcategories: [],
      },
    ],
  },
  {
    id: "auto_parts",
    name: "Auto Parts Store",
    productCategory: "Auto",
    storeCategory: "Auto Parts",
    categories: [
      {
        id: "brakes",
        name: "Brakes",
        keywords: [
          k("brake", "brake", "word"),
          k("brakes", "brakes", "word"),
          k("brake_pads", "brake pads", "phrase"),
          k("brake_rotors", "brake rotors", "phrase"),
        ],
        subcategories: [],
      },
      {
        id: "auto_batteries",
        name: "Batteries",
        keywords: [
          k("car_battery", "car battery", "phrase"),
          k("auto_battery", "auto battery", "phrase"),
          k("battery_honda", "battery", "word", [
            "honda",
            "civic",
            "accord",
            "toyota",
            "ford",
            "chevy",
            "car",
            "auto",
            "vehicle",
          ]),
        ],
        subcategories: [],
      },
      {
        id: "filters",
        name: "Filters",
        keywords: [
          k("oil_filter", "oil filter", "phrase"),
          k("air_filter", "air filter", "phrase"),
          k("cabin_filter", "cabin filter", "phrase"),
        ],
        subcategories: [],
      },
      {
        id: "lighting",
        name: "Lighting",
        keywords: [
          k("headlight", "headlight", "word"),
          k("taillight", "taillight", "word"),
          k("headlamp", "headlamp", "word"),
        ],
        subcategories: [],
      },
      {
        id: "engine_parts",
        name: "Engine Parts",
        keywords: [
          k("spark_plug", "spark plug", "phrase"),
          k("alternator", "alternator", "word"),
          k("starter", "starter", "word", ["car", "engine", "honda", "ford"]),
        ],
        subcategories: [],
      },
      {
        id: "auto_accessories",
        name: "Accessories",
        keywords: [k("wiper", "wiper", "word"), k("floor_mat", "floor mat", "phrase")],
        subcategories: [],
      },
    ],
  },
  {
    id: "nail_salon",
    name: "Nail Salon",
    productCategory: "Nails",
    storeCategory: "Nail Salon",
    categories: [
      {
        id: "manicure",
        name: "Manicure",
        keywords: [k("manicure", "manicure", "word"), k("mani", "mani", "word", ["pedi", "nail"])],
        subcategories: [],
      },
      {
        id: "pedicure",
        name: "Pedicure",
        keywords: [k("pedicure", "pedicure", "word"), k("pedi", "pedi", "word", ["mani", "nail"])],
        subcategories: [],
      },
      {
        id: "gel",
        name: "Gel",
        keywords: [k("gel_nails", "gel nails", "phrase"), k("gel_manicure", "gel manicure", "phrase")],
        subcategories: [],
      },
      {
        id: "acrylic",
        name: "Acrylic",
        keywords: [k("acrylic", "acrylic", "word", ["nail", "nails"])],
        subcategories: [],
      },
      {
        id: "nail_art",
        name: "Nail Art",
        keywords: [k("nail_art", "nail art", "phrase"), k("nails", "nails", "word")],
        subcategories: [],
      },
    ],
  },
  {
    id: "grocery",
    name: "Grocery",
    productCategory: "Grocery",
    storeCategory: "Grocery",
    categories: [
      {
        id: "grocery_goods",
        name: "Grocery",
        keywords: [k("grocery", "grocery", "word")],
        subcategories: [],
      },
    ],
  },
  {
    id: "convenience",
    name: "Convenience",
    productCategory: "Convenience",
    storeCategory: "Convenience",
    categories: [
      {
        id: "convenience_goods",
        name: "Convenience",
        keywords: [k("convenience", "convenience", "word")],
        subcategories: [],
      },
    ],
  },
  {
    id: "beauty",
    name: "Beauty",
    productCategory: "Beauty",
    storeCategory: "Beauty",
    categories: [
      {
        id: "beauty_goods",
        name: "Beauty",
        keywords: [k("beauty", "beauty", "word"), k("makeup", "makeup", "word")],
        subcategories: [],
      },
    ],
  },
  {
    id: "electronics",
    name: "Electronics",
    productCategory: "Electronics",
    storeCategory: "Electronics",
    categories: [
      {
        id: "electronics_goods",
        name: "Electronics",
        keywords: [
          k("electronics", "electronics", "word"),
          k("iphone", "iphone", "brand"),
          k("ipad", "ipad", "brand"),
        ],
        subcategories: [],
      },
    ],
  },
  {
    id: "clothing",
    name: "Clothing",
    productCategory: "Clothing",
    storeCategory: "Clothing",
    categories: [
      {
        id: "clothing_goods",
        name: "Clothing",
        keywords: [k("clothing", "clothing", "word"), k("nike", "nike", "brand")],
        subcategories: [],
      },
    ],
  },
  {
    id: "collectibles",
    name: "Collectibles",
    productCategory: "Collectibles",
    storeCategory: "Collectibles",
    categories: [
      {
        id: "collectibles_goods",
        name: "Collectibles",
        keywords: [k("collectible", "collectible", "word")],
        subcategories: [],
      },
    ],
  },
  {
    id: "hardware",
    name: "Hardware",
    productCategory: "Hardware",
    storeCategory: "Hardware",
    categories: [
      {
        id: "hardware_goods",
        name: "Hardware",
        keywords: [k("hardware", "hardware", "word")],
        subcategories: [],
      },
    ],
  },
  {
    id: "specialty_retail",
    name: "Specialty Retail",
    productCategory: "Specialty",
    storeCategory: "Specialty Retail",
    categories: [
      {
        id: "specialty_goods",
        name: "Specialty",
        keywords: [k("specialty", "specialty", "word")],
        subcategories: [],
      },
    ],
  },
  {
    id: "other",
    name: "Other",
    productCategory: "Other",
    storeCategory: "Other",
    categories: [
      {
        id: "other_goods",
        name: "Other",
        keywords: [],
        subcategories: [],
      },
    ],
  },
];

export function normalizeCatalogText(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function catalogTypeById(id: string | null | undefined) {
  if (!id) return null;
  return FINDIT_CATALOG.find((t) => t.id === id) || null;
}

export function catalogTypeByStoreCategory(label: string | null | undefined) {
  if (!label) return null;
  const key = label.trim().toLowerCase();
  return (
    FINDIT_CATALOG.find(
      (t) =>
        t.storeCategory.toLowerCase() === key ||
        t.name.toLowerCase() === key ||
        t.id === key.replace(/\s+/g, "_")
    ) || null
  );
}

export function catalogTypeByProductCategory(label: string | null | undefined) {
  if (!label) return null;
  const key = label.trim().toLowerCase();
  return (
    FINDIT_CATALOG.find((t) => t.productCategory.toLowerCase() === key) || null
  );
}

export function defaultCategoryIdsForType(typeId: string): string[] {
  const type = catalogTypeById(typeId);
  return type ? type.categories.map((c) => c.id) : [];
}

export function flattenCatalogKeywords() {
  const rows: Array<{
    keyword: CatalogKeyword;
    type: CatalogBusinessType;
    category: CatalogCategory;
    subcategory: CatalogSubcategory | null;
  }> = [];
  for (const type of FINDIT_CATALOG) {
    for (const category of type.categories) {
      for (const keyword of category.keywords) {
        rows.push({ keyword, type, category, subcategory: null });
      }
      for (const subcategory of category.subcategories) {
        for (const keyword of subcategory.keywords) {
          rows.push({ keyword, type, category, subcategory });
        }
      }
    }
  }
  return rows;
}
