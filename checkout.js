// PABEL GLOBAL LLC - On-site card payment with Stripe Elements (Visa, Mastercard, Amex... credit & debit)
// Depends on script.js: cart (declared with `let`), closeCartDrawer(), updateCartView(), showToast().
// Depends on Stripe.js (https://js.stripe.com/v3/) loaded in index.html.

// URL of the server function. Same site on Netlify/Vercel -> keep as is.
// If your website is hosted somewhere else, use the full URL of your function here.
const PAYMENT_API = '/api/create-payment-intent';

let stripeInstance = null;
let elementsInstance = null;
let paymentElement = null;
let currentOrder = null; // { orderId, amountCents, email }

const $ = (id) => document.getElementById(id);
const money = (n) => `$${Number(n).toFixed(2)}`;

function getCartTotals() {
  const totalCount = cart.reduce((sum, item) => sum + Number(item.qty), 0);
  const subtotal = cart.reduce((sum, item) => sum + Number(item.price) * Number(item.qty), 0);
  return { totalCount, subtotal };
}

function showStep(step) {
  $('checkoutForm').hidden = step !== 'details';
  $('payStep').hidden = step !== 'pay';
  $('paidStep').hidden = step !== 'paid';
}

function setText(id, msg) {
  const el = $(id);
  if (el) el.textContent = msg || '';
}

function setButton(btnId, textId, disabled, label) {
  $(btnId).disabled = disabled;
  $(textId).textContent = label;
}

function destroyPaymentElement() {
  try { if (paymentElement) paymentElement.destroy(); } catch (e) {}
  paymentElement = null;
  elementsInstance = null;
}

function openCheckoutModal() {
  if (!Array.isArray(cart) || cart.length === 0) {
    alert('Your cart is empty. Please add a product first.');
    return;
  }
  const { totalCount, subtotal } = getCartTotals();

  const list = $('modalItems');
  list.innerHTML = '';
  cart.forEach((item) => {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = `${item.title} × ${item.qty}`;
    const price = document.createElement('strong');
    price.textContent = money(Number(item.price) * Number(item.qty));
    li.append(name, price);
    list.appendChild(li);
  });

  $('modalItemCount').textContent = `${totalCount} item(s)`;
  $('modalTotalSum').textContent = `${money(subtotal)} USD`;
  setText('checkoutError', '');
  setText('paymentError', '');
  setButton('payBtn', 'payBtnText', false, 'Continue to Card Payment');
  destroyPaymentElement();
  showStep('details');

  closeCartDrawer();
  $('checkoutModal').classList.add('open');
}

function closeCheckoutModal() {
  $('checkoutModal').classList.remove('open');
}

function backToDetails() {
  destroyPaymentElement();
  setText('paymentError', '');
  showStep('details');
}

// Step 1: send cart + delivery details to our server, get a secure payment session
async function handleLlcCheckout(e) {
  e.preventDefault();
  setText('checkoutError', '');

  if (window.location.protocol === 'file:') {
    setText('checkoutError', 'Checkout works on the live website only (not from a local file).');
    return;
  }
  if (typeof Stripe === 'undefined') {
    setText('checkoutError', 'The secure payment library could not load. Check your internet and refresh the page.');
    return;
  }

  const customer = {
    name: $('chkName').value.trim(),
    email: $('chkEmail').value.trim(),
    phone: $('chkPhone').value.trim(),
    address: {
      line1: $('chkAddress').value.trim(),
      city: $('chkCity').value.trim(),
      state: $('chkState').value.trim(),
      postal_code: $('chkZip').value.trim(),
      country: $('chkCountry').value
    }
  };

  setButton('payBtn', 'payBtnText', true, 'Preparing secure payment...');

  try {
    const res = await fetch(PAYMENT_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: cart.map((item) => ({ title: item.title, qty: item.qty })),
        customer
      })
    });
    const data = await res.json().catch(() => null);
    if (!data) {
      if (res.status === 404 || res.status === 405) {
        throw new Error(`Checkout server not found (error ${res.status}). The server function must be deployed on Netlify/Vercel.`);
      }
      throw new Error(`Checkout server error (${res.status}). Please try again later.`);
    }
    if (!res.ok || !data.clientSecret) {
      throw new Error(data.error || 'Payment could not be started. Please try again.');
    }

    currentOrder = { orderId: data.orderId, amountCents: data.amount, email: customer.email };

    // Always show the amount the SERVER calculated
    const amountText = `${money(data.amount / 100)} USD`;
    $('modalTotalSum').textContent = amountText;
    $('payAmount').textContent = amountText;
    $('payNowText').textContent = `Pay ${money(data.amount / 100)}`;

    destroyPaymentElement();
    stripeInstance = Stripe(data.publishableKey);
    elementsInstance = stripeInstance.elements({
      clientSecret: data.clientSecret,
      appearance: {
        theme: 'stripe',
        variables: { colorPrimary: '#b8860b', borderRadius: '6px', fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }
      }
    });
    paymentElement = elementsInstance.create('payment', { layout: 'tabs' });
    paymentElement.mount($('paymentElement'));

    setButton('payNowBtn', 'payNowText', false, `Pay ${money(data.amount / 100)}`);
    showStep('pay');
  } catch (err) {
    setText('checkoutError', err.message || 'Payment could not be started. Please try again.');
  } finally {
    setButton('payBtn', 'payBtnText', false, 'Continue to Card Payment');
  }
}

// Step 2: customer pays with the card
async function handlePayment(e) {
  e.preventDefault();
  if (!stripeInstance || !elementsInstance || !currentOrder) return;

  setText('paymentError', '');
  const label = `Pay ${money(currentOrder.amountCents / 100)}`;
  setButton('payNowBtn', 'payNowText', true, 'Processing payment...');

  try {
    const { error, paymentIntent } = await stripeInstance.confirmPayment({
      elements: elementsInstance,
      confirmParams: { return_url: window.location.origin + window.location.pathname + '?paid=1' },
      redirect: 'if_required'
    });

    if (error) {
      setText('paymentError', error.message || 'Your payment could not be completed. Please check your card details.');
      setButton('payNowBtn', 'payNowText', false, label);
      return;
    }

    if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')) {
      $('paidAmount').textContent = `${money(currentOrder.amountCents / 100)} USD`;
      $('paidRef').textContent = currentOrder.orderId;
      $('paidEmail').textContent = currentOrder.email;
      destroyPaymentElement();
      showStep('paid');
      cart = [];
      updateCartView();
      return;
    }

    setText('paymentError', 'Payment was not completed. Please try again.');
    setButton('payNowBtn', 'payNowText', false, label);
  } catch (err) {
    setText('paymentError', 'Something went wrong. Please try again.');
    setButton('payNowBtn', 'payNowText', false, label);
  }
}

(function initCheckoutUi() {
  const modal = $('checkoutModal');
  if (modal) {
    modal.addEventListener('click', (e) => { if (e.target === modal) closeCheckoutModal(); });
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCheckoutModal(); });

  // Coming back from a bank / 3-D Secure redirect
  const params = new URLSearchParams(window.location.search);
  if (params.get('paid') === '1') {
    const status = params.get('redirect_status');
    if (status === 'succeeded') {
      cart = [];
      updateCartView();
      showToast('Payment received. Thank you for your order!');
    } else if (status === 'failed') {
      showToast('Payment failed. Please try again.');
    }
    window.history.replaceState({}, '', window.location.pathname);
  }
})();
