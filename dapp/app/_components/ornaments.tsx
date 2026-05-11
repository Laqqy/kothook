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
      <path d="M4 22 L6 10 L12 16 L16 7 L20 16 L26 10 L28 22 Z" />
      <line x1="4" y1="25" x2="28" y2="25" />
      <line x1="6" y1="28" x2="26" y2="28" />
      <circle cx="6" cy="10" r="1.2" fill="currentColor" />
      <circle cx="16" cy="7" r="1.4" fill="currentColor" />
      <circle cx="26" cy="10" r="1.2" fill="currentColor" />
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
      strokeWidth="0.8"
      className={className}
    >
      <path d="M0 18 L4 18 L4 4 L18 4 L18 0" />
      <circle cx="4" cy="4" r="1.5" fill="currentColor" />
      <path d="M10 4 L14 4" />
      <path d="M4 10 L4 14" />
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
        <div className="text-bronze-bright opacity-70">{ornament}</div>
      )}
      <div className="hairline flex-1" />
    </div>
  );
}
