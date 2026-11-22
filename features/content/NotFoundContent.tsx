import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { HeaderSearch } from "@/components/layout/header/HeaderSearch";
import { EmptyState, SearchIcon, buttonClasses } from "@/components/ui";
import { CategorySuggestions } from "@/features/catalog/CategorySuggestions";

/** 404 message with a search box and popular categories, shared by both not-found pages. */
export function NotFoundContent() {
  return (
    <Container width="content" className="py-10 md:py-16">
      <EmptyState
        headingLevel="h1"
        icon={<SearchIcon size={32} />}
        title="We couldn't find that page"
        description={
          <p>
            The link may be old, or the product may no longer be available. Try searching, or pick a
            category below.
          </p>
        }
        actions={<HeaderSearch id="not-found-search" className="max-w-md" />}
      >
        <div className="flex flex-col items-center gap-6">
          <CategorySuggestions />
          <Link href="/" className={buttonClasses({ variant: "outline" })}>
            Go to the home page
          </Link>
        </div>
      </EmptyState>
    </Container>
  );
}
