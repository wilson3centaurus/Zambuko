'use client';

import { useId } from 'react';

interface ConnectLogoProps {
  /** Font-size in px for the CONNECT text. Icon scales proportionally. */
  fontSize?: number;
  /** true = white text (for dark/gradient backgrounds) */
  inverse?: boolean;
}

/**
 * The Connect wordmark logo.
 * "C" + power-wifi icon (replacing the O) + "NNECT"
 * The power-wifi icon is: a circle (power button) with wifi arcs rising from it.
 */
export function ConnectLogo({ fontSize = 36, inverse = false }: ConnectLogoProps) {
  // Each rendered instance gets a unique gradient ID to avoid SVG namespace collision
  const raw = useId();
  const uid = `cg${raw.replace(/[^a-z0-9]/gi, '')}`;

  const textColor = inverse ? '#ffffff' : '#111827';
  // Icon is taller than the font (wifi arcs extend above cap-height)
  const iconW = fontSize * 0.82;
  const iconH = fontSize * 1.55;

  return (
    <div className="flex items-end select-none" style={{ lineHeight: 1 }}>
      <span
        style={{
          fontSize,
          fontWeight: 900,
          color: textColor,
          letterSpacing: '-0.03em',
          lineHeight: 1,
        }}
      >
        C
      </span>

      {/*
        SVG viewBox: 0 0 36 56
        Circle center: (18, 42), r=11, gap ~240°–300° (upper portion)
        Gap endpoints:
          300°: x=18+11×cos300°=23.5, y=42+11×sin300°=32.5
          240°: x=18+11×cos240°=12.5, y=42+11×sin240°=32.5
        Arc: M23.5 32.5 A11 11 0 1 1 12.5 32.5  (large-arc, clockwise → bottom 300°)
        Bar:  M18 22 L18 42 (through the gap, into the circle centre)
        Wifi arcs from (18,22) curving upward (sweep=0 = counterclockwise = up):
          small  r=5:  M13 22 A5 5 0 0 0 23 22
          medium r=9:  M9 22 A9 9 0 0 0 27 22
          large  r=13: M5 22 A13 13 0 0 0 31 22
      */}
      <svg
        viewBox="0 0 36 56"
        width={iconW}
        height={iconH}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <defs>
          <linearGradient id={uid} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
        </defs>

        {/* Wifi arcs – opening upward from (18, 22) */}
        <path d="M13 22 A5 5 0 0 0 23 22"   stroke={`url(#${uid})`} strokeWidth="3"   fill="none" strokeLinecap="round" />
        <path d="M9 22 A9 9 0 0 0 27 22"    stroke={`url(#${uid})`} strokeWidth="3"   fill="none" strokeLinecap="round" />
        <path d="M5 22 A13 13 0 0 0 31 22"  stroke={`url(#${uid})`} strokeWidth="3"   fill="none" strokeLinecap="round" />

        {/* Vertical bar: from wifi source down through gap into circle centre */}
        <line x1="18" y1="22" x2="18" y2="42" stroke={`url(#${uid})`} strokeWidth="3" strokeLinecap="round" />

        {/* Power circle: centre (18,42) r=11, open at top (gap ~240°→300°) */}
        <path
          d="M23.5 32.5 A11 11 0 1 1 12.5 32.5"
          stroke={`url(#${uid})`}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
      </svg>

      <span
        style={{
          fontSize,
          fontWeight: 900,
          color: textColor,
          letterSpacing: '-0.03em',
          lineHeight: 1,
        }}
      >
        NNECT
      </span>
    </div>
  );
}
