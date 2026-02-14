# Leasys Call Center - Call Flow Reference

## Greeting & Intent Detection

```
Caller connects
  → "Thank you for calling Leasys Drivers Assistance..."
  → Gather speech input
  → Detect intent from keywords:
      accident/crash/collision → Accident Report
      appointment/repair/fix  → Body Shop Booking
      flat tire/battery/tow   → Roadside Assistance
      status/claim/update     → Claim Status
      agent/person/human      → Transfer to live agent
      unrecognized            → Re-prompt with examples
```

## Flow 1: Accident Report

```
Entry: "I'm sorry to hear about your accident..."

Step 1 - Location
  ← "Where did the accident occur?"
  → Capture street address / intersection

Step 2 - Damage Description
  ← "Can you describe the damage?"
  → Capture damage details

Step 3 - Other Parties
  ← "Were other vehicles involved?"
  → Capture party info or "no other parties"

Step 4 - Injuries
  ← "Were there any injuries?"
  → YES → Transfer to emergency team (live agent)
  → NO  → Continue

Step 5 - Police Report
  ← "Do you have a police report number?"
  → Capture number or "no report"

Step 6 - Confirm
  ← Read back all details
  → YES → Create case, recommend body shops, provide case number
  → NO  → Restart flow

Output: Salesforce case created, case number provided, body shop recommendations
```

## Flow 2: Body Shop Booking

```
Entry: "I'll help you book a body shop appointment..."

Step 1 - Vehicle Info
  ← "What vehicle? Make, model, year?"
  → Capture vehicle info

Step 2 - Damage Type
  ← "What type of damage needs repair?"
  → Detect: collision / paint / glass / dent / general

Step 3 - Location
  ← "What area are you in?"
  → Capture city / zip code

Step 4 - Shop Selection
  ← Present top 3 shops (partner first, Google Places fallback)
  → "Option 1, 2, or 3"

Step 5 - Preferred Date
  ← "When would you like the appointment?"
  → Parse: tomorrow, next week, ASAP, specific date

Step 6 - Confirm
  ← Read back: vehicle, damage, shop, date
  → YES → Create case + appointment, provide details
  → NO  → Restart flow

Output: Case created, appointment booked, shop address + phone provided
```

## Flow 3: Roadside Assistance

```
Entry: "I'll get you roadside assistance right away..."
(May skip issue type if detected from initial speech)

Step 1 - Issue Type
  ← "What's the issue?"
  → Detect: flat tire / dead battery / lockout / towing / overheating / fuel / other

Step 2 - Location
  ← "Where are you?"
  → Capture address / highway / landmark

Step 3 - Vehicle Info
  ← "What vehicle? Make, model, color, plate?"
  → Capture vehicle details

Step 4 - Safety Check
  ← "Are you in a safe location?"
  → NO + (overheating|towing) → Transfer to emergency dispatch
  → Otherwise → Continue

Step 5 - Confirm & Dispatch
  ← Read back issue, location, vehicle, ETA
  → YES → Create roadside case, mark dispatched, provide case number
  → NO  → Restart flow

ETAs by issue type:
  - Flat Tire: 30-45 min
  - Dead Battery: 20-35 min
  - Lockout: 25-40 min
  - Towing: 45-60 min
  - Overheating: 30-45 min
  - Out of Fuel: 25-40 min
  - Other: 35-50 min

Output: Roadside case created, dispatched status, ETA provided
```

## Flow 4: Claim Status

```
Entry: Attempts auto-lookup by phone number first

Path A - Phone Number Match (single case)
  → Directly present case status

Path B - Phone Number Match (multiple cases)
  ← List up to 3 cases with numbers and subjects
  → "Which case? Say case number or case 1, 2, 3"

Path C - No Phone Match
  ← "Please provide your case number (LEA-XXXXXX)"
  → Look up case

Case Found:
  ← Present: case number, subject, status message, next appointment if any
  ← "Anything else? Check another case, speak to agent, or no thanks"
  → another case → re-prompt for case number
  → agent → transfer to live agent
  → no thanks → goodbye

Case Not Found:
  ← "Couldn't find that case number, try again?"
  → Re-prompt

Status Messages:
  - New: "Being reviewed by our team"
  - In Progress: "Currently being worked on"
  - Dispatched: "Service team on the way"
  - Scheduled: "Repair appointment scheduled"
  - In Repair: "Vehicle currently being repaired"
  - Awaiting Parts: "Waiting for parts (2-3 business days)"
  - Ready: "Repair complete, ready for pickup"
  - Closed: "Case resolved and closed"
```

## Transfer to Live Agent

Any flow can transfer to a live agent when:
- Caller explicitly asks for "agent", "person", "human", "operator"
- Injuries are reported (accident flow)
- Unsafe location + critical issue (roadside flow)
- Intent cannot be determined after 2 attempts
- Any unexpected error in processing
