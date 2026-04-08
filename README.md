# Logistics Integration (Delhivery One)

This project now supports real-time delivery quotation via Delhivery One during checkout.

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

# Email OTP verification (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@example.com
SMTP_PASS=your_app_password
EMAIL_OTP_FROM="Dhaaga <your_email@example.com>"
```

## OTP Verification (Email)

Checkout OTP verification now uses account-email OTP flow through backend SMTP configuration.

Configured policy:

- OTP length: `6`
- OTP expiry: `45 seconds`
- Max resend attempts: `2`
- Resend cooldown: `30 seconds`
- Max verify attempts: `3`

Frontend flow is now standard:

- User enters contact number and clicks `Send/Resend OTP`
- OTP is delivered to the logged-in account email
- User enters 6 digit OTP and clicks verify
- Backend verifies OTP from the in-memory checkout session and issues checkout verification token automatically

For localhost and hosted, set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and optionally `EMAIL_OTP_FROM` in backend environment.

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
