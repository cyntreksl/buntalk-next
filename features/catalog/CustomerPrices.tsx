"use client";

import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, type ReactNode } from "react";
import type { PersonalPrices } from "@/app/api/prices/route";
import { useSessionStatus } from "@/components/layout/header/AccountMenu";
import { personalPriceFor } from "@/lib/offers";

const CustomerPricesContext = createContext<PersonalPrices["prices"] | null>(null);

/**
 * Loads the signed-in customer's own prices for these products (BUN-174), in
 * one request per grid, so cards and the product page can show "Your price".
 * Cached pages keep the online prices; nothing is asked for a visitor who
 * isn't signed in.
 */
export function CustomerPricesProvider({
  slugs,
  children,
}: {
  slugs: string[];
  children: ReactNode;
}) {
  const session = useSessionStatus();
  const key = [...slugs].sort().join(",");
  const prices = useQuery({
    queryKey: ["customer-prices", key],
    enabled: session.data?.signedIn === true && slugs.length > 0,
    queryFn: async (): Promise<PersonalPrices> => {
      const res = await fetch(`/api/prices?slugs=${encodeURIComponent(key)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Could not load prices");
      return res.json();
    },
    staleTime: 60_000,
  });
  const value = prices.data?.personal ? prices.data.prices : null;
  return <CustomerPricesContext.Provider value={value}>{children}</CustomerPricesContext.Provider>;
}

/**
 * The signed-in customer's price for a product (and size), or undefined.
 * Without a size, a product with sizes gives its lowest size price (as cards
 * show "From …").
 */
export function usePersonalPrice(slug: string, skuId?: string): number | undefined {
  return personalPriceFor(useContext(CustomerPricesContext)?.[slug], skuId);
}
