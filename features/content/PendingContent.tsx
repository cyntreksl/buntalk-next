import { Card } from "@/components/ui";

/**
 * Shown on information pages whose final text Buntalk hasn't supplied yet.
 * The old site's versions of these pages contained template text (e.g.
 * "[insert email address]"), so they weren't copied over.
 */
export function PendingContent({ what }: { what: string }) {
  return (
    <Card padding="lg" className="flex flex-col gap-2">
      <p className="font-bold">This page is being updated.</p>
      <p className="text-muted-foreground">
        Our {what} will be published here soon. If you have a question in the meantime, please
        contact us.
      </p>
    </Card>
  );
}
