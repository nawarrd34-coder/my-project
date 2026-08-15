// ---------- Data ----------
const PRODUCTS = [
  { id: 1, name: "Blush Peony Bunch", category: "bouquet", price: 48, emoji: "🌸", tint: "#fbe9ee", desc: "A romantic mix of peonies and garden roses." },
  { id: 2, name: "Sunlit Wildflowers", category: "bouquet", price: 38, emoji: "🌼", tint: "#fff4e0", desc: "Cheerful field blooms, loosely tied." },
  { id: 3, name: "Fiddle Leaf Fig", category: "plant", price: 65, emoji: "🌿", tint: "#eef3e5", desc: "A statement plant for any bright corner." },
  { id: 4, name: "Terracotta Succulent Trio", category: "plant", price: 32, emoji: "🪴", tint: "#eef3e5", desc: "Low-maintenance succulents in matte pots." },
  { id: 5, name: "Dusty Rose Everlasting", category: "dried", price: 42, emoji: "🥀", tint: "#f3ece0", desc: "Dried roses and pampas — lasts for months." },
  { id: 6, name: "Golden Wheat & Lavender", category: "dried", price: 34, emoji: "🌾", tint: "#f3ece0", desc: "A rustic dried bundle with real lavender." },
  { id: 7, name: "Crimson Rose Dozen", category: "bouquet", price: 55, emoji: "🌹", tint: "#fbe9ee", desc: "A classic dozen, hand-tied with eucalyptus." },
  { id: 8, name: "Snake Plant", category: "plant", price: 28, emoji: "🪴", tint: "#eef3e5", desc: "Nearly unkillable and air-purifying." },
  { id: 9, name: "Lavender & Eucalyptus Dry Bunch", category: "dried", price: 30, emoji: "💐", tint: "#f3ece0", desc: "Fragrant, long-lasting, effortlessly styled." },
];

// ---------- State ----------
let cart = [];
let activeFilter = "all";

// ---------- Elements ----------
const productGrid = document.getElementById("productGrid");
const filters = document.getElementById("filters");
const cartBtn = document.getElementById("cartBtn");
const closeCart = document.getElementById("closeCart");
const cartDrawer = document.getElementById("cartDrawer");
const cartOverlay = document.getElementById("cartOverlay");
const cartItemsEl = document.getElementById("cartItems");
const cartTotalEl = document.getElementById("cartTotal");
const cartCountEl = document.getElementById("cartCount");
const toast = document.getElementById("toast");
const newsletterForm = document.getElementById("newsletterForm");
const hamburger = document.getElementById("hamburger");
const nav = document.getElementById("nav");

// ---------- Render products ----------
function renderProducts() {
  const list = activeFilter === "all"
    ? PRODUCTS
    : PRODUCTS.filter(p => p.category === activeFilter);

  productGrid.innerHTML = list.map(p => `
    <article class="product-card">
      <div class="product-thumb" style="background:${p.tint}; font-size:4rem;">${p.emoji}</div>
      <div class="product-body">
        <p class="product-tag">${p.category}</p>
        <h3 class="product-name">${p.name}</h3>
        <p class="product-desc">${p.desc}</p>
        <div class="product-footer">
          <span class="product-price">$${p.price.toFixed(2)}</span>
          <button class="add-btn" data-id="${p.id}">Add to Cart</button>
        </div>
      </div>
    </article>
  `).join("");
}

// ---------- Filters ----------
filters.addEventListener("click", (e) => {
  const btn = e.target.closest(".filter-btn");
  if (!btn) return;
  filters.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  activeFilter = btn.dataset.filter;
  renderProducts();
});

// ---------- Cart logic ----------
function addToCart(id) {
  const product = PRODUCTS.find(p => p.id === Number(id));
  const existing = cart.find(item => item.id === product.id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ ...product, qty: 1 });
  }
  renderCart();
  showToast(`Added "${product.name}" to your cart 🌷`);
}

function removeFromCart(id) {
  cart = cart.filter(item => item.id !== Number(id));
  renderCart();
}

function renderCart() {
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  const totalPrice = cart.reduce((sum, item) => sum + item.qty * item.price, 0);

  cartCountEl.textContent = totalItems;
  cartTotalEl.textContent = `$${totalPrice.toFixed(2)}`;

  cartItemsEl.innerHTML = cart.length === 0
    ? `<p class="cart-empty">Your cart is empty — add a bouquet to get started.</p>`
    : cart.map(item => `
      <div class="cart-item">
        <div class="thumb" style="background:${item.tint}">${item.emoji}</div>
        <div class="info">
          <strong>${item.name}</strong>
          <span>Qty ${item.qty} · $${(item.qty * item.price).toFixed(2)}</span>
        </div>
        <button class="remove-btn" data-id="${item.id}" aria-label="Remove item">✕</button>
      </div>
    `).join("");
}

productGrid.addEventListener("click", (e) => {
  const btn = e.target.closest(".add-btn");
  if (!btn) return;
  addToCart(btn.dataset.id);
});

cartItemsEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".remove-btn");
  if (!btn) return;
  removeFromCart(btn.dataset.id);
});

function openCart() {
  cartDrawer.classList.add("open");
  cartOverlay.classList.add("open");
}
function closeCartDrawer() {
  cartDrawer.classList.remove("open");
  cartOverlay.classList.remove("open");
}

cartBtn.addEventListener("click", openCart);
closeCart.addEventListener("click", closeCartDrawer);
cartOverlay.addEventListener("click", closeCartDrawer);

// ---------- Toast ----------
let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

// ---------- Newsletter ----------
newsletterForm.addEventListener("submit", (e) => {
  e.preventDefault();
  showToast("You're subscribed! Check your inbox for 10% off 🌼");
  newsletterForm.reset();
});

// ---------- Mobile nav ----------
hamburger.addEventListener("click", () => {
  nav.classList.toggle("mobile-open");
  nav.style.display = nav.classList.contains("mobile-open") ? "flex" : "none";
});

// ---------- Footer year ----------
document.getElementById("year").textContent = new Date().getFullYear();

// ---------- Init ----------
renderProducts();
renderCart();
