import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone } from 'lucide-react';
import { siteInfo } from '../config/siteInfo';
import BrandLogo from './BrandLogo';

const FooterLink = ({ href, label }) => {
  const isInternalRoute = href.startsWith('/');

  if (isInternalRoute) {
    return (
      <Link to={href} className="site-footer-link">
        {label}
      </Link>
    );
  }

  return (
    <a href={href} className="site-footer-link" target="_blank" rel="noreferrer">
      {label}
    </a>
  );
};

const SiteFooter = () => {
  return (
    <footer className="site-footer mt-10 sm:mt-14">
      <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 sm:gap-6">
          <section>
            <BrandLogo size="lg" className="site-footer-brand" />

            <div className="mt-3 space-y-3 text-sm text-amber-50/90">
              <div className="site-footer-contact-row">
                <MapPin size={18} />
                <p>{siteInfo.address}</p>
              </div>
              <div className="site-footer-contact-row">
                <Phone size={18} />
                <p>{siteInfo.phoneDisplay}</p>
              </div>
              <div className="site-footer-contact-row">
                <Mail size={18} />
                <p>{siteInfo.email}</p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <p className="font-semibold text-amber-50">Connect with us</p>
              <a
                href={siteInfo.instagramUrl}
                target="_blank"
                rel="noreferrer"
                className="site-footer-social"
                aria-label="Instagram"
              >
                <span className="text-[11px] font-bold">IG</span>
              </a>
            </div>
          </section>

          <section>
            <h3 className="site-footer-title">Help</h3>
            <div className="site-footer-links">
              {siteInfo.helpLinks.map((link) => (
                <FooterLink key={link.label} href={link.href} label={link.label} />
              ))}
            </div>
          </section>

          <section>
            <h3 className="site-footer-title">Shop</h3>
            <div className="site-footer-links">
              {siteInfo.shopLinks.map((link) => (
                <FooterLink key={link.label} href={link.href} label={link.label} />
              ))}
            </div>
          </section>

          <section>
            <h3 className="site-footer-title">Explore</h3>
            <div className="site-footer-links">
              {siteInfo.exploreLinks.map((link) => (
                <FooterLink key={link.label} href={link.href} label={link.label} />
              ))}
            </div>
          </section>
        </div>

        <div className="mt-4 pt-3 border-t border-amber-200/30 flex flex-col lg:flex-row gap-2 lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-amber-50/95">
            <span className="font-semibold mr-1 text-xs sm:text-sm">We accept</span>
            {siteInfo.paymentMethods.map((item) => (
              <span key={item} className="site-footer-pill text-[11px] sm:text-xs">{item}</span>
            ))}
          </div>
          <p className="text-amber-50/80 text-[11px] sm:text-xs">Built for handmade businesses</p>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
