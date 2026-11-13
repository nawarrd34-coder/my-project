import type { Params } from '@/types/audit';

export interface RecCopy {
  title: string | ((p: Params) => string);
  where: string | ((p: Params) => string);
  evidence: (p: Params) => string;
  why: string;
  fix: string;
}

const short = (u: unknown) => {
  const s = String(u ?? '');
  try {
    const x = new URL(s);
    const p = decodeURIComponent(x.pathname);
    return p.length > 48 ? `${p.slice(0, 47)}…` : p || '/';
  } catch {
    return s.length > 60 ? `${s.slice(0, 59)}…` : s;
  }
};

export const recsEn: Record<string, RecCopy> = {
  product_no_add_to_cart: {
    title: 'Product pages show no clear “Add to cart” button',
    where: (p) => `Product pages (e.g. ${short(p.example)})`,
    evidence: (p) => `No add-to-cart button was found on any of the ${p.pages} product pages read.`,
    why: 'If shoppers cannot see how to buy, many will leave the page instead of searching for the button.',
    fix: 'Place a large, high-contrast “Add to cart” button next to the price and keep it visible on mobile (a sticky bar works well).',
  },
  product_price_missing: {
    title: 'Some product pages do not show a price',
    where: (p) => `Product pages (e.g. ${short(p.example)})`,
    evidence: (p) => `${p.count} of ${p.total} product pages read had no detectable price.`,
    why: 'A hidden price is one of the most common reasons shoppers abandon a product page.',
    fix: 'Show the price, any discount and VAT status directly under the product name.',
  },
  product_few_images: {
    title: 'Products are shown with a single photo',
    where: (p) => `Product pages (e.g. “${p.example}”)`,
    evidence: (p) => `${p.count} of ${p.total} product pages read show one image or none.`,
    why: 'Shoppers cannot touch the product; several angles, close-ups and an in-use photo build confidence.',
    fix: 'Add 4–6 images per product: front, back, detail, scale, and in use. Keep the same background and proportions.',
  },
  product_short_description: {
    title: 'Product descriptions are very short',
    where: (p) => `Product pages (e.g. “${p.example}”)`,
    evidence: (p) => `${p.count} of ${p.total} product pages read have under 120 characters of description (shortest: ${p.length}).`,
    why: 'Short descriptions leave buyers with unanswered questions and give search engines little to rank.',
    fix: 'Write 3–5 short sections: what it is, key benefits, size or specs, materials, and care or usage. Use the words customers search for.',
  },
  product_no_availability: {
    title: 'Stock availability is not shown',
    where: 'Product pages',
    evidence: (p) => `None of the ${p.total} product pages read shows availability (in stock / out of stock).`,
    why: 'Clear stock status sets expectations and can encourage a decision (“only 3 left”).',
    fix: 'Show availability near the price and mark out-of-stock items clearly, with a “notify me” option.',
  },
  product_no_related: {
    title: 'Product pages do not suggest related products',
    where: 'Product pages',
    evidence: (p) => `No related or recommended products section was found on the ${p.total} product pages read.`,
    why: 'Related products keep visitors browsing and raise the average order.',
    fix: 'Add a “You may also like” row under the product details, using the same category or frequently bought together items.',
  },
  product_no_structured_data: {
    title: 'Product pages lack structured data for Google',
    where: 'Product pages',
    evidence: (p) => `${p.count} of ${p.total} product pages read have no Product structured data (JSON-LD).`,
    why: 'Without it, Google cannot show price, availability and ratings in search results.',
    fix: 'Add Product JSON-LD with name, image, price, currency and availability. Most platforms support this through a theme setting or app.',
  },
  catalog_no_categories: {
    title: 'Products are not organised into visible categories',
    where: 'Main navigation and homepage',
    evidence: (p) => `${p.products} product links were found but no category pages were linked.`,
    why: 'Shoppers who browse rather than search need clear sections to find products.',
    fix: 'Group products into 5–8 clear categories and link them from the main menu and homepage.',
  },
  search_missing: {
    title: 'The store has no visible search',
    where: 'Header, desktop and mobile',
    evidence: (p) => `No search field was found, while about ${p.products} products were discovered.`,
    why: 'Visitors who know what they want look for search first; without it many leave.',
    fix: 'Add a search field in the header (an icon that opens a full-width field on mobile).',
  },
  search_misses_products: {
    title: 'Search did not find a product the store sells',
    where: 'Internal search',
    evidence: (p) => `Searching for “${p.query}”, a word from a real product name, returned no products.`,
    why: 'Shoppers who search and find nothing assume the store does not have it.',
    fix: 'Check the search settings or app: index product titles and tags, support Arabic spelling variants, and test common searches.',
  },
  search_irrelevant: {
    title: 'Search results do not match the query',
    where: 'Internal search',
    evidence: (p) => `Searching for “${p.query}” returned ${p.results} results, none mentioning the search word.`,
    why: 'Irrelevant results make search feel broken and push visitors away.',
    fix: 'Improve result ranking: prioritise title matches and enable fuzzy matching for Arabic and English spellings.',
  },
  search_no_empty_state: {
    title: 'An empty search gives no guidance',
    where: 'Search results page',
    evidence: (p) => `Searching for “${p.query}” returned no results and no message.`,
    why: 'A blank page leaves visitors stuck; a helpful message keeps them shopping.',
    fix: 'Show a clear “No results” message with spelling tips, popular categories and best sellers.',
  },
  search_hidden_mobile: {
    title: 'Search is not visible on mobile',
    where: 'Mobile header',
    evidence: () => 'The search field exists but was not visible on a 390 px wide phone screen.',
    why: 'Most shoppers browse on phones; hidden search means fewer people use it.',
    fix: 'Show a search icon in the mobile header that opens the field immediately.',
  },
  search_no_autocomplete: {
    title: 'Search has no suggestions while typing',
    where: 'Internal search',
    evidence: (p) => `Typing “${p.query}” did not show suggestions before submitting.`,
    why: 'Suggestions help shoppers find products faster and correct spelling.',
    fix: 'Enable instant search or predictive suggestions (often a built-in theme option or app).',
  },
  banner_heavy: {
    title: 'Homepage banners are very large files',
    where: (p) => `Homepage banners (e.g. ${short(p.example)})`,
    evidence: (p) => `${p.count} banner image(s) over 450 KB; the largest is about ${p.largestKb} KB.`,
    why: 'Heavy banners are usually the main reason a homepage loads slowly on mobile data.',
    fix: 'Export banners as WebP or AVIF at the size they are shown (about 1600–1920 px wide for desktop) and aim for under 250 KB each.',
  },
  banner_no_mobile_version: {
    title: 'Wide banners have no mobile version',
    where: (p) => `Homepage slider (e.g. ${short(p.example)})`,
    evidence: (p) => `${p.count} slider banner(s) are very wide (about ${p.ratio}:1) and no separate mobile image was found.`,
    why: 'On a phone, wide banners shrink to a thin strip; any text inside becomes hard to read.',
    fix: 'Design a taller mobile version (about 4:5 or 1:1) and serve it to small screens with a <picture> element or the platform’s mobile banner field.',
  },
  banner_low_resolution: {
    title: 'Banner images are low resolution',
    where: (p) => `Homepage banners (e.g. ${short(p.example)})`,
    evidence: (p) => `${p.count} full-width banner(s) are under 1200 px wide (smallest: ${p.width} px).`,
    why: 'Low-resolution banners look blurry on large and high-density screens and lower the perceived quality of the brand.',
    fix: 'Upload banners at least 1600–1920 px wide and let the platform resize them.',
  },
  banner_mixed_ratios: {
    title: 'Slider banners have different proportions',
    where: 'Homepage slider',
    evidence: (p) => `Banner proportions range from ${p.min}:1 to ${p.max}:1.`,
    why: 'Mixed sizes make the slider jump in height and look inconsistent.',
    fix: 'Use one fixed size for every slide (for example 1920×720 desktop and 1080×1350 mobile).',
  },
  banner_missing_alt: {
    title: 'Banners have no text description',
    where: 'Homepage banners',
    evidence: (p) => `${p.count} of ${p.total} banners have no alt text.`,
    why: 'Search engines and screen readers cannot understand what the banner promotes.',
    fix: 'Add short alt text describing each offer, e.g. “Summer collection – up to 30% off”.',
  },
  banner_not_clickable: {
    title: 'Banners do not link anywhere',
    where: 'Homepage banners',
    evidence: (p) => `None of the ${p.total} banners found is wrapped in a link.`,
    why: 'Visitors expect to tap a promotion and land on the offer.',
    fix: 'Link each banner to the matching category or product, and add a visible button on the banner.',
  },
  design_mobile_overflow: {
    title: 'The page scrolls sideways on mobile',
    where: 'Homepage on a 390 px phone',
    evidence: () => 'The page content is wider than the phone screen, so it can be dragged sideways.',
    why: 'A wobbling layout feels broken and makes the site look unprofessional.',
    fix: 'Find the element wider than the screen (often a banner, table or carousel) and limit it to the screen width.',
  },
  design_cta_low_contrast: {
    title: 'The main button is hard to see',
    where: (p) => `Main call to action “${p.text}”`,
    evidence: (p) => `Text-to-background contrast is ${p.contrast}:1 (at least 4.5:1 is recommended for text).`,
    why: 'The most important action on the page should be the easiest thing to notice.',
    fix: 'Use a solid brand colour with white or very dark text, and make it the only button in that colour.',
  },
  design_cta_below_fold_mobile: {
    title: 'The main action is not on the first mobile screen',
    where: (p) => `“${p.text}” on mobile`,
    evidence: () => 'On a 390 px phone, the main call to action appears only after scrolling.',
    why: 'Visitors decide in the first seconds; an action they cannot see is easy to miss.',
    fix: 'Move the main button into the first screen on mobile, directly under the headline or banner.',
  },
  design_no_clear_cta: {
    title: 'No clear main action on the homepage',
    where: 'Homepage, first screen',
    evidence: () => 'No prominent button inviting a next step (shop, book, contact) was found near the top.',
    why: 'Without a clear next step, visitors browse and leave.',
    fix: 'Add one primary button above the fold, such as “Shop now” or “Book a consultation”.',
  },
  design_small_mobile_text: {
    title: 'Body text is small on mobile',
    where: 'Mobile pages',
    evidence: (p) => `Typical paragraph text renders at ${p.size} px on a phone (16 px is comfortable).`,
    why: 'Small text forces visitors to zoom, especially in Arabic where letters need more size.',
    fix: 'Set body text to at least 16 px on mobile and increase line spacing for Arabic.',
  },
  design_small_tap_targets: {
    title: 'Many links are too small to tap',
    where: 'Mobile pages',
    evidence: (p) => `${p.count} links or buttons near the top of the mobile page are smaller than 24 px.`,
    why: 'Small targets cause mis-taps and frustration.',
    fix: 'Give links and icons a touch area of at least 44×44 px with spacing between them.',
  },
  design_too_many_fonts: {
    title: 'Too many different fonts',
    where: 'Site-wide typography',
    evidence: (p) => `More than three font families are in use: ${p.fonts}.`,
    why: 'Mixing many fonts makes a brand look inconsistent.',
    fix: 'Use one font for headings and one for text (with an Arabic counterpart), in a few weights.',
  },
  design_hero_text_contrast: {
    title: 'Headline text is hard to read',
    where: (p) => `Top headline “${p.text}”`,
    evidence: (p) => `Text-to-background contrast is ${p.contrast}:1.`,
    why: 'The headline carries the main message; low contrast makes visitors skip it.',
    fix: 'Darken or lighten the background behind the headline, or change the text colour.',
  },
  design_hero_text_over_image: {
    title: 'Headline text sits directly on a photo',
    where: (p) => `Top headline${p.text ? ` “${p.text}”` : ''}`,
    evidence: () => 'The headline is placed over a background image; its readability depends on the photo.',
    why: 'Text over busy photos is often unreadable on some screens, especially on mobile.',
    fix: 'Add a subtle dark overlay or a solid panel behind the text, and check it on a phone.',
  },
  design_inconsistent_cards: {
    title: 'Product photos have inconsistent proportions',
    where: 'Product grids',
    evidence: (p) => `Product card images range from ${p.min}:1 to ${p.max}:1.`,
    why: 'Uneven cards make the catalogue look disorganised.',
    fix: 'Crop all product photos to one ratio (1:1 or 4:5) with the same background.',
  },
  design_busy_navigation: {
    title: 'The main menu has many items',
    where: 'Header navigation',
    evidence: (p) => `${p.items} links are visible in the top navigation.`,
    why: 'Too many choices slow visitors down.',
    fix: 'Keep 5–7 top-level items and move the rest into drop-down groups or the footer.',
  },
  brand_no_logo: {
    title: 'No logo could be identified',
    where: 'Header',
    evidence: () => 'No logo image was found in the header, structured data or site icons.',
    why: 'A clear logo is the first sign of a professional, trustworthy brand.',
    fix: 'Place the logo at the start of the header, linked to the homepage, with descriptive alt text.',
  },
  journey_no_payment_info: {
    title: 'Payment options are not shown',
    where: 'Homepage, footer and product pages',
    evidence: () => 'No payment methods (mada, Apple Pay, Tabby, Tamara, cards…) were found on the pages read.',
    why: 'Shoppers want to know they can pay their preferred way before adding to cart.',
    fix: 'Show payment logos in the footer and near the add-to-cart button.',
  },
  journey_no_delivery_info: {
    title: 'Delivery information is hard to find',
    where: 'Product pages and footer',
    evidence: () => 'No shipping or delivery information was found on the pages read.',
    why: 'Unknown delivery time and cost is a top reason for abandoned carts.',
    fix: 'Show delivery time and cost on product pages and link a shipping policy in the footer.',
  },
  journey_no_return_policy: {
    title: 'No return or exchange policy was found',
    where: 'Footer and product pages',
    evidence: () => 'No return, exchange or refund policy was found on the pages read.',
    why: 'A clear return policy reduces the risk of buying online and builds trust.',
    fix: 'Publish a simple return and exchange policy page and link it from the footer and checkout.',
  },
  journey_no_trust_details: {
    title: 'Business registration details are not visible',
    where: 'Footer',
    evidence: () => 'No commercial registration, Maroof or Saudi Business Center details were found.',
    why: 'Saudi shoppers often check registration details before buying from a new store.',
    fix: 'Show the commercial registration and e-commerce authentication details in the footer, with the official badge if available.',
  },
  journey_no_reviews: {
    title: 'No customer reviews are shown',
    where: 'Product pages and homepage',
    evidence: () => 'No ratings or customer reviews were found on the pages read.',
    why: 'Reviews from other customers are one of the strongest reasons to trust a store.',
    fix: 'Enable product reviews and ask customers for a rating after delivery.',
  },
  journey_no_instant_contact: {
    title: 'No instant contact option',
    where: 'Header, footer and contact page',
    evidence: () => 'No WhatsApp link or tappable phone number was found.',
    why: 'Many customers in Saudi Arabia prefer to ask a quick question on WhatsApp before buying.',
    fix: 'Add a WhatsApp button and a tappable phone number in the header or as a floating button.',
  },
  longterm_content: {
    title: 'No content beyond the product catalogue',
    where: 'Site structure',
    evidence: () => 'No blog, guides or articles section was found.',
    why: 'Helpful content attracts search traffic and answers buyers’ questions before they ask.',
    fix: 'Publish buying guides and how-to articles for your main categories, one or two per month.',
  },
  longterm_bilingual: {
    title: 'The store is available in Arabic only',
    where: 'Site-wide',
    evidence: () => 'Only Arabic content was detected.',
    why: 'An English version can reach residents and visitors who prefer English.',
    fix: 'Consider an English version of key pages and products when it fits your audience.',
  },
};

export { short };
