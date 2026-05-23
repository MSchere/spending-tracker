# Spending Tracker

A self-hosted personal finance dashboard with automatic expense tracking, investment portfolio management, budget tracking, and financial metrics visualization.

## Features

- **Wise Integration**: Automatically sync transactions from your Wise account
- **Indexa Capital Integration**: Track your Indexa Capital investment portfolios
- **Financial Assets**: Track stocks, ETFs, and crypto with real-time prices via Alpha Vantage API & CoinGecko API
- **Tangible Assets**: Track physical assets (vehicles, electronics, real estate) with depreciation calculations
- **Manual Transactions**: Add transactions manually for cash expenses, benefits, meal vouchers, etc.
- **Transaction Management**: View, search, filter, and categorize transactions
- **Budget Tracking**: Set monthly budgets per category with progress visualization
- **Savings Goals**: Track progress toward financial goals
- **Recurring Expenses**: Monitor regular payments and subscriptions
- **Dashboard**: Visual overview with charts for cash flow, spending by category, net worth breakdown, and investment performance
- **Privacy Mode**: Toggle to mask sensitive financial data
- **Secure Authentication**: Email/password with mandatory TOTP 2FA

## Tech Stack

- **Framework**: Next.js 16 (App Router, TypeScript)
- **Database**: SQLite (via Prisma 7)
- **ORM**: Prisma 7
- **Authentication**: NextAuth.js v5 with mandatory TOTP 2FA
- **Styling**: Tailwind CSS v4 + ShadCN/ui
- **Charts**: ShadCN Charts (Recharts-based)
- **Package Manager**: pnpm

## Prerequisites

- Node.js 22+
- pnpm 9+
- Wise Personal API Token ([Get one here](https://wise.com/settings/api-tokens))

## Development Setup

### 1. Clone and Install

```bash
git clone https://github.com/MSchere/spending-tracker.git
cd spending-tracker
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in the required values:

```env
# Database — path to the SQLite file (relative to project root)
DATABASE_URL="file:./prisma/database.db"

# NextAuth (generate secret: openssl rand -base64 32)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-here"

# Encryption key for 2FA secrets (exactly 32 characters)
ENCRYPTION_KEY="your-32-character-encryption-key"

# Wise API
WISE_API_TOKEN="your-wise-api-token"
WISE_ENVIRONMENT="production"  # or "sandbox" for testing

# Indexa Capital (optional)
INDEXA_API_TOKEN="your-indexa-token"

# Alpha Vantage (optional — for stocks/crypto prices)
ALPHA_VANTAGE_API_KEY="your-api-key"
```

### 3. Initialize Database

```bash
pnpm db:generate    # Generate Prisma client
pnpm db:migrate     # Create the SQLite file and run migrations
pnpm db:seed        # Seed default categories
```

### 4. Start Development Server

```bash
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Deployment

### 1. Build the application

```bash
pnpm install
pnpm db:generate
pnpm build
```

### 2. Prepare standalone build

```bash
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/
cp -r prisma .next/standalone/
```

### 3. Run migrations

```bash
DATABASE_URL="file:./prisma/database.db" pnpm prisma migrate deploy
```

### 4. Start the server

```bash
cd .next/standalone
NODE_ENV=production node server.js
```

> **Database location**: The SQLite file is created at the path specified by `DATABASE_URL`. Make sure that directory is writable by the process and is included in your backup strategy.

## Migrating from PostgreSQL

If you are upgrading from a previous version that used PostgreSQL, use the included migration script to copy all data to the new SQLite database.

### Steps

**1. Update your environment**

Change `DATABASE_URL` in `.env` to a SQLite file path:

```env
DATABASE_URL="file:./prisma/database.db"
```

**2. Create the SQLite schema**

```bash
pnpm db:migrate
```

**3. Run the migration script**

Provide the old PostgreSQL connection string via `PG_DATABASE_URL`:

```bash
PG_DATABASE_URL="postgresql://user:password@host:5432/spending_tracker" \
  pnpm db:migrate-from-pg
```

The script copies every table in foreign-key-safe order, prints a live progress counter for large tables, and finishes with a full row-count summary. It is **idempotent** — safe to re-run if interrupted.

**4. Verify and start**

```bash
pnpm dev   # or NODE_ENV=production node .next/standalone/server.js
```

## Available Scripts

| Command                  | Description                                    |
| ------------------------ | ---------------------------------------------- |
| `pnpm dev`               | Start development server (Turbopack)           |
| `pnpm build`             | Build for production                           |
| `pnpm start`             | Start production server                        |
| `pnpm lint`              | Run ESLint                                     |
| `pnpm format`            | Format code with Prettier                      |
| `pnpm format:check`      | Check formatting                               |
| `pnpm typecheck`         | Run TypeScript type checking                   |
| `pnpm db:generate`       | Generate Prisma client                         |
| `pnpm db:migrate`        | Run database migrations (creates SQLite file)  |
| `pnpm db:push`           | Push schema changes without a migration file   |
| `pnpm db:studio`         | Open Prisma Studio                             |
| `pnpm db:seed`           | Seed default categories                        |
| `pnpm db:migrate-from-pg`| Migrate data from a PostgreSQL database        |

## Project Structure

```
spending-tracker/
├── nix/                        # NixOS deployment configuration
│   └── configuration.nix       # NixOS module for LXC/server deployment
├── prisma/
│   ├── schema.prisma           # Database schema (SQLite)
│   ├── migrations/             # Prisma migration history
│   ├── seed.ts                 # Default category seeder
│   └── migrate-pg-to-sqlite.ts # PostgreSQL → SQLite migration script
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (auth)/             # Auth pages (login, register, 2fa)
│   │   ├── (authenticated)/    # Protected pages
│   │   │   ├── dashboard/
│   │   │   ├── transactions/
│   │   │   ├── investments/        # Indexa Capital portfolios
│   │   │   ├── financial-assets/   # Stocks, ETFs, crypto
│   │   │   ├── assets/             # Tangible assets
│   │   │   ├── budgets/
│   │   │   ├── savings/
│   │   │   ├── recurring/
│   │   │   └── settings/
│   │   └── api/                # API routes
│   ├── components/
│   │   ├── charts/             # Dashboard chart components
│   │   ├── icons/              # Custom icons
│   │   ├── layout/             # Layout components
│   │   ├── providers/          # Context providers
│   │   └── ui/                 # ShadCN UI components
│   └── lib/
│       ├── server/             # Server-side utilities
│       │   ├── alphavantage/   # Alpha Vantage API client
│       │   ├── assets/         # Tangible assets & depreciation
│       │   ├── auth/           # NextAuth configuration
│       │   ├── db/             # Prisma client
│       │   ├── indexa/         # Indexa Capital API client
│       │   ├── sync/           # Unified sync orchestrator
│       │   └── wise/           # Wise API client & sync
│       └── utils/              # Shared utilities
└── .env.example                # Environment variable template
```

## First-Time Setup

1. Register an account at `/register`
2. Set up 2FA (mandatory) — scan the QR code with any authenticator app
3. Go to **Settings** and configure your API integrations
4. Click **Sync Now** to import transactions
5. View your dashboard!

## Updating

```bash
# Pull latest changes
git pull

# Update dependencies
pnpm install

# Apply any new migrations
pnpm db:migrate

# Rebuild for production
pnpm build
```

## License

MIT
