'use client';

import { useId } from 'react';

interface Props {
  size?: number;
  showText?: boolean;
  /** true = white text (for dark backgrounds), false = dark text */
  inverse?: boolean;
}

/**
 * RoboKorda gear-K logo rendered as inline SVG.
 * To swap in the real PNG, replace the <svg> block with:
 *   <Image src="/robokorda-logo.png" width={size} height={size} alt="RoboKorda" />
 * and drop robokorda-logo.png into /public/.
 */
export function RoboKordaLogo({ size = 48, showText = false, inverse = true }: Props) {
  // Unique gradient ID per render to avoid SVG namespace collision
  const raw = useId();
  const uid = `rk${raw.replace(/[^a-zA-Z0-9]/g, '')}`;

  const TEETH_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

  return (
    <div className="flex items-center gap-2.5 flex-shrink-0">
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
        aria-label="RoboKorda"
      >
        <defs>
          <linearGradient id={uid} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
        </defs>

        {/* Gear teeth — 8 rounded rectangles rotated about centre */}
        {TEETH_ANGLES.map((angle) => (
          <rect
            key={angle}
            x="46" y="3" width="8" height="17" rx="4"
            transform={`rotate(${angle} 50 50)`}
            fill={`url(#${uid})`}
          />
        ))}

        {/* Main disc */}
        <circle cx="50" cy="50" r="34" fill={`url(#${uid})`} />

        {/* White "K" letterform */}
        <rect x="35" y="30" width="7" height="40" rx="2.5" fill="white" />
        <path d="M42,50 L57,30 L67,30 L53,50 L67,70 L57,70 Z" fill="white" />
      </svg>

      {showText && (
        <div>
          <p
            className="font-black text-base leading-none"
            style={{ color: inverse ? 'white' : '#111827' }}
          >
            RoboKorda
          </p>
          <p
            className="text-[9px] font-semibold tracking-widest leading-none mt-1 uppercase"
            style={{ color: inverse ? 'rgba(255,255,255,0.55)' : '#6b7280' }}
          >
            Making Robotics &amp; Coding Fun
          </p>
        </div>
      )}
    </div>
  );
}
