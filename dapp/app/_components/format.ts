/**
 * Locale-stable formatters. Using a fixed 'en-US' locale ensures SSR output
 * matches the client and avoids React hydration mismatches when the Node
 * default locale differs from the browser's.
 */

export const formatInt = (n: number) => n.toLocaleString('en-US');

export const formatDecimal = (n: number, opts?: Intl.NumberFormatOptions) =>
  n.toLocaleString('en-US', opts);

export const formatKOTH = (n: number) =>
  n.toLocaleString('en-US', { maximumFractionDigits: 2 });

export const formatETH = (n: number, maxFraction = 6) =>
  n.toLocaleString('en-US', { maximumFractionDigits: maxFraction });
