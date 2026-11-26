export const shopCodes = ["crowdgames", "lavkaigr", "gaga"] as const;
export type ShopCode = (typeof shopCodes)[number];

export type ShopProduct = {
  shop: ShopCode;
  /** The shop's own product ID. */
  externalId: string;
  /** Absolute URL of the product page. */
  url: string;
  /** Title as the shop writes it, trimmed. */
  title: string;
  vendor: string | null;
  barcode: string | null;
  /** Whole rubles. */
  price: number | null;
  /** The shop's own crossed-out price. */
  oldPrice: number | null;
  /** `null` when the source does not say. */
  available: boolean | null;
  /** 1 unless the shop exposes several purchasable variants. */
  variantCount: number;
};

/** `names` includes `primaryName` and is de-duplicated. */
export type GameNames = { bggId: number; primaryName: string; names: string[] };

export type Get = (url: string, opts?: { encoding?: "utf-8" | "windows-1251" }) => Promise<string>;

export type CatalogOptions = {
  known?: ShopProduct[];
  limit?: number;
  onProgress?: (done: number, total: number | null) => void;
};

export type ShopAdapter = {
  code: ShopCode;
  origin: string;
  listCatalog: (get: Get, opts?: CatalogOptions) => Promise<ShopProduct[]>;
};
