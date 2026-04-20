# Logistics Integration (Delhivery One)

This project now supports real-time delivery quotation via Delhivery One during checkout.

## Razorpay Payment Integration

Checkout now uses Razorpay for online payments. Order creation in database happens only after backend signature verification.

Add these in `backend/.env`:

```env
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_live_secret
RAZORPAY_CURRENCY=INR
```

Notes:

- Keep `RAZORPAY_KEY_SECRET` only on backend.
- Frontend loads Razorpay Checkout SDK (`checkout.razorpay.com`) and gets order id from backend.
- Backend verifies signature at `POST /api/orders/payment/verify` before creating order.

## Google Authentication

Normal user auth now uses Google sign-in on both login and register pages. Admin login stays password-based on `/admin-login`.

Add these in `backend/.env`:

```env
GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com
```

Add this in `frontend/.env`:

```env
REACT_APP_GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com
```

Google Cloud Console requirements:

- OAuth consent screen configured.
- Authorized JavaScript origins include your frontend URLs.
- Use a Web application OAuth client and copy its Client ID to both backend and frontend env.

## Checkout Flow

1. User verifies mobile number with OTP.
2. User enters shipping address.
3. Backend calls Delhivery One quote API.
4. Frontend shows:
	- Item subtotal
	- Delivery charge (from Delhivery One)
	- Final payable amount
5. On place order, backend recalculates quote and stores delivery fields in order.

## Backend Environment Variables

Add these keys in `backend/.env`:

```env
# Existing
MONGODB_URI=...
JWT_SECRET=...

# Delhivery One Integration
DELHIVERY_ONE_QUOTE_URL=https://staging-express.delhivery.com/api/kinko/v1/invoice/charges/.json
DELHIVERY_ONE_API_TOKEN=<your-api-token>

# Optional
DELHIVERY_ONE_AUTH_SCHEME=Token
DELHIVERY_ORIGIN_PINCODE=110001
DELHIVERY_DEFAULT_WEIGHT_KG=0.5
DELHIVERY_ALLOW_FALLBACK=true

# Media storage
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# MSG91 OTP verification
MSG91_AUTH_KEY=...
MSG91_TEMPLATE_ID=...
```

## OTP Verification (MSG91)

Checkout OTP verification now uses normal SMS OTP flow through MSG91 send and verify APIs.

Configured policy:

- OTP length: `6`
- OTP expiry: `45 seconds`
- Max resend attempts: `2`
- Resend cooldown: `30 seconds`
- Max verify attempts: `3`

Server-side verification endpoint used:

```text
POST https://control.msg91.com/api/v5/otp
POST https://control.msg91.com/api/v5/otp/verify
```

Frontend flow is now standard:

- User enters contact number and clicks `Send/Resend OTP`
- OTP is delivered by SMS from MSG91
- User enters 6 digit OTP and clicks verify
- Backend verifies OTP with MSG91 and issues checkout verification token automatically

For localhost and hosted, set `MSG91_AUTH_KEY` and `MSG91_TEMPLATE_ID` in backend environment.

## Notes

- `DELHIVERY_ALLOW_FALLBACK=true` is useful for local development when API credentials are missing.
- Set `DELHIVERY_ALLOW_FALLBACK=false` in production to force strict API-based shipping quotes.
- The backend now calls Delhivery's documented shipping-cost API at `api/kinko/v1/invoice/charges/.json`.
- You still need the origin pickup pincode in `DELHIVERY_ORIGIN_PINCODE` because this API calculates freight from source pin to destination pin.
- If Delhivery changes the host for your account, update only `DELHIVERY_ONE_QUOTE_URL`.

## Media Migration

After configuring Cloudinary, run this once from the backend folder to move existing local uploads into Cloudinary and rewrite stored image URLs:

```bash
npm run migrate:media
```

This updates product images and review images already stored in MongoDB.

## Local And Render Setup

Use the example files as a starting point:

```text
backend/.env.example
frontend/.env.example
```

For Cloudinary to work in both local and hosted environments, set the same three Cloudinary variables in the backend environment wherever the backend runs:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Local frontend should point at the local backend URL, while the deployed frontend should point at the hosted backend URL through `REACT_APP_API_URL` or `REACT_APP_API_BASE_URL`.

## Uptime Ping

If you want to reduce Render cold starts, point an external uptime monitor to:

```text
https://dhaaga-backend.onrender.com/api/ping
```

Recommended interval: every 5 to 10 minutes.

This does not change the app flow. It just keeps the backend warm so the first login after idle is faster.
