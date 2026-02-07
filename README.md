# Spending Tracker

A self-hosted personal finance dashboard with automatic expense tracking, investment portfolio management, budget tracking, and financial metrics visualization.

## Features

- **Wise Integration**: Automatically sync transactions from your Wise account
- **Indexa Capital Integration**: Track your Indexa Capital investment portfolios
- **Financial Assets**: Track stocks, ETFs, and crypto with real-time prices via Alpha Vantage API
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
- **Database**: PostgreSQL 16
- **ORM**: Prisma 7
- **Authentication**: NextAuth.js v5 with mandatory TOTP 2FA
- **Styling**: Tailwind CSS v4 + ShadCN/ui
- **Charts**: ShadCN Charts (Recharts-based)
- **Package Manager**: pnpm

## Prerequisites

- Node.js 22+
- pnpm 9+
- PostgreSQL 16 (local install or via Docker)
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
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/spending_tracker"

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

# Alpha Vantage (optional - for stocks/crypto prices)
ALPHA_VANTAGE_API_KEY="your-api-key"
```

### 3. Start Database

You'll need a PostgreSQL 16 instance. You can run one locally or use a managed service.

### 4. Initialize Database

```bash
pnpm db:generate    # Generate Prisma client
pnpm db:migrate     # Run migrations
pnpm db:seed        # Seed default categories
```

### 5. Start Development Server

```bash
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Production Deployment

### NixOS (Recommended for Self-Hosting)

A NixOS configuration is provided in `nix/configuration.nix` for deploying on NixOS LXC containers or bare-metal servers.

**Features:**

- PostgreSQL 16 with automatic database setup
- Systemd service for the Next.js app
- Nginx reverse proxy
- Secrets management via files

**Deployment steps:**

1. Copy `nix/configuration.nix` to your NixOS machine
2. Adjust hostnames, ports, and secret paths as needed
3. Run `nixos-rebuild switch`
4. Create secrets in `/var/lib/spending-tracker/secrets/`
5. Clone the repo, install dependencies, and build
6. Run migrations and start the service

Refer to the comments in `nix/configuration.nix` for detailed instructions.

### Manual Deployment

1. **Build the application:**

```bash
pnpm install
pnpm db:generate
pnpm build
```

2. **Prepare standalone build:**

```bash
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/
cp -r prisma .next/standalone/
```

3. **Run migrations:**

```bash
DATABASE_URL="your-connection-string" pnpm prisma migrate deploy
```

4. **Start the server:**

```bash
cd .next/standalone
NODE_ENV=production node server.js
```

### Reverse Proxy (Recommended)

For production, place behind a reverse proxy (nginx, Traefik, Caddy) with SSL.

Example nginx config:

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Available Scripts

| Command             | Description                       |
| ------------------- | --------------------------------- |
| `pnpm dev`          | Start development server          |
| `pnpm build`        | Build for production              |
| `pnpm start`        | Start production server           |
| `pnpm lint`         | Run ESLint                        |
| `pnpm format`       | Format code with Prettier         |
| `pnpm format:check` | Check formatting                  |
| `pnpm typecheck`    | Run TypeScript type checking      |
| `pnpm db:generate`  | Generate Prisma client            |
| `pnpm db:migrate`   | Run database migrations           |
| `pnpm db:push`      | Push schema changes (development) |
| `pnpm db:studio`    | Open Prisma Studio                |
| `pnpm db:seed`      | Seed default categories           |

## Project Structure

```
spending-tracker/
├── nix/                    # NixOS deployment configuration
│   └── configuration.nix   # NixOS module for LXC/server deployment
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── seed.ts             # Database seeder
├── src/
│   ├── app/                # Next.js App Router pages
│   │   ├── (auth)/         # Auth pages (login, register, 2fa)
│   │   ├── (authenticated)/ # Protected pages
│   │   │   ├── dashboard/
│   │   │   ├── transactions/
│   │   │   ├── investments/     # Indexa Capital portfolios
│   │   │   ├── financial-assets/ # Stocks, ETFs, crypto
│   │   │   ├── assets/          # Tangible assets
│   │   │   ├── budgets/
│   │   │   ├── savings/
│   │   │   ├── recurring/
│   │   │   └── settings/
│   │   └── api/            # API routes
│   ├── components/
│   │   ├── charts/         # Dashboard chart components
│   │   ├── icons/          # Custom icons
│   │   ├── layout/         # Layout components
│   │   ├── providers/      # Context providers
│   │   └── ui/             # ShadCN UI components
│   └── lib/
│       ├── server/         # Server-side utilities
│       │   ├── alphavantage/  # Alpha Vantage API client
│       │   ├── assets/        # Tangible assets & depreciation
│       │   ├── auth/          # NextAuth configuration
│       │   ├── db/            # Prisma client
│       │   ├── indexa/        # Indexa Capital API client
│       │   ├── sync/          # Unified sync orchestrator
│       │   └── wise/          # Wise API client & sync
│       └── utils/          # Shared utilities
└── .env.example            # Environment template
```

## First-Time Setup

1. Register an account at `/register`
2. Set up 2FA (mandatory) - scan QR code with authenticator app
3. Go to Settings and configure your API integrations
4. Click "Sync Now" to import transactions
5. View your dashboard!

## Updating

```bash
# Pull latest changes
git pull

# Update dependencies
pnpm install

# Run migrations
pnpm db:migrate

# Rebuild for production
pnpm build
```

## License

MIT
