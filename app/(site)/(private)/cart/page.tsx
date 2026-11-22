import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { BagIcon, EmptyState, buttonClasses } from "@/components/ui";
import { CartContents } from "@/features/cart";
import { CategorySuggestions } from "@/features/catalog/CategorySuggestions";

// Cart: client-side. The page frame has no user data; the cart is read from
// the visitor's own browser storage, so no cart is ever cached on the server.

export const metadata: Metadata = { title: "Cart" };

export default function CartPage() {
  return (
    <Container width="content" className="flex flex-col gap-6 py-8 md:py-12">
      <PageHeader title="Your cart" />
      <CartContents
        empty={
          <EmptyState
            icon={<BagIcon size={32} />}
            title="Your cart is empty"
            description={<p>Browse our categories and add something you like.</p>}
            actions={
              <Link href="/" className={buttonClasses()}>
                Start shopping
              </Link>
            }
          >
            <CategorySuggestions title="Shop by category" />
          </EmptyState>
        }
        footer={
          <Link
            href="/checkout"
            className={buttonClasses({ className: "self-stretch sm:self-end" })}
          >
            Go to checkout
          </Link>
        }
      />
    </Container>
  );
}
