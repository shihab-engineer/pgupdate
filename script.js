let cart = [];
try {
  const saved = JSON.parse(localStorage.getItem('pg_cart') || '[]');
  if (Array.isArray(saved)) {
    cart = saved
      .filter(i => i && typeof i.title === 'string' && Number(i.price) >= 0 && Number(i.qty) > 0)
      .map(i => ({ title: i.title, price: Number(i.price), image: i.image, qty: Math.floor(Number(i.qty)) }));
  }
} catch (e) { cart = []; }
const cartToggle = document.getElementById('cartToggle');
const cartDrawer = document.getElementById('cartDrawer');
const cartOverlay = document.getElementById('cartOverlay');
const closeCart = document.getElementById('closeCart');
const cartCount = document.getElementById('cartCount');
const drawerCount = document.getElementById('drawerCount');
const cartItemsList = document.getElementById('cartItemsList');
const cartTotalSum = document.getElementById('cartTotalSum');
const toast = document.getElementById('toast');
// Mobile Menu
const menuToggle = document.getElementById('menuToggle');
const navMenu = document.getElementById('navMenu');
if (menuToggle && navMenu) {
  menuToggle.addEventListener('click', () => {
    navMenu.classList.toggle('active');
  });
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      navMenu.classList.remove('active');
    });
  });
}
function openCart() {
  cartDrawer.classList.add('open');
  cartOverlay.classList.add('show');
}
function closeCartDrawer() {
  cartDrawer.classList.remove('open');
  cartOverlay.classList.remove('show');
}
cartToggle.addEventListener('click', openCart);
closeCart.addEventListener('click', closeCartDrawer);
cartOverlay.addEventListener('click', closeCartDrawer);
function addToCart(title, price, image) {
  const existingIndex = cart.findIndex(item => item.title === title);
  if (existingIndex > -1) {
    cart[existingIndex].qty += 1;
  } else {
    cart.push({ title, price, image, qty: 1 });
  }
  updateCartView();
  showToast(`Added: ${title}`);
}
function removeFromCart(index) {
  cart.splice(index, 1);
  updateCartView();
}
function updateCartView() {
  try { localStorage.setItem('pg_cart', JSON.stringify(cart)); } catch (e) {}
  const totalCount = cart.reduce((sum, item) => sum + item.qty, 0);
  cartCount.textContent = totalCount;
  drawerCount.textContent = totalCount;
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  cartTotalSum.textContent = `$${subtotal.toFixed(2)}`;
  if (cart.length === 0) {
    cartItemsList.innerHTML = `
      <div class="empty-cart-msg">
        <i class="fa-solid fa-spoon"></i>
        <p>Your spoon cart is currently empty.</p>
        <small>Browse our 5 featured sets and add your favorites!</small>
      </div>
    `;
    return;
  }
  cartItemsList.innerHTML = cart.map((item, index) => `
    <div class="cart-item">
      <img src="${item.image}" alt="${item.title}" class="cart-item-img">
      <div class="cart-item-details">
        <div class="cart-item-title">${item.title}</div>
        <div class="cart-item-calc">$${item.price.toFixed(2)} &times; ${item.qty} = $${(item.price * item.qty).toFixed(2)}</div>
      </div>
      <button class="cart-item-del" onclick="removeFromCart(${index})" title="Remove item">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    </div>
  `).join('');
}
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2600);
}
// Gallery Filtering
const galleryBtns = document.querySelectorAll('.g-btn');
const galleryCards = document.querySelectorAll('.g-card');
galleryBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    galleryBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const selectedFilter = btn.getAttribute('data-filter');
    galleryCards.forEach(card => {
      const category = card.getAttribute('data-cat');
      if (selectedFilter === 'all' || category === selectedFilter) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    });
  });
});

// Request Spoon Catalog & Quote Form
const quoteForm = document.getElementById('quoteForm');
if (quoteForm) {
  quoteForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('qName').value.trim();
    const email = document.getElementById('qEmail').value.trim();
    const model = document.getElementById('qModel').value.trim();
    const message = document.getElementById('qMessage').value.trim();

    const subject = `PG Brand Quote Request - ${name || 'New Inquiry'}`;
    const body =
      `Name: ${name}\n` +
      `Email: ${email}\n` +
      `Spoon Model / Quantity: ${model}\n\n` +
      `Message:\n${message}`;

    const mailtoLink = `mailto:pabelglobal@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;

    showToast('Opening your email app to send the inquiry...');
    quoteForm.reset();
  });
}

// Show saved cart on page load
updateCartView();
