import { GlobeIcon } from "@/components/ui";

/**
 * Language switcher slot. Holds the header space for the real switcher
 * (English / සිංහල / தமிழ்) that arrives with the localisation work (BUN-211).
 * Until then it only shows the current language.
 */
export function LanguageSwitcher() {
  return (
    <div
      data-slot="language-switcher"
      className="text-body-sm text-muted-foreground inline-flex h-10 items-center gap-1.5 px-2 font-bold"
      title="More languages coming soon"
    >
      <GlobeIcon size={18} />
      <span>
        <span className="sr-only">Language: </span>EN
      </span>
    </div>
  );
}
