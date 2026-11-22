"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type SelectedSku = { skuId: string | undefined; setSkuId: (id: string) => void };

const SelectedSkuContext = createContext<SelectedSku | null>(null);

/**
 * Shares the picked size (SKU) between the size picker and the photo gallery
 * on the product page, so picking "2 kg" also shows the 2 kg photo (BUN-171).
 * Wrap the product page in it; the server-rendered parts inside stay server
 * components.
 */
export function SelectedSkuProvider({
  initialSkuId,
  children,
}: {
  initialSkuId: string | undefined;
  children: ReactNode;
}) {
  const [skuId, setSkuId] = useState(initialSkuId);
  return (
    <SelectedSkuContext.Provider value={{ skuId, setSkuId }}>
      {children}
    </SelectedSkuContext.Provider>
  );
}

/** The picked size. Outside a provider it keeps its own state. */
export function useSelectedSku(initialSkuId: string | undefined): SelectedSku {
  const shared = useContext(SelectedSkuContext);
  const [skuId, setSkuId] = useState(initialSkuId);
  return shared ?? { skuId, setSkuId };
}
