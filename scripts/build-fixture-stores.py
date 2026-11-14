"""
Builds SYNTHETIC local test websites for end-to-end runs of the business
analysis. Names, products and prices are invented; the pages only carry the
public technical signatures of each platform so detection can be exercised.
"""
import json, os, random
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'tests', 'fixtures', 'stores')
random.seed(7)

def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)

def noisy_jpeg(path, w, h, quality=95):
    img = Image.effect_noise((w, h), 60).convert('RGB')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, 'JPEG', quality=quality)

def flat_png(path, w, h, color):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    Image.new('RGB', (w, h), color).save(path, 'PNG')

# ── Salla-style Arabic perfume store ─────────────────────────────────────────
S = os.path.join(ROOT, 'salla')
salla_products = [
    ('dehn-oud-cambodi', 1000001, 'دهن عود كمبودي فاخر', 'oud', 450, True),
    ('dehn-oud-hindi', 1000002, 'دهن عود هندي', 'oud', 380, True),
    ('oud-moattar', 1000003, 'عود معطر للبخور', 'oud', 120, True),
    ('musk-tahara', 1000004, 'مسك الطهارة الأبيض', 'perfume', 45, False),
    ('perfume-sahra', 1000005, 'عطر الصحراء', 'perfume', 220, True),
    ('perfume-layal', 1000006, 'عطر ليال', 'perfume', 260, True),
    ('bakhoor-malaki', 1000007, 'بخور ملكي', 'bakhoor', 90, True),
    ('bakhoor-nadd', 1000008, 'بخور ند', 'bakhoor', 75, True),
    ('mabkhara-gold', 1000009, 'مبخرة ذهبية', 'bakhoor', 150, True),
    ('gift-set', 1000010, 'طقم هدايا العود', 'oud', 520, True),
]
cats = {'oud': ('العود', 1100001), 'perfume': ('العطور', 1100002), 'bakhoor': ('البخور', 1100003)}
SALLA_HEAD = '<script src="https://cdn.salla.network/js/twilight/twilight.js"></script><link rel="stylesheet" href="https://cdn.salla.network/themes/raed/app.css">'

def salla_header():
    nav = ''.join(f'<a href="/{c}/c{cid}">{name}</a>' for c, (name, cid) in cats.items())
    return f'''<header><a href="/"><img src="/logo.png" class="logo" alt="عطور المثال"></a><nav>{nav}<a href="/cart">السلة</a></nav>
<salla-search></salla-search><form action="/search" method="get" class="search"><input type="search" name="q" placeholder="ابحث في المتجر"></form></header>'''

def card(slug, pid, name, price):
    return f'<div class="product-card"><a href="/{slug}/p{pid}"><img src="/img/{slug}.png" alt="{name}" width="400" height="{400 if pid % 3 else 520}"><h3>{name}</h3></a><span>{price} ر.س</span></div>'

SALLA_FOOT = '''<footer><p>طرق الدفع: مدى، Apple Pay، تمارا</p><p>الشحن لجميع مدن المملكة خلال 3-5 أيام</p>
<a href="https://wa.me/966500000000">واتساب</a><a href="/pages/about">من نحن</a><a href="/pages/contact">تواصل معنا</a>
<p>جميع الحقوق محفوظة</p></footer>'''

def salla_page(title, body, extra_head=''):
    return f'''<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title><meta name="theme-color" content="#5b2a86"><meta property="og:site_name" content="عطور المثال">
<style>:root{{--color-primary:#5b2a86}} body{{font-family:Tahoma,sans-serif;margin:0}} header{{display:flex;gap:12px;padding:12px;background:#5b2a86}} header a{{color:#fff}}
.btn{{background:#d9c7ec;color:#ffffff;padding:12px 20px;display:inline-block}} .hero-slider img{{width:100%;height:auto;display:block}} .grid{{display:flex;flex-wrap:wrap;gap:12px}}
.product-card img{{width:180px;height:auto}} .wide{{width:1400px}} footer{{padding:20px;background:#eee}}</style>{SALLA_HEAD}{extra_head}</head><body>{salla_header()}{body}{SALLA_FOOT}</body></html>'''

home = salla_page('عطور المثال | متجر العود والعطور', f'''
<div class="hero-slider swiper"><a href="/oud/c1100001"><img src="/banners/b1.jpg" alt="" width="1920" height="600"></a><img src="/banners/b2.jpg" alt="" width="1600" height="900"></div>
<h1 style="font-size:30px">عطور فاخرة بأسعار مميزة</h1><a class="btn" href="/oud/c1100001">تسوق الآن</a>
<section><h2>الأكثر مبيعاً</h2><div class="grid">{''.join(card(s, p, n, pr) for s, p, n, c, pr, _ in salla_products[:6])}</div></section>
<div class="wide">قسم عريض جداً</div>''', '<meta name="description" content="متجر عطور سعودي يقدم دهن العود والبخور والعطور الشرقية الفاخرة مع شحن سريع لجميع مدن المملكة.">')
write(os.path.join(S, 'index.html'), home)
for c, (name, cid) in cats.items():
    items = [p for p in salla_products if p[3] == c]
    write(os.path.join(S, c, f'c{cid}', 'index.html'), salla_page(f'{name} | عطور المثال', f'<h1>{name}</h1><div class="grid">{"".join(card(s, p, n, pr) for s, p, n, cc, pr, _ in items)}</div>'))
