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

> **Note:** `prisma generate` requires downloading native engine binaries which are unavailable on some platforms (e.g. NixOS). Always **build on your dev machine** and deploy the compiled artifacts — never build on the production server.

### 1. Build on dev

```bash
git pull
pnpm install
pnpm build

# Stage the standalone bundle
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/
```

### 2. Deploy to server

```bash
rsync -av --delete .next/standalone/ user@your-server:/var/lib/spending-tracker/app/.next/standalone/
ssh user@your-server "systemctl restart spending-tracker"
```

Replace `user@your-server` with your actual SSH user and host/IP. Use `--rsync-path="sudo rsync"` if your user needs sudo to write to the target directory.

### 3. Database

The SQLite database lives outside the standalone bundle and persists across deploys. Set `DATABASE_URL` to an **absolute path** in your service environment so it resolves correctly regardless of the working directory:

```env
DATABASE_URL="file:/var/lib/spending-tracker/app/prisma/spending.db"
```

On first deploy, initialise the database on the server (Node 22+ required — uses the built-in `node:sqlite`):

```bash
# On the server — create schema using the Prisma migration SQL directly
ssh user@your-server
cd /var/lib/spending-tracker/app/.next/standalone
node -e "
  const {DatabaseSync} = require('node:sqlite');
  const {readFileSync} = require('fs');
  const db = new DatabaseSync(process.env.DATABASE_URL.replace('file:', ''));
  db.exec(readFileSync('prisma/migrations/20260523165056_init/migration.sql', 'utf8'));
  db.close();
  console.log('Schema created.');
"
```

Then seed default categories:

```bash
# Back on dev
pnpm db:seed
```

### NixOS

The `nix/configuration.nix` module in this repo configures the full NixOS service. Key points:

- The systemd service runs `node server.js` from `.next/standalone`
- `DATABASE_URL` must be an absolute path (relative paths resolve against the working directory)
- No Postgres dependency — remove `requires = ["postgresql.service"]` from the service unit
- The database file and the standalone bundle are separate; rsync only touches the bundle

```nix
let
  appDir = "/var/lib/spending-tracker/app";
  dataDir = "/var/lib/spending-tracker";
in {
  systemd.services.spending-tracker = {
    environment = {
      DATABASE_URL = "file:${dataDir}/app/prisma/spending.db";
      # ... other env vars
    };
    script = ''
      cd ${appDir}/.next/standalone
      exec ${pkgs.nodejs_24}/bin/node server.js
    '';
  };
}
```

After updating the NixOS config: `sudo nixos-rebuild switch`.

## Migrating from PostgreSQL

If you are upgrading from a previous version that used PostgreSQL, migration is a one-time manual step done from the dev machine.

**1. Update `DATABASE_URL` in `.env`** to a SQLite file path:

```env
DATABASE_URL="file:./prisma/spending.db"
```

**2. Create the SQLite schema:**

```bash
pnpm db:migrate
```

**3. Copy all data from Postgres to SQLite using the built-in Node.js SQLite module and `pg`:**

Write a quick script or use `psql` to export and re-import, handling the type conversions (BIGINT strings → Number, NUMERIC strings → TEXT, booleans → 0/1, timestamps → ISO strings). Insert tables in foreign-key order: Users → WiseProfiles → Categories → Transactions → etc.

**4. Deploy the new build** following the [Deployment](#deployment) section above.

## Available Scripts

| Command             | Description                                   |
| ------------------- | --------------------------------------------- |
| `pnpm dev`          | Start development server (Turbopack)          |
| `pnpm build`        | Build for production                          |
| `pnpm start`        | Start production server                       |
| `pnpm lint`         | Run ESLint                                    |
| `pnpm format`       | Format code with Prettier                     |
| `pnpm format:check` | Check formatting                              |
| `pnpm typecheck`    | Run TypeScript type checking                  |
| `pnpm db:generate`  | Generate Prisma client                        |
| `pnpm db:migrate`   | Run database migrations (creates SQLite file) |
| `pnpm db:push`      | Push schema changes without a migration file  |
| `pnpm db:studio`    | Open Prisma Studio                            |
| `pnpm db:seed`      | Seed default categories                       |

## Project Structure

```
spending-tracker/
├── nix/                        # NixOS deployment configuration
│   └── configuration.nix       # NixOS module for LXC/server deployment
├── prisma/
│   ├── schema.prisma           # Database schema (SQLite)
│   ├── migrations/             # Prisma migration history
│   └── seed.ts                 # Default category seeder
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
