# 🚀 SaaS API Platform

A production-ready **Multi-Tenant SaaS Backend** with authentication, subscription billing, API key management, and usage tracking.

## ✨ Features

- 🔐 **JWT Auth** — Register, login, refresh tokens, email verification, password reset
- 🏢 **Multi-Tenancy** — Organizations, member roles (Owner/Admin/Member/Viewer), invites
- 💳 **Stripe Billing** — Free/Pro/Enterprise plans, checkout sessions, customer portal, webhooks
- 🔑 **API Key Management** — Create, revoke, per-plan limits, scope-based access
- 📊 **Usage Analytics** — Per-org request tracking, status codes, endpoint stats
- 🚦 **Rate Limiting** — Global + per-plan Redis-based rate limiting
- 📖 **Swagger Docs** — Auto-generated API documentation at `/api/docs`
- 🐳 **Docker Ready** — Full Docker + Docker Compose setup
- 🔄 **CI/CD** — GitHub Actions pipeline (test → build → deploy)

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 |
| Framework | Express.js |
| Database | PostgreSQL + Prisma ORM |
| Cache | Redis |
| Billing | Stripe |
| Auth | JWT + bcrypt |
| Email | Nodemailer |
| Docs | Swagger/OpenAPI |
| Deploy | Docker + Railway/Render |

## 🚀 Quick Start

### Option 1: Docker (Recommended)

```bash
# Clone repo
git clone https://github.com/yourusername/saas-api-platform.git
cd saas-api-platform

# Setup environment
cp .env.example .env
# Edit .env with your values

# Start everything
docker compose up -d

# Run migrations
docker compose exec api npx prisma migrate dev

# Seed demo data
docker compose exec api npm run seed
```

### Option 2: Local Development

**Prerequisites:** Node.js 20+, PostgreSQL, Redis

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your database, Redis, JWT, Stripe credentials

# Generate Prisma client
npm run generate

# Run migrations
npm run migrate

# Seed database
npm run seed

# Start dev server
npm run dev
```

Server starts at **http://localhost:3000**
API Docs at **http://localhost:3000/api/docs**

## 📁 Project Structure

```
saas-api-platform/
├── src/
│   ├── config/          # Database, Redis, Swagger config
│   ├── controllers/     # Business logic
│   ├── middleware/      # Auth, rate limiting, validation
│   ├── routes/          # API route definitions
│   ├── services/        # Token, email services
│   └── utils/           # Logger, AppError
├── prisma/
│   ├── schema.prisma    # Database schema
│   └── seed.js          # Demo data
├── .github/workflows/   # CI/CD pipeline
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

## 📡 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register user + create org |
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/auth/logout` | Logout |
| GET | `/api/v1/auth/verify-email/:token` | Verify email |
| POST | `/api/v1/auth/forgot-password` | Request password reset |
| POST | `/api/v1/auth/reset-password/:token` | Reset password |
| GET | `/api/v1/auth/me` | Get current user |

### Organizations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/orgs/:orgId` | Get organization |
| PATCH | `/api/v1/orgs/:orgId` | Update organization |
| GET | `/api/v1/orgs/:orgId/members` | List members |
| POST | `/api/v1/orgs/:orgId/members/invite` | Invite member |
| POST | `/api/v1/orgs/invites/:token/accept` | Accept invite |
| PATCH | `/api/v1/orgs/:orgId/members/:memberId/role` | Change role |
| DELETE | `/api/v1/orgs/:orgId/members/:memberId` | Remove member |

### API Keys
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/api-keys/:orgId` | List API keys |
| POST | `/api/v1/api-keys/:orgId` | Create API key |
| DELETE | `/api/v1/api-keys/:orgId/:keyId` | Revoke API key |

### Billing
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/billing/:orgId` | Get subscription |
| GET | `/api/v1/billing/:orgId/invoices` | List invoices |
| POST | `/api/v1/billing/:orgId/checkout` | Create checkout session |
| POST | `/api/v1/billing/:orgId/portal` | Open billing portal |

### Usage
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/usage/:orgId` | Get usage analytics |

## 💰 Subscription Plans

| Feature | Free | Pro ($29/mo) | Enterprise ($99/mo) |
|---------|------|--------------|---------------------|
| API Keys | 3 | 20 | 100 |
| Requests/month | 1,000 | 50,000 | Unlimited |
| Team Members | 3 | 20 | Unlimited |
| Support | Community | Email | Priority |

## 🚀 Deploy to Railway

1. Push to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add PostgreSQL and Redis services
4. Set environment variables from `.env.example`
5. Done! ✅

## 🚀 Deploy to Render

1. Connect your GitHub repo at [render.com](https://render.com)
2. Choose **Web Service** → Node.js
3. Build command: `npm install && npx prisma generate && npx prisma migrate deploy`
4. Start command: `npm start`
5. Add PostgreSQL database from Render's dashboard

## 🔧 Stripe Setup

1. Create a Stripe account at [stripe.com](https://stripe.com)
2. Create Pro and Enterprise products with monthly prices
3. Copy Price IDs to `.env`
4. For webhooks: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`

## 🧪 Demo Credentials (after seeding)

```
Email: demo@example.com
Password: password123
```

## 📄 License

MIT
