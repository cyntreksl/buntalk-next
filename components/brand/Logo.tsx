import Image from "next/image";
import { brand } from "@/lib/brand";

type LogoProps = {
  /** "full" includes the Sinhala tagline; "compact" is the framed wordmark only. */
  variant?: "full" | "compact";
  /** Rendered height in pixels; width follows the logo's aspect ratio. */
  height?: number;
  className?: string;
  priority?: boolean;
};

export function Logo({ variant = "compact", height = 40, className, priority }: LogoProps) {
  const logo = brand.logo[variant];
  const width = Math.round((logo.width / logo.height) * height);
  return (
    <Image
      src={logo.src}
      alt={brand.name}
      width={width}
      height={height}
      priority={priority}
      className={className}
    />
  );
}
