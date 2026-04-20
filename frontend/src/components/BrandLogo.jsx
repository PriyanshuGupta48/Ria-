import React from 'react';
import { siteInfo } from '../config/siteInfo';
import brandLogoImage from '../assets/logo.png.png';

const BrandLogo = ({ size = 'md', showLabel = true, className = '' }) => {
  const dimensions = size === 'lg'
    ? { wrapper: 'h-28 w-28 sm:h-32 sm:w-32', zoom: 'scale-[1.2]', text: 'text-[18px] sm:text-[20px]' }
    : size === 'sm'
      ? { wrapper: 'h-16 w-16', zoom: 'scale-[1.22]', text: 'text-[10px]' }
      : { wrapper: 'h-20 w-20 sm:h-24 sm:w-24', zoom: 'scale-[1.2]', text: 'text-[12px] sm:text-[13px]' };

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <div className="brand-logo-box shrink-0 overflow-hidden">
        <img
          src={brandLogoImage}
          alt={`${siteInfo.brandName} logo`}
          className={`${dimensions.wrapper} ${dimensions.zoom} shrink-0 object-cover`}
          loading="eager"
        />
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
