# WakeEDI

AS2/EDI Trading Platform — parse, map, and route X12 EDI transactions between trading partners and Wake Tech applications.

**Live at:** `https://edi.waketech.ai`

## Architecture

```
Trading Partner → AS2/SFTP → WakeEDI → SARA Mapping → FreightWake/WakeFleet/etc.
                                ↓
                         Transaction Log
                                ↓
                    997 Acknowledgment → Partner
```

**Core Engine:**
- **X12 Parser** — Full ISA/GS/ST envelope parsing, delimiter detection, segment/element extraction
- **SARA Engine** — Segment Aware Routing Architecture — maps X12 fields to target database columns via configurable rules
- **X12 Generator** — Builds outbound 214 (status), 997 (ack), with ISA/GS control number tracking
- **EDI Processor** — Orchestrates: receive → parse → identify partner → map → write → acknowledge

**Supported Transaction Sets:**
- 204 — Load Tender (inbound)
- 210 — Freight Invoice (outbound)
- 214 — Shipment Status (outbound)
- 990 — Response to Load Tender (outbound)
- 997 — Functional Acknowledgment (both)

## Stack

- Next.js 14 / TypeScript / Tailwind v4
- Azure SQL (`Wake-edi` on `sql-waketech-prod.database.windows.net`)
- Raw `mssql` driver (no ORM)
- JWT + Argon2id auth

## Quick Start

```bash
npm install
cp .env.example .env.local   # Fill in credentials
npm run migrate               # Creates all tables via fw_deploy user
npm run dev
```

## Migrations

```bash
npm run migrate:status   # Check what's pending
npm run migrate          # Run pending migrations
```

## AS2 Receive Endpoint

Trading partners POST X12 data to:
```
POST https://edi.waketech.ai/api/as2/receive
Content-Type: application/edi-x12
```

## Key URLs

| Page | Path |
|------|------|
| Dashboard | `/` |
| Trading Partners | `/partners` |
| Connections | `/connections` |
| Field Mappings | `/mappings` |
| Transaction Monitor | `/transactions` |
| Settings | `/settings` |
