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
```

## Notes

- `DELHIVERY_ALLOW_FALLBACK=true` is useful for local development when API credentials are missing.
- Set `DELHIVERY_ALLOW_FALLBACK=false` in production to force strict API-based shipping quotes.
- The backend now calls Delhivery's documented shipping-cost API at `api/kinko/v1/invoice/charges/.json`.
- You still need the origin pickup pincode in `DELHIVERY_ORIGIN_PINCODE` because this API calculates freight from source pin to destination pin.
- If Delhivery changes the host for your account, update only `DELHIVERY_ONE_QUOTE_URL`.
