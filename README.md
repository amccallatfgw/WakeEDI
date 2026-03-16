# WakeEDI

AS2/EDI server with X12 parsing, SARA mapping engine, and visual trading partner onboarding for Wake Tech.

## Stack

- **Next.js 14** (App Router)
- **TypeScript** (strict)
- **Tailwind CSS v4**
- **Azure SQL** (`sql-waketech-prod.database.windows.net` / `Wake-edi`)
- **Raw `mssql` driver** (no ORM)
- **JWT + Argon2id** auth

## Getting Started

1. Run `schema.sql` in Azure Portal Query Editor against the `Wake-edi` database
2. Run `seed.sql` to create the admin user
3. Generate a password hash: `npm run hash-password changeme123` and update the admin user's `password_hash`
4. Copy `.env.example` to `.env.local` and fill in credentials
5. `npm install && npm run dev`

## Scaffolded from

[Wake-Ingredients](https://github.com/amccallatfgw/Wake-ingredients-) — Wake Tech project starter kit.
