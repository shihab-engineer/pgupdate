// Netlify function (same logic as api/create-payment-intent.js)
// Creates a Stripe PaymentIntent with the REAL cart total (calculated here on the server).
// Prices live HERE so customers cannot change them from the browser.
// Environment variables needed:
//   STRIPE_SECRET_KEY       (secret key - never put it in a file or GitHub)
//   STRIPE_PUBLISHABLE_KEY  (publishable key, starts with pk_)

// Product title (must match the title in index.html addToCart) -> price in CENTS
const PRODUCTS = {
  'PG White Marble Gold Spoon Set': 450,
  'PG Champagne Gold Signature Serving Set': 550,
  'PG Emerald Green Gold Spoon Set': 400,
  'PG Sleek Mirror Gold 4-Piece Set': 300,
  'PG Carousel Stainless Spoon Set': 350,
  'PG Crimson Silicone Cooking Spoon Set': 250,
  'PG Satin Matte Gold Soup Spoons': 250,
  'PG Two-Tone Hammered Spoon Set': 400,
  'PG Antique Carved Brass Scoop Spoon': 200,
  'PG Banquet Serving Spoon Set': 350,
  'PG Royal Kitchen Ladle Set': 400,
};

// Countries we ship to (2-letter ISO codes). Keep in sync with the country list in index.html.
const COUNTRIES = ['US','CA','GB','AU','NZ','IE','DE','FR','IT','ES','NL','BE','SE','NO','DK','CH','AT','AE','SA','QA','KW','IN','BD','SG','MY','JP'];

const clean = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

const core = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secretKey = (process.env.STRIPE_SECRET_KEY || '').trim();
  const publishableKey = (process.env.STRIPE_PUBLISHABLE_KEY || '').trim();
  if (!secretKey || !publishableKey.startsWith('pk_')) {
    return res.status(500).json({ error: 'Payment is not configured yet. Please contact us.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }
  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    return res.status(400).json({ error: 'Your cart is empty.' });
  }

  // 1) Total from SERVER prices only
  const lineItems = [];
  let total = 0;
  for (const item of body.items) {
    const cents = PRODUCTS[item && item.title];
    const qty = Number(item && item.qty);
    if (!cents || !Number.isInteger(qty) || qty < 1 || qty > 99) {
      return res.status(400).json({ error: 'One of the cart items is invalid. Please refresh and try again.' });
    }
    lineItems.push({ title: item.title, qty });
    total += cents * qty;
  }
  if (total < 50) return res.status(400).json({ error: 'Order total is too small.' });

  // 2) Customer details
  const c = body.customer || {};
  const a = c.address || {};
  const name = clean(c.name, 100);
  const email = clean(c.email, 200);
  const phone = clean(c.phone, 30);
  const line1 = clean(a.line1, 200);
  const city = clean(a.city, 100);
  const state = clean(a.state, 100);
  const postal = clean(a.postal_code, 20);
  const country = clean(a.country, 2).toUpperCase();
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.length < 5 ||
      line1.length < 3 || !city || postal.length < 2 || !COUNTRIES.includes(country)) {
    return res.status(400).json({ error: 'Please fill in all delivery details correctly.' });
  }

  // 3) Create the PaymentIntent (card payments: Visa, Mastercard, Amex, Discover - credit or debit)
  const orderId = 'PG-' + Date.now().toString(36).toUpperCase();
  const params = new URLSearchParams();
  params.append('amount', String(total));
  params.append('currency', 'usd');
  params.append('payment_method_types[]', 'card');
  params.append('receipt_email', email);
  params.append('description', 'PG Brand order ' + orderId);
  params.append('metadata[order_id]', orderId);
  params.append('metadata[customer_phone]', phone);
  params.append('metadata[items]', lineItems.map(li => `${li.title} x${li.qty}`).join('; ').slice(0, 500));
  params.append('shipping[name]', name);
  params.append('shipping[phone]', phone);
  params.append('shipping[address][line1]', line1);
  params.append('shipping[address][city]', city);
  if (state) params.append('shipping[address][state]', state);
  params.append('shipping[address][postal_code]', postal);
  params.append('shipping[address][country]', country);

  try {
    const resp = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + secretKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });
    const data = await resp.json();
    if (!resp.ok || !data.client_secret) {
      console.error('Stripe error:', JSON.stringify(data && data.error ? data.error : data));
      return res.status(502).json({ error: 'Could not start payment. Please try again.' });
    }
    return res.status(200).json({ clientSecret: data.client_secret, publishableKey, amount: total, orderId });
  } catch (err) {
    console.error('Payment error:', err);
    return res.status(500).json({ error: 'Could not start payment. Please try again.' });
  }
};

// ---- Netlify adapter ----
exports.handler = async (event) => {
  const result = { statusCode: 200, headers: {}, body: '' };
  const res = {
    setHeader(k, v) { result.headers[k] = v; },
    status(c) { result.statusCode = c; return this; },
    json(o) { result.headers['Content-Type'] = 'application/json'; result.body = JSON.stringify(o); return this; },
    end() { return this; }
  };
  let body = event.body;
  if (event.isBase64Encoded && body) body = Buffer.from(body, 'base64').toString('utf8');
  await core({ method: event.httpMethod, body }, res);
  return result;
};
