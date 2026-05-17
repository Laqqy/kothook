import type { SVGProps } from 'react';

export function Crown(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M4 22 L6 10 L12 16 L16 6 L20 16 L26 10 L28 22 Z" />
      <path d="M4 22 L28 22" />
      <line x1="4" y1="25" x2="28" y2="25" />
      <line x1="6" y1="28" x2="26" y2="28" />
      <path d="M10 25 L10 28 M16 25 L16 28 M22 25 L22 28" opacity="0.7" />
      <circle cx="6" cy="10" r="1.4" fill="currentColor" />
      <circle cx="16" cy="6" r="1.7" fill="currentColor" />
      <circle cx="26" cy="10" r="1.4" fill="currentColor" />
      <path d="M14 18 L18 18" opacity="0.5" />
    </svg>
  );
}

export function Fleur(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 4 C 9 8, 9 12, 12 13 C 15 12, 15 8, 12 4 Z" />
      <path d="M12 13 C 7 13, 5 16, 6 19 C 9 18, 11 16, 12 13" />
      <path d="M12 13 C 17 13, 19 16, 18 19 C 15 18, 13 16, 12 13" />
      <line x1="12" y1="13" x2="12" y2="22" />
      <line x1="9" y1="18" x2="15" y2="18" />
    </svg>
  );
}

export function Asterism(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <circle cx="12" cy="6" r="1.2" />
      <circle cx="6" cy="16" r="1.2" />
      <circle cx="18" cy="16" r="1.2" />
    </svg>
  );
}

export function Sigil(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="0.7"
      {...props}
    >
      <circle cx="32" cy="32" r="29" />
      <circle cx="32" cy="32" r="24" strokeDasharray="2 3" />
      <circle cx="32" cy="32" r="14" />
      <path d="M32 8 L34 32 L32 56 L30 32 Z" fill="currentColor" />
      <path d="M8 32 L32 30 L56 32 L32 34 Z" fill="currentColor" />
      <path d="M14.5 14.5 L33 31 L49.5 49.5 L31 33 Z" fill="currentColor" opacity="0.5" />
      <path d="M49.5 14.5 L33 31 L14.5 49.5 L31 33 Z" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

export function CornerOrnament({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 60 60"
      fill="none"
      stroke="currentColor"
      strokeWidth="0.9"
      strokeLinecap="round"
      className={className}
    >
      {/* filigree corner with scroll terminations */}
      <path d="M0 18 C 4 18 6 16 6 6 C 8 14 14 14 18 14" />
      <path d="M14 0 C 14 4 12 6 6 6" />
      <path d="M0 26 C 4 24 6 22 6 18" opacity="0.6" />
      <path d="M22 0 C 22 4 20 6 16 6" opacity="0.6" />
      <circle cx="6" cy="6" r="1.6" fill="currentColor" />
      <circle cx="14" cy="14" r="0.9" fill="currentColor" opacity="0.7" />
      <path d="M2 12 C 4 12 5 11 6 10" />
      <path d="M12 2 C 12 4 11 5 10 6" />
    </svg>
  );
}

export function Hourglass(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M6 2 L18 2 L18 6 L13 12 L18 18 L18 22 L6 22 L6 18 L11 12 L6 6 Z" />
      <path d="M9 5 L15 5" opacity="0.7" />
      <path d="M9 19 L15 19" opacity="0.7" />
      <path d="M10 14 L14 14" opacity="0.5" />
    </svg>
  );
}

export function HairlineDivider({
  ornament,
  className = '',
}: {
  ornament?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="hairline flex-1" />
      {ornament && (
        <div className="text-gold-leaf opacity-80">{ornament}</div>
      )}
      <div className="hairline flex-1" />
    </div>
  );
}

/**
 * Illuminated drop cap — first letter of a section title, framed in lapis with
 * gold leaf border. Styled via `.illuminated-initial` in globals.css.
 */
export function Initial({
  char,
  className = '',
  size = '1em',
}: {
  char: string;
  className?: string;
  size?: string;
}) {
  return (
    <span
      className={`illuminated-initial ${className}`}
      style={{ fontSize: size }}
      aria-hidden
    >
      {char}
    </span>
  );
}

/**
 * Wax seal — vermilion disc with a Roman numeral pressed into it. Used to
 * mark a reign number on a card or to confirm a destructive action.
 */
export function WaxSeal({
  numeral,
  size = 56,
  muted = false,
  className = '',
}: {
  numeral: string;
  size?: number;
  muted?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`wax-seal ${muted ? 'wax-seal-muted' : ''} ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.34),
        letterSpacing: '0.04em',
      }}
      aria-hidden
    >
      {numeral || '·'}
    </div>
  );
}
