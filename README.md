# Spending Tracker

A self-hosted personal finance dashboard with automatic expense tracking, investment portfolio management, budget tracking, and financial metrics visualization.

## Features

- **Wise Integration**: Automatically sync transactions from your Wise account
- **Indexa Capital Integration**: Track your Indexa Capital investment portfolios
- **Interactive Brokers Integration**: Sync positions from IBKR via the Client Portal Web API gateway
- **Financial Assets**: Unified portfolio view (funds, stocks, ETFs, crypto) with allocation, evolution, and per-source breakdown. Manual assets get real-time prices via Alpha Vantage API & CoinGecko API
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

# Interactive Brokers (optional — requires the Client Portal Gateway, see below)
IBKR_GATEWAY_URL="https://localhost:5000"
# Browser-facing gateway URL for re-login links in the UI (Docker deployments)
# IBKR_GATEWAY_PUBLIC_URL="https://192.168.10.150:5000"
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

The production deployment is **Docker Compose**, built and run on the server itself — there is no local build or file-copy step. (The pre-Docker standalone workflow is preserved below for reference.)

### Docker Compose

The compose stack runs four services: a one-shot `migrate` container (applies Prisma migrations), the `app` (Next.js standalone), the `ibkr-gateway` (Client Portal Gateway sidecar), and `ibkr-login` (headless auto-login watchdog for the gateway).

```bash
# On the server
git clone https://github.com/MSchere/spending-tracker.git
cd spending-tracker
cp .env.example .env   # fill in values (NEXTAUTH_SECRET, ENCRYPTION_KEY, WISE_API_TOKEN, ...)

# Create the data directory (SQLite lives here; containers run as uid 1001)
sudo mkdir -p /var/lib/spending-tracker/data
sudo chown -R 1001:1001 /var/lib/spending-tracker/data

docker compose up -d --build
```

- App: `http://<server>:${APP_PORT:-3000}`
- SQLite lives in the bind-mounted `DATA_DIR` (default `/var/lib/spending-tracker/data`); gateway logs in the `ibkr-logs` volume.
- The app talks to the gateway at `https://ibkr-gateway:5000` (set automatically in compose).
- Useful overrides: `DATA_DIR`, `APP_PORT`, `IBKR_PORT`, `TZ` (default `Europe/Madrid`).

### IBKR Gateway (Interactive Brokers)

The IBKR Web API requires the official **Client Portal Gateway**. The gateway binaries are **not committed** to the repo — the Docker image downloads them from IBKR at build time, and for local dev you fetch them once:

```bash
./ibkr/fetch-gateway.sh   # downloads & extracts the gateway into ibkr/
cd ibkr && bin/run.sh root/conf.yaml
```

Only our customized `ibkr/root/conf.yaml` is tracked in git (docker-network IPs allowed). Key facts:

- Serves a self-signed HTTPS API on port `5000` and proxies `api.ibkr.com`. Sessions last roughly 24h.
- The app degrades gracefully: if the gateway is down or unauthenticated, IBKR positions keep their last synced values and a banner appears on the Financial Assets page.

**Auto-login watchdog (`ibkr-login` service):** the headless Chromium watchdog keeps the session alive automatically. It reads `IBKR_USERNAME`/`IBKR_PASSWORD` from the agenix secrets file (default `/run/agenix/spending-tracker`, age-encrypted at rest) and re-logs-in whenever the session expires. The only manual step is **tapping the IB Key push** on your phone — roughly once a day. See `scripts/ibkr-login/`.

