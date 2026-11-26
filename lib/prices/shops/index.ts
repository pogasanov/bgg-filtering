import { crowdgamesAdapter } from "@/lib/prices/shops/crowdgames";
import { gagaAdapter } from "@/lib/prices/shops/gaga";
import { hobbygamesAdapter } from "@/lib/prices/shops/hobbygames";
import { lavkaigrAdapter } from "@/lib/prices/shops/lavkaigr";
import type { ShopAdapter } from "@/lib/prices/types";

export const shopAdapters: ShopAdapter[] = [crowdgamesAdapter, lavkaigrAdapter, gagaAdapter, hobbygamesAdapter];
