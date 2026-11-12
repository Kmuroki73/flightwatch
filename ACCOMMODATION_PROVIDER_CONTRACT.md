# Songa accommodation provider adapter contract

## Purpose

Songa owns the traveller experience, authentication, validation and eventual PayPal checkout. A contracted accommodation supplier owns live inventory, rate rules, booking confirmation, cancellation and supplier fulfilment.

## Search request

`POST` to `ACCOMMODATION_ADAPTER_URL` with a server-side bearer token:

```json
{
  "action": "search",
  "city": "Nairobi",
  "checkIn": "2026-12-01",
  "checkOut": "2026-12-03",
  "guests": 2,
  "currency": "USD"
}
```

## Search response

```json
{
  "providerName": "Supplier display name",
  "offers": [
    {
      "id": "opaque-provider-offer-id",
      "name": "Property name",
      "location": "Verified address or locality",
      "description": "Supplier-provided short description",
      "imageUrl": "https://supplier.example/image.jpg",
      "price": 180.00,
      "currency": "USD",
      "priceUnit": "per stay"
    }
  ]
}
```

The Songa Edge Function validates the normalized offer fields and accepts only HTTPS image URLs. The browser never receives the adapter bearer token.

## Booking and payment sequence to implement with the selected supplier

1. Traveller selects a provider offer.
2. Songa server requests a short-lived supplier hold/quote and verifies the final amount, currency, dates, guest count, taxes and expiry.
3. Songa creates a PayPal order using the server-confirmed quote; browser-supplied prices are never trusted.
4. After PayPal capture is verified, Songa asks the supplier to confirm the held reservation using an idempotency key.
5. Songa stores the supplier booking reference, confirmation state and cancellation policy, then shows the traveller the confirmation.
6. If supplier confirmation fails after capture, Songa marks the order for immediate compensation/refund handling; it must not tell the traveller the room is booked.
7. Cancellation/refund events are reconciled with both PayPal and the supplier.

## Required supplier capabilities before live launch

- Search availability and price for exact dates/guest count.
- Quote/hold with expiry and total price including taxes/fees.
- Confirm booking against a hold.
- Retrieve booking status/reference.
- Cancellation and refund policy, including partial refunds.
- Idempotency support for booking confirmation.
- Supplier sandbox or test credentials and documented rate limits.

The current Songa source implements authenticated search UI and the normalized search adapter only. It deliberately does not create a hotel booking or charge for a stay until these capabilities and credentials are supplied.
