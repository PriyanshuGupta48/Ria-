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
      <div className="container mx-auto px-4 sm:px-6 py-10 sm:py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 sm:gap-10">
          <section>
            <BrandLogo size="lg" className="site-footer-brand" />

            <div className="mt-5 space-y-4 text-sm sm:text-base text-amber-50/90">
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

            <div className="mt-5 flex items-center gap-3">
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

        <div className="mt-8 pt-5 border-t border-amber-200/40 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-amber-50/95">
            <span className="font-semibold mr-1">We accept</span>
            {siteInfo.paymentMethods.map((item) => (
              <span key={item} className="site-footer-pill">{item}</span>
            ))}
          </div>
          <p className="text-amber-50/80 text-sm">Built for handmade businesses</p>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
