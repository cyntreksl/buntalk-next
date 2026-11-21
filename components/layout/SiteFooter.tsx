import { brand } from "@/lib/brand";

export function SiteFooter() {
  return (
    <footer className="border-border bg-surface-muted border-t">
      <div className="max-w-page text-body-sm text-muted-foreground mx-auto flex w-full flex-col gap-1 px-4 py-6 md:flex-row md:items-center md:justify-between md:px-6">
        <p lang="si" className="font-sinhala text-heading">
          {brand.tagline}
        </p>
        <p>© {brand.name}</p>
      </div>
    </footer>
  );
}
