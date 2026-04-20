import React from 'react';
import { siteInfo } from '../config/siteInfo';

const BrandLogo = ({ size = 'md', showLabel = true, className = '' }) => {
  const dimensions = size === 'lg'
    ? { wrapper: 'h-24 w-24 sm:h-28 sm:w-28', text: 'text-[18px] sm:text-[20px]' }
    : size === 'sm'
      ? { wrapper: 'h-14 w-14', text: 'text-[10px]' }
      : { wrapper: 'h-18 w-18 sm:h-20 sm:w-20', text: 'text-[12px] sm:text-[13px]' };

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <div className="brand-logo-box shrink-0">
        <svg
          viewBox="0 0 320 320"
          className={`${dimensions.wrapper} shrink-0`}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="dhaagaLeaf" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#d7ddbf" />
              <stop offset="100%" stopColor="#bfc7a2" />
            </linearGradient>
            <linearGradient id="dhaagaPetal" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fff5f4" />
              <stop offset="55%" stopColor="#fcd7d7" />
              <stop offset="100%" stopColor="#f8bfc2" />
            </linearGradient>
          </defs>

          <circle cx="160" cy="160" r="150" fill="none" stroke="rgba(192, 200, 170, 0.16)" strokeWidth="18" />

          <g transform="translate(160 160)">
            {[
              { angle: -72, x: -10, y: -132, scale: 0.95 },
              { angle: -38, x: 90, y: -98, scale: 0.78 },
              { angle: -3, x: 132, y: -6, scale: 0.88 },
              { angle: 32, x: 102, y: 82, scale: 1.02 },
              { angle: 70, x: 14, y: 132, scale: 1.08 },
              { angle: 108, x: -82, y: 104, scale: 0.92 },
              { angle: 148, x: -136, y: 12, scale: 0.84 },
              { angle: 184, x: -116, y: -82, scale: 0.9 },
              { angle: 220, x: -24, y: -136, scale: 0.82 },
            ].map((item, index) => (
              <g key={index} transform={`translate(${item.x} ${item.y}) rotate(${item.angle}) scale(${item.scale})`}>
                <path d="M0 0 C16 -14 28 -12 44 -2 C28 4 16 16 0 12 C-8 8 -8 4 0 0Z" fill="url(#dhaagaLeaf)" opacity="0.95" />
                <path d="M10 -4 C24 -18 38 -20 54 -12" fill="none" stroke="#8f9a72" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
              </g>
            ))}

            {[
              { x: -108, y: -16, s: 1.08 },
              { x: 78, y: 76, s: 1.16 },
              { x: 92, y: 22, s: 0.72 },
              { x: -48, y: 102, s: 0.68 },
              { x: 0, y: -128, s: 0.58 },
              { x: 116, y: -44, s: 0.56 },
            ].map((flower, index) => (
              <g key={`flower-${index}`} transform={`translate(${flower.x} ${flower.y}) scale(${flower.s})`}>
                <circle cx="0" cy="0" r="16" fill="#f9c45f" opacity="0.95" />
                {[0, 72, 144, 216, 288].map((angle) => (
                  <ellipse
                    key={angle}
                    cx="0"
                    cy="-28"
                    rx="18"
                    ry="30"
                    fill="url(#dhaagaPetal)"
                    transform={`rotate(${angle})`}
                  />
                ))}
                <circle cx="0" cy="0" r="5" fill="#e49b45" />
              </g>
            ))}

            <path d="M-120 8 C-86 -36 -50 -64 -10 -90" fill="none" stroke="#8f9a72" strokeWidth="3.5" strokeLinecap="round" opacity="0.65" />
            <path d="M12 -90 C50 -76 82 -54 114 -16" fill="none" stroke="#8f9a72" strokeWidth="3.5" strokeLinecap="round" opacity="0.65" />
            <path d="M116 10 C102 50 82 80 48 112" fill="none" stroke="#8f9a72" strokeWidth="3.5" strokeLinecap="round" opacity="0.65" />
            <path d="M40 114 C-2 120 -46 104 -82 76" fill="none" stroke="#8f9a72" strokeWidth="3.5" strokeLinecap="round" opacity="0.65" />
            <path d="M-92 78 C-114 42 -124 24 -126 -4" fill="none" stroke="#8f9a72" strokeWidth="3.5" strokeLinecap="round" opacity="0.65" />
          </g>

          <text
            x="160"
            y="180"
            textAnchor="middle"
            fill="#5a6341"
            style={{ fontFamily: 'Great Vibes, cursive', fontSize: '54px', fontWeight: 400 }}
          >
            {siteInfo.logoText}
          </text>
        </svg>
      </div>

      {showLabel && (
        <div className="leading-tight -ml-1 sm:-ml-2">
          <div className={`brand-wordmark ${dimensions.text}`}>{siteInfo.brandName}</div>
          <div className="brand-tagline">Handmade with care</div>
        </div>
      )}
    </div>
  );
};

export default BrandLogo;
