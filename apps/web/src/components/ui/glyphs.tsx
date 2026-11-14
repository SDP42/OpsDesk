/** Eight custom 1.5px-stroke glyphs for the Control Tower vocabulary. */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function G({ size = 18, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

export const RadarGlyph = (p: P) => (
  <G {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" opacity=".6" />
    <path d="M12 12 19 6" />
    <circle cx="16" cy="15" r="1" fill="currentColor" />
  </G>
);
export const StripGlyph = (p: P) => (
  <G {...p}>
    <rect x="3" y="6" width="18" height="12" rx="1" />
    <path d="M7 6v12M10 10h8M10 14h5" />
  </G>
);
export const FrequencyGlyph = (p: P) => (
  <G {...p}>
    <path d="M3 12h2l2-5 3 10 3-14 3 12 2-3h3" />
  </G>
);
export const TowerGlyph = (p: P) => (
  <G {...p}>
    <path d="M7 6h10l-1.5 4h-7z" />
    <path d="M9.5 10 9 21M14.5 10l.5 11M8 21h8M12 3v3" />
  </G>
);
export const FuelGlyph = (p: P) => (
  <G {...p}>
    <path d="M4.5 16a8 8 0 1 1 15 0" />
    <path d="M12 16l4-5" />
    <circle cx="12" cy="16" r="1.2" fill="currentColor" />
  </G>
);
export const ConstellationGlyph = (p: P) => (
  <G {...p}>
    <circle cx="5" cy="7" r="1.6" />
    <circle cx="18" cy="5" r="1.6" />
    <circle cx="12" cy="13" r="2" />
    <circle cx="6" cy="19" r="1.6" />
    <circle cx="19" cy="18" r="1.6" />
    <path d="M6.3 8l4.3 3.8M16.6 6l-3.5 5.4M10.6 14.4 7 17.8M13.6 14.2l4 2.8" />
  </G>
);
export const BlackBoxGlyph = (p: P) => (
  <G {...p}>
    <rect x="4" y="7" width="16" height="12" rx="1" />
    <path d="M8 7V5h8v2M8 13h8M8 16h5" />
  </G>
);
export const HangarGlyph = (p: P) => (
  <G {...p}>
    <path d="M3 20V11a9 9 0 0 1 18 0v9" />
    <path d="M7 20v-6h10v6M3 20h18" />
  </G>
);
