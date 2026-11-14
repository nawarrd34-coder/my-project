/**
 * Youth Studio contact details. The official WhatsApp number and email are
 * built in; the NEXT_PUBLIC_* variables (see .env.example) override them.
 */
const clean = (value: string | undefined, schemes: RegExp): string => {
  const v = (value ?? '').trim();
  return schemes.test(v) ? v : '';
};

/** Official Youth Studio WhatsApp number, international format without "+". */
export const STUDIO_WHATSAPP_NUMBER = '966533896219';
export const STUDIO_EMAIL = 'youthstudio2026@outlook.com';

/** Pre-filled (not sent) message for WhatsApp chats started from the site. */
export const STUDIO_WHATSAPP_MESSAGE =
  'مرحبًا Youth Studio، استخدمت أداة فحص المواقع الخاصة بكم، وأرغب بالتواصل معكم بخصوص نتيجة الفحص والتوصيات.';

/** wa.me click-to-chat link; the user still has to press send in WhatsApp. */
export const whatsappLink = (number: string, message?: string) =>
  `https://wa.me/${number.replace(/\D/g, '')}${message ? `?text=${encodeURIComponent(message)}` : ''}`;

const defaultWhatsapp = whatsappLink(STUDIO_WHATSAPP_NUMBER, STUDIO_WHATSAPP_MESSAGE);

export const studio = {
  whatsapp: clean(process.env.NEXT_PUBLIC_WHATSAPP_URL, /^https:\/\//i) || defaultWhatsapp,
  /** Human-readable number for printed contexts (PDF). */
  whatsappDisplay: process.env.NEXT_PUBLIC_WHATSAPP_URL ? '' : '+966 53 389 6219',
  contact: clean(process.env.NEXT_PUBLIC_CONTACT_URL, /^https:\/\//i),
  email: clean(process.env.NEXT_PUBLIC_CONTACT_EMAIL, /^[^\s@]+@[^\s@]+\.[^\s@]+$/) || STUDIO_EMAIL,
  website: clean(process.env.NEXT_PUBLIC_STUDIO_URL, /^https:\/\//i),
};

export const hasContact = () => !!(studio.whatsapp || studio.contact || studio.email);
