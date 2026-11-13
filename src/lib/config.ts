/**
 * Youth Studio contact links. Nothing is hard-coded: set these in the
 * environment (see .env.example). A link that is not set is not rendered.
 */
const clean = (value: string | undefined, schemes: RegExp): string => {
  const v = (value ?? '').trim();
  return schemes.test(v) ? v : '';
};

export const studio = {
  whatsapp: clean(process.env.NEXT_PUBLIC_WHATSAPP_URL, /^https:\/\//i),
  contact: clean(process.env.NEXT_PUBLIC_CONTACT_URL, /^https:\/\//i),
  email: clean(process.env.NEXT_PUBLIC_CONTACT_EMAIL, /^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  website: clean(process.env.NEXT_PUBLIC_STUDIO_URL, /^https:\/\//i),
};

export const hasContact = () => !!(studio.whatsapp || studio.contact || studio.email);
