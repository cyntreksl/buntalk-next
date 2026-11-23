"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/Toast";
import { AuthSync } from "@/features/auth/AuthSync";
import { SignInDialog } from "@/features/auth/SignInDialog";
import { CartSync } from "@/features/cart/CartSync";
import { MiniCartDrawer } from "@/features/cart/MiniCartDrawer";
import { getQueryClient } from "@/lib/query-client";

export function Providers({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Saves the cart on the server and loads it back (BUN-175). */}
      <CartSync />
      {/* Opens after "Add to cart" (BUN-176). */}
      <MiniCartDrawer />
      {/* The shared sign-in dialog, and other tabs following sign-in and sign-out (BUN-186). */}
      <SignInDialog />
      <AuthSync />
      <Toaster />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
