/**
 * Locale-stable formatters. Using a fixed 'en-US' locale ensures SSR output
 * matches the client and avoids React hydration mismatches when the Node
 * default locale differs from the browser's.
 */

import { formatUnits } from 'viem';

export const formatInt = (n: number | bigint) =>
  typeof n === 'bigint'
    ? n.toLocaleString('en-US')
    : n.toLocaleString('en-US');

export const formatDecimal = (n: number, opts?: Intl.NumberFormatOptions) =>
  n.toLocaleString('en-US', opts);

export const formatKOTH = (n: number) =>
  n.toLocaleString('en-US', { maximumFractionDigits: 2 });

export const formatETH = (n: number, maxFraction = 6) =>
  n.toLocaleString('en-US', { maximumFractionDigits: maxFraction });

/** Pretty-print a wei BigInt as ETH with up to `digits` decimals. */
export function formatWeiETH(wei: bigint, digits = 3) {
  const formatted = formatUnits(wei, 18);
  const n = Number(formatted);
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

/** Pretty-print a wei BigInt as KOTH (18 decimals) with up to `digits` decimals. */
export function formatWeiKOTH(wei: bigint, digits = 2) {
  return formatWeiETH(wei, digits);
}

/** Compact number formatter, e.g. 142847 → "142.85K", 9857153 → "9.857M". */
export function formatLarge(n: number, digits = 2) {
  if (Math.abs(n) >= 1e6) {
    return `${(n / 1e6).toLocaleString('en-US', {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    })}M`;
  }
  if (Math.abs(n) >= 1e3) {
    return `${(n / 1e3).toLocaleString('en-US', {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    })}K`;
  }
  return n.toLocaleString('en-US', { maximumFractionDigits: digits });
}

const ORDINALS = [
  'Zeroth',
  'First',
  'Second',
  'Third',
  'Fourth',
  'Fifth',
  'Sixth',
  'Seventh',
  'Eighth',
  'Ninth',
  'Tenth',
  'Eleventh',
  'Twelfth',
  'Thirteenth',
  'Fourteenth',
  'Fifteenth',
  'Sixteenth',
  'Seventeenth',
  'Eighteenth',
  'Nineteenth',
  'Twentieth',
];

export function reignName(n: bigint): string {
  const num = Number(n);
  if (num >= 0 && num < ORDINALS.length) return ORDINALS[num];
  return `Reign ${toRoman(num)}`;
}

export function toRoman(num: number): string {
  if (num <= 0) return 'O';
  const map: [number, string][] = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let n = num;
  let result = '';
  for (const [value, sym] of map) {
    while (n >= value) {
      result += sym;
      n -= value;
    }
  }
  return result;
}

export function shortAddress(addr: string, head = 4, tail = 4) {
  if (!addr) return '';
  if (addr.length <= head + tail + 2) return addr;
  return `${addr.slice(0, 2 + head)}…${addr.slice(-tail)}`;
}
