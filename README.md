# PG Brand Website (v5 - card payment on the website)

Customer flow: add to cart -> Proceed to Checkout -> enters name, email, phone and delivery address ->
sees the exact amount -> enters card number, expiry and CVC (Visa, Mastercard, Amex, Discover - credit or debit)
inside the website -> "Payment Successful".

Card details are typed into secure Stripe fields (iframes). They never touch your website or your server.

## Folder structure
```
index.html, style.css, checkout.css, script.js, checkout.js, logo.svg, images/
netlify.toml
netlify/functions/create-payment-intent.js   # server code for Netlify
api/create-payment-intent.js                 # same server code for Vercel
```
Use ONE host (Netlify or Vercel).

## Environment variables (BOTH are required)
- `STRIPE_SECRET_KEY`      -> Stripe Dashboard -> Developers -> API keys -> Secret key
- `STRIPE_PUBLISHABLE_KEY` -> same page -> Publishable key (starts with pk_)
Use the TEST keys first, then replace both with LIVE keys. After changing variables, redeploy.
NEVER write keys in any file or in GitHub.

## Deploy on Netlify
1. Upload ALL files (including `netlify`, `api`, `images` folders) to GitHub.
2. Netlify -> Add new site -> Import an existing project -> GitHub -> your repo.
3. Build command EMPTY, Publish directory `.` -> Deploy.
4. Site configuration -> Environment variables -> add the 2 variables above.
5. Deploys -> Trigger deploy -> Deploy site.
6. Open `https://YOUR-SITE.netlify.app/api/create-payment-intent` -> `{"error":"Method not allowed"}` means the server works.

## Test card
Card `4242 4242 4242 4242`, any future date, any 3-digit CVC, any ZIP. (3-D Secure test: `4000 0027 6000 3184`.)
Orders appear in Stripe Dashboard -> Payments with items, shipping address and phone.

## Changing prices
Change the price in index.html (`addToCart('Title', price, ...)`) AND in `PRODUCTS` in BOTH function files
(price in cents, title must match exactly).
