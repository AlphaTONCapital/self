---
name: leasys-call-center
description: Handle inbound voice calls for Leasys car rental drivers assistance. Routes calls through accident reporting, body shop booking, roadside assistance, and claim status flows via Twilio voice webhooks with Salesforce CRM integration.
metadata:
  openclaw:
    emoji: "📞"
    skillKey: leasys-call-center
    primaryEnv: TWILIO_ACCOUNT_SID
    requires:
      bins: ["node"]
      env: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"]
---

# Leasys Call Center

Voice-based drivers assistance call center for Leasys car rental. Handles ~60 calls/day across 4 flows:

1. **Accident/Collision Reporting** - Capture incident details, create case, recommend body shop
2. **Body Shop Appointment Booking** - Schedule repairs at partner shops or nearby alternatives
3. **Roadside Assistance Dispatch** - Flat tire, battery, lockout, towing with ETA
4. **Claim Status Inquiries** - Look up existing cases and provide updates

## Prerequisites

- Twilio account with a phone number
- Node.js 18+
- Optional: Google Places API key for body shop fallback search

## Quick Start

```bash
# Start the webhook server
./scripts/leasys-call-center.sh start

# Stop the server
./scripts/leasys-call-center.sh stop

# Check server status
./scripts/leasys-call-center.sh status

# Run tests
./scripts/leasys-call-center.sh test
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TWILIO_ACCOUNT_SID` | Yes | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | Yes | Twilio Auth Token |
| `TWILIO_PHONE_NUMBER` | Yes | Twilio phone number for outbound |
| `GOOGLE_PLACES_API_KEY` | No | Google Places API for body shop fallback |
| `LEASYS_WEBHOOK_PORT` | No | Server port (default: 3100) |

## Twilio Setup

1. Create a Twilio account and purchase a phone number
2. Set the Voice webhook URL to `https://your-server/voice/incoming` (POST)
3. Set the Status callback URL to `https://your-server/voice/status` (POST)
4. Configure environment variables

## Call Flow

```
Caller -> Twilio -> /voice/incoming -> Greeting + Intent Detection
                                           |
                    +-----------+-----------+-----------+
                    |           |           |           |
              Accident    Body Shop    Roadside     Claim
              Report      Booking     Assistance   Status
                    |           |           |           |
                    +-----+-----+-----+-----+----------+
                          |           |
                    Salesforce    Body Shop
                      (CRM)      Directory
```

## Data Storage

Cases and appointments are stored in JSON files under `src/data/`:
- `cases.json` - Accident reports and claims
- `appointments.json` - Body shop appointments
- `partner-shops.json` - Leasys partner body shop network

The mock Salesforce layer uses the same object schema as real Salesforce, so swapping to `jsforce` later requires only changing the service module.