for slug, pid, name, c, price, has_price in salla_products:
    ld = {'@context': 'https://schema.org', '@type': 'Product', 'name': name, 'image': [f'/img/{slug}.png'], 'description': ('وصف قصير للمنتج.' if pid % 2 else 'منتج أصلي فاخر مصنوع من أجود أنواع العود، يدوم طويلاً ويناسب المناسبات والاستخدام اليومي، ويأتي في عبوة أنيقة مناسبة للإهداء.'),
          'offers': {'@type': 'Offer', 'price': str(price), 'priceCurrency': 'SAR', 'availability': 'https://schema.org/InStock'}}
    if not has_price:
        ld.pop('offers')
    body = f'''<h1>{name}</h1><img src="/img/{slug}.png" alt="{name}">{f'<p class="price">{price} ر.س</p>' if has_price else ''}
<salla-add-product-button product-id="{pid}">أضف للسلة</salla-add-product-button><div class="product-description">{ld['description']}</div>'''
    write(os.path.join(S, slug, f'p{pid}', 'index.html'), salla_page(f'{name} | عطور المثال', body, f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>'))
    flat_png(os.path.join(S, 'img', f'{slug}.png'), 400, 400 if pid % 3 else 520, (200, 180, 220))
write(os.path.join(S, 'pages', 'about', 'index.html'), salla_page('من نحن | عطور المثال', '<h1>من نحن</h1><p>متجر تجريبي لأغراض الاختبار.</p>'))
write(os.path.join(S, 'pages', 'contact', 'index.html'), salla_page('تواصل معنا | عطور المثال', '<h1>تواصل معنا</h1><form><input type="email"><textarea></textarea></form>'))
write(os.path.join(S, 'robots.txt'), 'User-agent: *\nDisallow: /cart\nSitemap: http://127.0.0.1:4811/sitemap.xml\n')
locs = ''.join(f'<url><loc>http://127.0.0.1:4811/{s}/p{p}</loc></url>' for s, p, *_ in salla_products) + ''.join(f'<url><loc>http://127.0.0.1:4811/{c}/c{cid}</loc></url>' for c, (n, cid) in cats.items())
write(os.path.join(S, 'sitemap.xml'), f'<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{locs}</urlset>')
flat_png(os.path.join(S, 'logo.png'), 240, 80, (91, 42, 134))
noisy_jpeg(os.path.join(S, 'banners', 'b1.jpg'), 1920, 600)
noisy_jpeg(os.path.join(S, 'banners', 'b2.jpg'), 1100, 620, quality=70)
write(os.path.join(S, 'catalog.json'), json.dumps([{'url': f'/{s}/p{p}', 'name': n, 'price': pr} for s, p, n, c, pr, _ in salla_products], ensure_ascii=False))

# ── Shopify-style English store ──────────────────────────────────────────────
H = os.path.join(ROOT, 'shopify')
shop_products = [(f'linen-shirt-{i}', f'Linen Shirt {c}', 120 + i * 10, c) for i, c in enumerate(['Sand', 'Navy', 'Olive', 'White', 'Black', 'Rust', 'Sky', 'Stone'])]
SHOP_HEAD = '<link rel="stylesheet" href="//cdn.shopify.com/s/files/1/0001/t/1/assets/base.css"><script>window.Shopify = {}; Shopify.theme = {"name":"Dawn"}; Shopify.shop = "example-store.myshopify.com";</script>'
def shop_page(title, body, extra=''):
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{title}</title>
<meta property="og:site_name" content="Example Linen Co"><meta name="description" content="Breathable linen shirts made for hot summers. Free delivery in Riyadh, Jeddah and Dammam.">
<style>body{{font-family:Georgia,serif;margin:0}} header{{padding:12px;border-bottom:1px solid #ddd}} .btn{{background:#1f4d3a;color:#fff;padding:14px 24px;display:inline-block}} img{{max-width:100%}}</style>{SHOP_HEAD}{extra}</head>
<body><header><a href="/"><img src="/logo.png" alt="Example Linen Co" class="header__logo"></a><nav><a href="/collections/shirts">Shirts</a><a href="/collections/new">New</a><a href="/pages/about">About</a><a href="/cart">Cart</a></nav>
<form action="/search" method="get"><input type="search" name="q" placeholder="Search"><input type="hidden" name="type" value="product"></form></header>{body}
<footer><a href="mailto:hello@example.invalid">Email</a><a href="/policies/refund-policy">Refund policy</a><p>Shipping across Saudi Arabia. We accept Visa, Mastercard, mada and Tabby.</p></footer></body></html>'''
write(os.path.join(H, 'index.html'), shop_page('Example Linen Co – Linen shirts', f'''<div class="slideshow"><a href="/collections/new"><picture><source media="(max-width: 749px)" srcset="/banners/m1.jpg"><img src="/banners/d1.jpg" alt="New summer linen" width="1920" height="800"></picture></a></div>
<h1>Linen for the Saudi summer</h1><a class="btn" href="/collections/shirts">Shop shirts</a><div>{''.join(f'<a href="/products/{h}"><img src="/img/{h}.png" alt="{t}" width="300" height="300">{t}</a>' for h, t, p, c in shop_products[:4])}</div>'''))
for h, t, p, c in shop_products:
    ld = {'@context': 'https://schema.org', '@type': 'Product', 'name': t, 'image': [f'/img/{h}.png', f'/img/{h}-b.png', f'/img/{h}-c.png'], 'description': f'A relaxed {c.lower()} linen shirt cut for warm weather. Pre-washed for softness, with a classic collar and mother-of-pearl buttons. Available in sizes S to XXL.', 'offers': {'@type': 'Offer', 'price': f'{p}.00', 'priceCurrency': 'SAR', 'availability': 'https://schema.org/InStock'}}
    write(os.path.join(H, 'products', h, 'index.html'), shop_page(f'{t} – Example Linen Co', f'<h1>{t}</h1><p>SAR {p}.00</p><form action="/cart/add" method="post"><button type="submit">Add to cart</button></form><h2>You may also like</h2>', f'<script type="application/ld+json">{json.dumps(ld)}</script>'))
    flat_png(os.path.join(H, 'img', f'{h}.png'), 300, 300, (220, 210, 190))
for col, items in [('shirts', shop_products), ('new', shop_products[:3])]:
    write(os.path.join(H, 'collections', col, 'index.html'), shop_page(f'{col.title()} – Example Linen Co', ''.join(f'<a href="/products/{h}">{t}</a>' for h, t, p, c in items)))
write(os.path.join(H, 'pages', 'about', 'index.html'), shop_page('About – Example Linen Co', '<h1>About us</h1><p>A synthetic test store.</p>'))
write(os.path.join(H, 'robots.txt'), 'User-agent: *\nDisallow: /cart\nDisallow: /search\nDisallow: /checkout\nSitemap: http://127.0.0.1:4812/sitemap.xml\n')
write(os.path.join(H, 'sitemap.xml'), '<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>http://127.0.0.1:4812/sitemap_products_1.xml</loc></sitemap><sitemap><loc>http://127.0.0.1:4812/sitemap_collections_1.xml</loc></sitemap></sitemapindex>')
write(os.path.join(H, 'sitemap_products_1.xml'), '<?xml version="1.0"?><urlset>' + ''.join(f'<url><loc>http://127.0.0.1:4812/products/{h}</loc></url>' for h, *_ in shop_products) + '</urlset>')
write(os.path.join(H, 'sitemap_collections_1.xml'), '<?xml version="1.0"?><urlset><url><loc>http://127.0.0.1:4812/collections/shirts</loc></url></urlset>')
write(os.path.join(H, 'products.json'), json.dumps({'products': [{'title': t, 'handle': h, 'body_html': f'<p>{c} linen shirt.</p>', 'images': [{'src': f'/img/{h}.png'}], 'variants': [{'price': f'{p}.00', 'available': True}]} for h, t, p, c in shop_products]}))
flat_png(os.path.join(H, 'logo.png'), 220, 60, (31, 77, 58))
noisy_jpeg(os.path.join(H, 'banners', 'd1.jpg'), 1920, 800, quality=60)
noisy_jpeg(os.path.join(H, 'banners', 'm1.jpg'), 750, 940, quality=60)

# ── Corporate services website ───────────────────────────────────────────────
C = os.path.join(ROOT, 'corporate')
def corp(title, body):
    return f'''<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{title}</title>
<meta name="description" content="شركة استشارات هندسية ومقاولات في الرياض تقدم خدمات التصميم والإشراف وإدارة المشاريع.">
<script type="application/ld+json">{{"@context":"https://schema.org","@type":"Organization","name":"شركة المثال للاستشارات الهندسية","logo":"http://127.0.0.1:4813/logo.png"}}</script>
<style>body{{font-family:Arial;margin:0}} .cta{{background:#0c5c75;color:#fff;padding:14px 22px;display:inline-block}}</style></head>
<body><header><img src="/logo.png" alt="شركة المثال"><nav><a href="/">الرئيسية</a><a href="/services/">خدماتنا</a><a href="/about/">من نحن</a><a href="/contact/">تواصل معنا</a></nav></header>{body}
<footer><a href="tel:+966112345678">اتصل بنا</a><a href="mailto:info@example.invalid">البريد</a><a href="https://www.linkedin.com/company/example">LinkedIn</a></footer></body></html>'''
write(os.path.join(C, 'index.html'), corp('شركة المثال | استشارات هندسية ومقاولات', '<h1>حلول هندسية متكاملة لمشاريعك</h1><p>خدماتنا تشمل التصميم المعماري والإشراف الهندسي وإدارة المشاريع ومقاولات البناء.</p><a class="cta" href="/contact/">اطلب عرض سعر</a><h2>خدماتنا</h2><ul><li>التصميم المعماري</li><li>الإشراف الهندسي</li><li>إدارة المشاريع</li></ul>'))
write(os.path.join(C, 'about', 'index.html'), corp('من نحن | شركة المثال', '<h1>من نحن</h1><p>رؤيتنا ورسالتنا وفريق العمل.</p>'))
write(os.path.join(C, 'services', 'index.html'), corp('خدماتنا | شركة المثال', '<h1>خدماتنا</h1><p>مقاولات وإنشاءات وصيانة.</p>'))
write(os.path.join(C, 'contact', 'index.html'), corp('تواصل معنا | شركة المثال', '<h1>تواصل معنا</h1><form><input type="email" name="email"><textarea name="msg"></textarea><button>إرسال</button></form>'))
flat_png(os.path.join(C, 'logo.png'), 200, 70, (12, 92, 117))

# ── Law firm (consultations by appointment, WhatsApp, no prices) ─────────────
L = os.path.join(ROOT, 'law')
def law(title, body):
    return f'''<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{title}</title>
<meta name="description" content="شركة محاماة واستشارات قانونية في جدة: قضايا تجارية وعمالية وأحوال شخصية وصياغة العقود.">
<meta property="og:title" content="مكتب المثال للمحاماة"><meta property="og:image" content="http://127.0.0.1:4814/logo.png">
<script type="application/ld+json">{{"@context":"https://schema.org","@type":"LegalService","name":"مكتب المثال للمحاماة والاستشارات القانونية","address":{{"@type":"PostalAddress","addressLocality":"جدة","addressCountry":"SA"}}}}</script>
<style>body{{font-family:Arial;margin:0}} .cta{{background:#1d2b4f;color:#fff;padding:14px 22px;display:inline-block}}</style></head>
<body><header><img src="/logo.png" alt="مكتب المثال للمحاماة"><nav><a href="/">الرئيسية</a><a href="/practice-areas/">مجالات الممارسة</a><a href="/about/">من نحن</a><a href="/book/">احجز استشارة</a><a href="/contact/">تواصل معنا</a></nav></header>{body}
<footer><a href="https://wa.me/966500000000">واتساب</a><a href="tel:+966126543210">اتصل بنا</a><a href="/privacy/">سياسة الخصوصية</a><p>السجل التجاري 4030000000</p></footer></body></html>'''
write(os.path.join(L, 'index.html'), law('مكتب المثال للمحاماة | استشارات قانونية في جدة', '<h1>محامون ومستشارون قانونيون في جدة</h1><p>نمثّل الشركات والأفراد في القضايا التجارية والعمالية ونقدم أفضل الخدمات القانونية.</p><a class="cta" href="/book/">احجز استشارة</a><section><h2>مجالات الممارسة</h2><div><h3>القضايا التجارية</h3><p>نزاعات الشركات.</p></div><div><h3>القضايا العمالية</h3><p>للشركات والأفراد.</p></div><div><h3>الأحوال الشخصية</h3><p>قضايا الأسرة.</p></div><div><h3>صياغة العقود</h3><p>مراجعة وصياغة.</p></div></section>'))
write(os.path.join(L, 'practice-areas', 'index.html'), law('مجالات الممارسة | مكتب المثال', '<main><h1>مجالات الممارسة</h1><h2>القضايا التجارية</h2><h2>القضايا العمالية</h2><h2>التحكيم</h2></main>'))
write(os.path.join(L, 'about', 'index.html'), law('من نحن | مكتب المثال', '<h1>من نحن</h1><p>فريق من المحامين المرخصين.</p>'))
write(os.path.join(L, 'book', 'index.html'), law('احجز استشارة | مكتب المثال', '<h1>احجز موعد استشارة</h1><p>اختر الوقت المناسب لك.</p><iframe src="https://calendly.com/example-law/consultation"></iframe>'))
write(os.path.join(L, 'contact', 'index.html'), law('تواصل معنا | مكتب المثال', '<h1>تواصل معنا</h1><form><input type="text" name="name"><input type="tel" name="phone"><textarea name="msg"></textarea><button>إرسال</button></form><address>جدة، حي الروضة</address>'))
write(os.path.join(L, 'privacy', 'index.html'), law('سياسة الخصوصية | مكتب المثال', '<h1>سياسة الخصوصية</h1><p>نحافظ على سرية بياناتك.</p>'))
flat_png(os.path.join(L, 'logo.png'), 200, 70, (29, 43, 79))

# ── Restaurant with a menu only (no online ordering or payment) ──────────────
R = os.path.join(ROOT, 'restaurant')
def rest(title, body):
    return f'''<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{title}</title>
<meta name="description" content="مطعم مشويات ومندي في الرياض. قائمة الطعام وأوقات العمل والموقع.">
<script type="application/ld+json">{{"@context":"https://schema.org","@type":"Restaurant","name":"مطعم المثال للمشويات","servesCuisine":"مشويات","openingHours":"Mo-Su 12:00-00:00","address":{{"@type":"PostalAddress","addressLocality":"الرياض","addressCountry":"SA"}}}}</script>
<style>body{{font-family:Arial;margin:0}} .cta{{background:#a33b1f;color:#fff;padding:14px 22px;display:inline-block}}</style></head>
<body><header><img src="/logo.png" alt="مطعم المثال"><nav><a href="/">الرئيسية</a><a href="/menu/">المنيو</a><a href="/contact/">تواصل معنا</a></nav></header>{body}
<footer><a href="tel:+966114445566">اتصل للحجز</a><a href="https://instagram.com/example">Instagram</a></footer></body></html>'''
write(os.path.join(R, 'index.html'), rest('مطعم المثال للمشويات | الرياض', '<h1>مشويات على الفحم كل يوم</h1><p>مندي ومشويات وكبسة في قلب الرياض.</p><a class="cta" href="/menu/">قائمة الطعام</a><h2>ساعات العمل</h2><p>يومياً من 12 ظهراً حتى 12 منتصف الليل</p><iframe src="https://www.google.com/maps/embed?pb=example"></iframe>'))
write(os.path.join(R, 'menu', 'index.html'), rest('المنيو | مطعم المثال', '<main><h1>المنيو</h1><h2>مشويات</h2><p>شيش طاووق 35 ريال</p><p>كباب 40 ريال</p><h2>مندي</h2><p>مندي لحم 65 ريال</p></main>'))
write(os.path.join(R, 'contact', 'index.html'), rest('تواصل معنا | مطعم المثال', '<h1>تواصل معنا</h1><p>الرياض، طريق الملك فهد</p><a href="https://maps.google.com/?q=example">الموقع على الخريطة</a>'))
flat_png(os.path.join(R, 'logo.png'), 200, 70, (163, 59, 31))

# ── SaaS product (pricing plans, free trial, sign-up) ────────────────────────
S = os.path.join(ROOT, 'saas')
def saas(title, body):
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{title}</title>
<meta name="description" content="Invoicing software for small businesses in Saudi Arabia. Create ZATCA-ready invoices in seconds.">
<script type="application/ld+json">{{"@context":"https://schema.org","@type":"SoftwareApplication","name":"ExampleBooks","applicationCategory":"BusinessApplication"}}</script>
<style>body{{font-family:Arial;margin:0}} .cta{{background:#3b5bdb;color:#fff;padding:14px 22px;display:inline-block}}</style></head>
<body><header><img src="/logo.png" alt="ExampleBooks"><nav><a href="/">Home</a><a href="/features/">Features</a><a href="/pricing/">Pricing</a><a href="/signup/">Sign up</a></nav></header>{body}
<footer><a href="mailto:hello@example.invalid">Email</a><a href="/privacy/">Privacy</a></footer></body></html>'''
write(os.path.join(S, 'index.html'), saas('ExampleBooks | Invoicing software for small businesses', '<h1>Invoicing software for small businesses</h1><p>Cloud software that creates e-invoices for businesses and their teams. Start your free trial today.</p><a class="cta" href="/signup/">Start free trial</a>'))
write(os.path.join(S, 'pricing', 'index.html'), saas('Pricing | ExampleBooks', '<main><h1>Pricing</h1><div><h2>Starter</h2><p>49 SAR per month, billed monthly</p></div><div><h2>Business</h2><p>99 SAR per month</p></div><a href="/signup/">Start free trial</a></main>'))
write(os.path.join(S, 'features', 'index.html'), saas('Features | ExampleBooks', '<main><h1>Features</h1><h2>E-invoices</h2><h2>Reports</h2></main>'))
write(os.path.join(S, 'privacy', 'index.html'), saas('Privacy | ExampleBooks', '<h1>Privacy</h1>'))
flat_png(os.path.join(S, 'logo.png'), 200, 70, (59, 91, 219))

# ── Shared helper for the extra sites ────────────────────────────────────────
def site(root, lang, head, nav, footer):
    d = 'rtl' if lang == 'ar' else 'ltr'
    def page(title, body, desc=''):
        return (f'<!doctype html><html lang="{lang}" dir="{d}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
                f'<title>{title}</title>{head}' + (f'<meta name="description" content="{desc}">' if desc else '') +
                '<style>body{font-family:Arial;margin:0;line-height:1.6} header,section,footer{padding:24px} .cta{background:#0d3b66;color:#fff;padding:14px 22px;display:inline-block;border-radius:8px} img{max-width:100%;height:auto}</style></head>'
                f'<body><header><img src="/logo.png" alt="logo" width="160" height="50"><nav>{nav}</nav></header>{body}<footer>{footer}</footer></body></html>')
    return page

def imgs(root, names, size=(800, 500), color=(90, 120, 150)):
    for n in names:
        flat_png(os.path.join(root, n), size[0], size[1], color)

# ── Tourism company: trip packages, online booking requests ──────────────────
T = os.path.join(ROOT, 'tourism')
tp = site(T, 'ar', '<script type="application/ld+json">{"@type":"TravelAgency","name":"رحلات المثال","address":{"@type":"PostalAddress","addressLocality":"الرياض","addressCountry":"SA"}}</script>',
          '<a href="/">الرئيسية</a><a href="/trips/">الرحلات</a><a href="/book/">احجز رحلتك</a><a href="/about/">من نحن</a><a href="/contact/">تواصل معنا</a>',
          '<a href="https://wa.me/966511111111">واتساب</a><a href="/privacy/">سياسة الخصوصية</a><a href="https://instagram.com/x">Instagram</a>')
write(os.path.join(T, 'index.html'), tp('رحلات المثال | شركة سياحة وسفر في الرياض', '<section><h1>رحلات سياحية إلى جورجيا وتركيا وأذربيجان</h1><p>باقات سفر عائلية تشمل الطيران والفندق والتنقلات مع مرشد يتحدث العربية.</p><a class="cta" href="/book/">احجز رحلتك</a></section><section><h2>أشهر الباقات</h2><div><img src="/t1.png" alt="جورجيا"><h3>جورجيا 7 أيام</h3><p>تبدأ من 4,500 ريال للشخص</p></div><div><img src="/t2.png" alt="تركيا"><h3>طرابزون 6 أيام</h3><p>تبدأ من 3,900 ريال</p></div><div><img src="/t3.png" alt="أذربيجان"><h3>باكو 5 أيام</h3><p>تبدأ من 3,200 ريال</p></div></section><section><h2>لماذا نحن</h2><p>أكثر من 3000 مسافر منذ 2015.</p></section>', 'شركة سياحة وسفر في الرياض: باقات رحلات عائلية إلى جورجيا وتركيا وأذربيجان مع الطيران والفندق.'))
write(os.path.join(T, 'book', 'index.html'), tp('احجز رحلتك | رحلات المثال', '<h1>احجز رحلتك</h1><form><input type="text" name="name"><input type="tel" name="phone"><input type="date" name="date"><select name="trip"><option>جورجيا</option></select><button>تحقق من التوفر</button></form>'))
write(os.path.join(T, 'about', 'index.html'), tp('من نحن | رحلات المثال', '<h1>من نحن</h1><p>شركة سياحة مرخصة.</p>'))
write(os.path.join(T, 'contact', 'index.html'), tp('تواصل معنا | رحلات المثال', '<h1>تواصل معنا</h1><form><input type="email"><textarea></textarea><button>إرسال</button></form>'))
write(os.path.join(T, 'privacy', 'index.html'), tp('الخصوصية', '<h1>سياسة الخصوصية</h1>'))
imgs(T, ['t1.png', 't2.png', 't3.png']); flat_png(os.path.join(T, 'logo.png'), 160, 50, (13, 59, 102))

# ── Real estate: listings and viewing appointments ───────────────────────────
E = os.path.join(ROOT, 'realestate')
ep = site(E, 'ar', '<script type="application/ld+json">{"@type":"RealEstateAgent","name":"عقارات المثال"}</script>',
          '<a href="/">الرئيسية</a><a href="/properties/">العقارات</a><a href="/contact/">تواصل معنا</a>',
          '<a href="tel:+966122222222">اتصل بنا</a><a href="https://wa.me/966522222222">واتساب</a>')
write(os.path.join(E, 'index.html'), ep('عقارات المثال | شقق وفلل للبيع والإيجار في جدة', '<section><h1>شقق وفلل للبيع والإيجار في جدة</h1><p>عقارات سكنية مختارة في أحياء شمال جدة.</p><a class="cta" href="/contact/">احجز موعد معاينة</a></section><section><h2>عقارات مميزة</h2><div><img src="/p1.png" alt="شقة"><h3>شقة 3 غرف للبيع - حي الروضة</h3><p>850,000 ريال</p></div><div><img src="/p2.png" alt="فيلا"><h3>فيلا دورين للإيجار - حي الشاطئ</h3><p>120,000 ريال سنوياً</p></div></section>', 'عقارات للبيع والإيجار في جدة: شقق وفلل مع معاينة بموعد.'))
write(os.path.join(E, 'contact', 'index.html'), ep('تواصل | عقارات المثال', '<h1>احجز موعد معاينة</h1><form><input type="tel"><input type="date"><textarea></textarea><button>إرسال</button></form>'))
imgs(E, ['p1.png', 'p2.png']); flat_png(os.path.join(E, 'logo.png'), 160, 50, (120, 80, 40))

# ── Medical clinic: specialties, doctors, appointment booking ────────────────
M = os.path.join(ROOT, 'clinic')
mp = site(M, 'ar', '<script type="application/ld+json">{"@type":"MedicalClinic","name":"عيادات المثال","openingHours":"Sa-Th 09:00-22:00","address":{"@type":"PostalAddress","addressLocality":"الدمام","addressCountry":"SA"}}</script>',
          '<a href="/">الرئيسية</a><a href="/services/">العيادات</a><a href="/booking/">حجز موعد</a><a href="/contact/">تواصل معنا</a>',
          '<a href="tel:+966133333333">اتصل بنا</a><a href="/privacy/">سياسة الخصوصية</a>')
write(os.path.join(M, 'index.html'), mp('عيادات المثال | طب الأسنان والجلدية في الدمام', '<section><h1>عيادات طب الأسنان والجلدية في الدمام</h1><p>أطباء استشاريون ومواعيد مسائية.</p><a class="cta" href="/booking/">احجز موعدك</a></section><section><h2>العيادات</h2><div><h3>طب الأسنان</h3></div><div><h3>الجلدية والتجميل</h3></div><div><h3>طب الأطفال</h3></div></section><section><h2>ساعات العمل</h2><p>من السبت إلى الخميس 9 صباحاً - 10 مساءً</p><iframe src="https://www.google.com/maps/embed?pb=x"></iframe></section>', 'عيادات طب الأسنان والجلدية والأطفال في الدمام مع حجز موعد إلكتروني.'))
write(os.path.join(M, 'booking', 'index.html'), mp('حجز موعد | عيادات المثال', '<h1>حجز موعد</h1><form><select name="clinic"><option>الأسنان</option></select><input type="date"><input type="time"><input type="tel"><button>احجز</button></form>'))
write(os.path.join(M, 'privacy', 'index.html'), mp('الخصوصية', '<h1>سياسة الخصوصية</h1>'))
flat_png(os.path.join(M, 'logo.png'), 160, 50, (20, 140, 140))

# ── Custom-built store (no known platform signature) ─────────────────────────
K = os.path.join(ROOT, 'customstore')
kp = site(K, 'ar', '', '<a href="/">الرئيسية</a><a href="/category/dates/">التمور</a><a href="/category/coffee/">القهوة</a><a href="/cart">السلة</a>',
          '<p>نقبل: مدى، Apple Pay، Visa</p><a href="/policy/returns">سياسة الاسترجاع</a><a href="/policy/shipping">الشحن والتوصيل</a>')
def prod(slug, name, price):
    return f'<div class="product-card"><a href="/product/{slug}"><img src="/{slug}.png" alt="{name}"><h3>{name}</h3></a><span>{price} ر.س</span><button>أضف إلى السلة</button></div>'
items = [('sukkari', 'تمر سكري فاخر 1 كجم', 45), ('ajwa', 'عجوة المدينة 1 كجم', 90), ('khawlani', 'قهوة خولانية 500 جم', 65), ('saffron', 'زعفران 10 جم', 55)]
write(os.path.join(K, 'index.html'), kp('متجر المثال للتمور والقهوة', '<section><h1>تمور وقهوة سعودية فاخرة</h1><a class="cta" href="/category/dates/">تسوق الآن</a></section><section><h2>الأكثر مبيعاً</h2>' + ''.join(prod(*i) for i in items) + '</section>', 'متجر تمور وقهوة سعودية فاخرة مع توصيل لجميع مدن المملكة.'))
for slug, name, price in items:
    write(os.path.join(K, 'product', slug, 'index.html'), kp(f'{name} | متجر المثال', f'<main><h1>{name}</h1><img src="/{slug}.png" alt="{name}"><img src="/{slug}.png" alt="{name}"><p class="price">{price} ر.س</p><p>متوفر</p><p>منتج سعودي طبيعي 100٪ معبأ بعناية ويُحفظ في مكان بارد وجاف. مناسب للضيافة والهدايا.</p><button>أضف إلى السلة</button></main><script type="application/ld+json">{{"@type":"Product","name":"{name}","offers":{{"@type":"Offer","price":"{price}","priceCurrency":"SAR","availability":"https://schema.org/InStock"}}}}</script>'))
    flat_png(os.path.join(K, f'{slug}.png'), 600, 600, (150, 110, 60))
for c in ['dates', 'coffee']:
    write(os.path.join(K, 'category', c, 'index.html'), kp(c, '<main>' + ''.join(prod(*i) for i in items) + '</main>'))
write(os.path.join(K, 'policy', 'returns', 'index.html'), kp('الاسترجاع', '<h1>سياسة الاسترجاع</h1>'))
write(os.path.join(K, 'policy', 'shipping', 'index.html'), kp('الشحن', '<h1>الشحن والتوصيل</h1><p>التوصيل خلال 2-4 أيام.</p>'))
flat_png(os.path.join(K, 'logo.png'), 160, 50, (110, 70, 30))

# ── Law firm, complete and well-structured (to compare with the thin one) ────
W = os.path.join(ROOT, 'lawrich')
wp = site(W, 'ar', '<meta property="og:title" content="المثال للمحاماة"><meta property="og:image" content="http://127.0.0.1:4821/logo.png"><script type="application/ld+json">{"@type":"LegalService","name":"شركة المثال للمحاماة","address":{"@type":"PostalAddress","addressLocality":"الرياض","addressCountry":"SA"}}</script>',
          '<a href="/">الرئيسية</a><a href="/services/">خدماتنا</a><a href="/team/">فريقنا</a><a href="/about/">من نحن</a><a href="/book/">احجز استشارة</a><a href="/contact/">تواصل معنا</a>',
          '<a href="https://wa.me/966544444444">واتساب</a><a href="tel:+966114444444">اتصل بنا</a><a href="mailto:info@example.invalid">البريد</a><a href="/privacy/">سياسة الخصوصية</a><a href="https://www.linkedin.com/company/x">LinkedIn</a><p>ترخيص وزارة العدل رقم 123 · السجل التجاري 1010000000</p><address>الرياض، طريق الملك فهد</address>')
body = ('<section><h1>شركة محاماة متخصصة في قضايا الشركات والعمل في الرياض</h1><p>نمثّل الشركات الناشئة والمتوسطة أمام المحاكم التجارية والعمالية، ونصيغ عقودها ونراجع امتثالها للأنظمة السعودية منذ 2008.</p><a class="cta" href="/book/">احجز استشارة أولية</a><img src="/office.png" alt="مكتب الشركة"></section>'
        '<section><h2>خدماتنا</h2><div><img src="/s1.png" alt=""><h3>القضايا التجارية</h3><p>تمثيل في نزاعات الشركاء والعقود والتحصيل أمام المحاكم التجارية ومراكز التحكيم.</p></div><div><img src="/s2.png" alt=""><h3>قضايا العمل</h3><p>تمثيل أصحاب العمل في الدعاوى العمالية وصياغة اللوائح الداخلية وعقود الموظفين.</p></div><div><img src="/s3.png" alt=""><h3>تأسيس الشركات</h3><p>تأسيس الكيانات واتفاقيات الشركاء ونقل الملكية والتراخيص.</p></div><div><h3>صياغة العقود</h3><p>عقود التوريد والتوزيع والامتياز وعقود التقنية.</p></div></section>'
        '<section><h2>أرقامنا</h2><p>أكثر من 900 قضية منذ 2008 · 120 شركة عميلة · 15 محامياً مرخصاً</p></section>'
        '<section><h2>فريق المحامين</h2><div><img src="/l1.png" alt="المحامي أحمد"><h3>أحمد العتيبي</h3><p>شريك مؤسس، محامٍ مرخص منذ 2008</p></div><div><img src="/l2.png" alt="المحامية سارة"><h3>سارة القحطاني</h3><p>رئيسة قسم قضايا العمل</p></div></section>'
        '<section><h2>آراء عملائنا</h2><blockquote>"حسموا نزاع الشراكة خلال أربعة أشهر." — مدير شركة تقنية</blockquote><blockquote>"عقود واضحة وفريق متجاوب." — مؤسسة تجارية</blockquote></section>'
        '<section><h2>كيف نعمل</h2><p>استشارة أولية، ثم دراسة المستندات، ثم خطة عمل مكتوبة بالأتعاب والجدول الزمني.</p></section>'
        '<section><h2>الأسئلة الشائعة</h2><h3>كم تكلفة الاستشارة الأولية؟</h3><p>تُحدد حسب نوع القضية ونبلغك بها قبل الموعد.</p></section>')
write(os.path.join(W, 'index.html'), wp('شركة المثال للمحاماة | قضايا الشركات والعمل في الرياض', body, 'شركة محاماة في الرياض متخصصة في القضايا التجارية والعمالية وتأسيس الشركات وصياغة العقود منذ 2008.'))
write(os.path.join(W, 'services', 'index.html'), wp('خدماتنا', '<main><h1>خدماتنا</h1><h2>القضايا التجارية</h2><h2>قضايا العمل</h2><h2>تأسيس الشركات</h2><h2>صياغة العقود</h2></main>'))
write(os.path.join(W, 'about', 'index.html'), wp('من نحن', '<h1>من نحن</h1><p>تأسست الشركة في 2008.</p>'))
write(os.path.join(W, 'book', 'index.html'), wp('احجز استشارة', '<h1>احجز موعد استشارة</h1><iframe src="https://calendly.com/x/consultation"></iframe>'))
write(os.path.join(W, 'contact', 'index.html'), wp('تواصل معنا', '<h1>تواصل معنا</h1><form><input type="text"><input type="tel"><input type="email"><textarea></textarea><button>إرسال</button></form>'))
write(os.path.join(W, 'privacy', 'index.html'), wp('الخصوصية', '<h1>سياسة الخصوصية</h1>'))
write(os.path.join(W, 'sitemap.xml'), '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>http://127.0.0.1:4821/</loc></url><url><loc>http://127.0.0.1:4821/services/</loc></url></urlset>')
imgs(W, ['office.png', 's1.png', 's2.png', 's3.png', 'l1.png', 'l2.png']); flat_png(os.path.join(W, 'logo.png'), 160, 50, (29, 43, 79))

# ── A very thin generic company site (weak signals) ──────────────────────────
G = os.path.join(ROOT, 'thin')
write(os.path.join(G, 'index.html'), '<!doctype html><html><head><title>Welcome</title></head><body><h1>Welcome to our company</h1><p>We provide the best services and innovative solutions.</p><a href="mailto:info@example.invalid">Contact</a></body></html>')

print('built', ROOT)
