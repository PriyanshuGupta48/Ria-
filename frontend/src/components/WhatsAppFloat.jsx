import React from 'react';
import { MessageCircle } from 'lucide-react';
import { getWhatsAppUrl } from '../config/siteInfo';

const WhatsAppFloat = () => {
  const whatsappUrl = getWhatsAppUrl();

  if (!whatsappUrl) {
    return null;
  }

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noreferrer"
      className="whatsapp-float"
      aria-label="Chat on WhatsApp"
      title="Chat on WhatsApp"
    >
      <MessageCircle size={24} />
    </a>
  );
};

export default WhatsAppFloat;
