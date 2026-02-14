# Leasys Call Center Skill - Design Document

**Date:** 2026-02-14
**Status:** Approved
**Author:** Logan + Claude

## Overview

An Aton skill that handles inbound voice calls for Leasys car rental's drivers assistance program. Receives calls via Twilio, routes through 4 conversation flows (accident reporting, body shop booking, roadside assistance, claim status), and manages data through a mock Salesforce layer.

## Context

- **Company:** Leasys (car rental)
- **Volume:** ~60 calls/day, 6-7 calls/hour
- **CRM:** Salesforce (mocked for now, real API later)
- **Channel:** Voice telephony via Twilio
- **Body shops:** Partner network + Google Places fallback

## Architecture

```
Phone call -> Twilio -> POST /voice/incoming -> Express server (port 3100)
                                                   |
                                          Intent Detection (greeting.mjs)
                                                   |
                        +-------------+------------+------------+
                        |             |            |            |
                  accident-report  body-shop   roadside    claim-status
                        |          booking     assist         |
                        +------+------+----+------+----------+
                               |           |
                        salesforce-mock  body-shop-directory
                         (JSON files)   (partner + Places)
```

## Call Flows

### 1. Accident Report
Trigger: "accident", "crash", "collision", "hit"
Captures: location, damage description, other parties, injuries, police report #
Output: Creates Salesforce case, recommends nearest body shop

### 2. Body Shop Booking
Trigger: "appointment", "repair", "body shop", "fix"
Captures: vehicle info, damage type, preferred date/location
Output: Books appointment, confirms shop address

### 3. Roadside Assistance
Trigger: "flat tire", "battery", "locked out", "tow", "breakdown"
Captures: location, issue type, vehicle info
Output: Dispatch confirmation with ETA

### 4. Claim Status
Trigger: "status", "claim", "update", "when"
Captures: claim/case number or driver name
Output: Current status, next steps

## Data Layer

Mock Salesforce using JSON files matching SF object schemas:
- `data/cases.json` - Case objects
- `data/appointments.json` - Appointment__c objects
- `data/partner-shops.json` - Partner body shop directory

Swap `salesforce-mock.mjs` with `jsforce`-based module later - same interface.

## Webhook Endpoints

- `POST /voice/incoming` - Initial greeting + intent gather
- `POST /voice/flow/:flowName` - Flow conversation steps
- `POST /voice/flow/:flowName/gather` - Process speech input
- `POST /voice/status` - Call status callbacks

## Configuration

```json
{
  "TWILIO_ACCOUNT_SID": "required",
  "TWILIO_AUTH_TOKEN": "required",
  "TWILIO_PHONE_NUMBER": "required",
  "GOOGLE_PLACES_API_KEY": "optional (for fallback)",
  "LEASYS_WEBHOOK_PORT": "3100"
}
```
