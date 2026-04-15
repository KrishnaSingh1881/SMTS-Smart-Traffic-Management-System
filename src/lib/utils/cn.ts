/**
 * Lightweight className merger — joins truthy strings and filters falsy values.
 * Drop-in replacement for clsx/twMerge for simple cases.
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
