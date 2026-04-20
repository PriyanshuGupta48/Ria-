export const siteInfo = {
  brandName: 'Dhaaga',
  logoText: 'Dhaaga',
  address: '252, Village Daudwala P.O. Mothrowala, Dehradun, 248001',
  phoneDisplay: '7302068608',
  phoneDigits: '+917302068608',
  email: 'the.dhaaga1@gmail.com',
  instagramUrl: 'https://www.instagram.com/the.dhaaga?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==',
  catalogCategories: ['Gifts', 'Keychains', 'Decorations', 'Accessories', 'Apparel'],
  helpLinks: [
    { label: 'Store Policies', href: '/store-policies' },
    { label: 'Track your Order', href: '/my-orders' },
    { label: 'Return Policy', href: '/return-policy' },
    { label: 'Privacy Policy', href: '/privacy-policy' },
  ],
  shopLinks: [
    { label: 'Gifts', href: '/#product-catalog' },
    { label: 'Keychains', href: '/#product-catalog' },
    { label: 'Decorations', href: '/#product-catalog' },
    { label: 'Accessories', href: '/#product-catalog' },
    { label: 'Apparel', href: '/#product-catalog' },
  ],
  exploreLinks: [
    { label: 'Currently trending', href: '/#product-catalog' },
    { label: 'For kids', href: '/#product-catalog' },
    { label: 'Earmuffs', href: '/#product-catalog' },
    { label: 'Button accessory', href: '/#product-catalog' },
  ],
  paymentMethods: ['VISA', 'Mastercard', 'GPay', 'BHIM UPI', 'Net Banking', 'Wallet'],
};

export const getWhatsAppUrl = () => {
  const digits = String(siteInfo.phoneDigits || '').replace(/\D/g, '');
  if (!digits) return '';

  return `https://wa.me/${digits}`;
};