**Security:** the gateway port is bound **host-only** (`127.0.0.1:5000`) — it is not reachable from the LAN or internet. The app reaches it over the internal Docker network; manual re-logins go through an SSH tunnel (IBKR's SSO flow only accepts `localhost` origins):

```bash
ssh -N -L 5000:127.0.0.1:5000 root@<server>
# then open https://localhost:5000 in a browser
```

**UI re-login links:** when the app runs in Docker, `IBKR_GATEWAY_URL` points at the internal service name. Set `IBKR_GATEWAY_PUBLIC_URL` to the browser-facing gateway URL (e.g. `https://192.168.10.150:5000`) so the settings page and banners link somewhere reachable.

Running it without Docker (e.g. on a NixOS/systemd host), after fetching the binaries as shown above:

A minimal systemd unit:

```ini
[Unit]
Description=IBKR Client Portal Gateway
After=network.target

[Service]
WorkingDirectory=/var/lib/spending-tracker/ibkr
ExecStart=/var/lib/spending-tracker/ibkr/bin/run.sh root/conf.yaml
Restart=always

[Install]
WantedBy=multi-user.target
```

Set `IBKR_GATEWAY_URL="https://localhost:5000"` in the app environment when the gateway runs on the same host.

<details>
<summary>Legacy: standalone + systemd (pre-Docker)</summary>

This was the deployment before Docker: the Next.js standalone bundle was built on a dev machine, rsynced to the server, and run by a systemd unit. Kept for reference only.

#### Build on dev

```bash
git pull
pnpm install
pnpm build

# Stage the standalone bundle
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/
```

#### Deploy to server

```bash
rsync -av --delete .next/standalone/ user@your-server:/var/lib/spending-tracker/app/.next/standalone/
ssh user@your-server "systemctl restart spending-tracker"
```

Replace `user@your-server` with your actual SSH user and host/IP. Use `--rsync-path="sudo rsync"` if your user needs sudo to write to the target directory.

#### Database

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

#### NixOS notes

- The systemd service runs `node server.js` from `.next/standalone`
- `DATABASE_URL` must be an absolute path (relative paths resolve against the working directory)
- The database file and the standalone bundle are separate; rsync only touches the bundle
- `prisma generate` can't run on NixOS — build on a dev machine and rsync the standalone bundle

</details>

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

| Command               | Description                                   |
| --------------------- | --------------------------------------------- |
| `pnpm dev`            | Start development server (Turbopack)          |
| `pnpm build`          | Build for production                          |
| `pnpm start`          | Start production server                       |
| `pnpm lint`           | Run ESLint                                    |
| `pnpm format`         | Format code with Prettier                     |
| `pnpm format:check`   | Check formatting                              |
| `pnpm typecheck`      | Run TypeScript type checking                  |
| `pnpm db:generate`    | Generate Prisma client                        |
| `pnpm db:migrate`     | Run database migrations (creates SQLite file) |
| `pnpm db:push`        | Push schema changes without a migration file  |
| `pnpm db:studio`      | Open Prisma Studio                            |
| `pnpm db:seed`        | Seed default categories                       |
| `pnpm test:migration` | Test migrations against a DB copy (safe)      |

## Project Structure

```
spending-tracker/
├── ibkr/                       # IBKR gateway: Dockerfile + conf.yaml (binaries fetched at build time)
├── scripts/ibkr-login/         # Headless gateway auto-login watchdog (Docker)
├── scripts/                    # Migration test harness (test:migration)
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
│   │   │   ├── financial-assets/   # Unified portfolio (funds, stocks, ETFs, crypto)
│   │   │   ├── investments/        # Redirects to /financial-assets
│   │   │   ├── tangible-assets/    # Physical assets & depreciation
│   │   │   ├── budgets/
│   │   │   ├── savings/
│   │   │   ├── recurring/
│   │   │   └── settings/
│   │   └── api/                # API routes
│   ├── components/
│   │   ├── charts/             # Chart components
│   │   ├── icons/              # Custom icons
│   │   ├── layout/             # Layout components
│   │   ├── providers/          # Context providers
│   │   └── ui/                 # ShadCN UI components
│   ├── hooks/                  # Shared React hooks (use-table-sort, ...)
│   └── lib/
│       ├── server/             # Server-side utilities
│       │   ├── alphavantage/   # Alpha Vantage client + FinancialAsset queries
│       │   ├── assets/         # Tangible assets & depreciation
│       │   ├── auth/           # NextAuth configuration
│       │   ├── db/             # Prisma client
│       │   ├── ibkr/           # IBKR Client Portal API client & sync
│       │   ├── indexa/         # Indexa Capital API client & sync
│       │   ├── portfolio/      # Unified portfolio overview/history queries
│       │   ├── sync/           # Unified sync orchestrator
│       │   └── wise/           # Wise API client & sync
│       └── utils/              # Shared utilities
└── .env.example                # Environment variable template
```

## First-Time Setup

1. Register an account at `/register`
2. Set up 2FA (mandatory) — scan the QR code with any authenticator app
3. Go to **Settings** to verify your integrations are connected (they are configured via environment variables)
4. Click **Sync Data** in the sidebar to import transactions & positions
5. View your dashboard!

## Updating

Deploys are just a git pull + rebuild on the server:

```bash
cd /var/lib/spending-tracker/app

git pull
docker compose up -d --build
```

The `migrate` container applies any new Prisma migrations automatically before the app starts, and the other images rebuild with the new code. There is nothing to do on the dev machine — no `pnpm install`, no `pnpm build`, no rsync.

## License

MIT
