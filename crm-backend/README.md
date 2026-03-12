# CRM Backend

A multi-tenant, highly available CRM backend powered by **Apollo GraphQL**, **Node.js**, and **TypeScript**. Supports email/password login, Google Sign-In, and Apple Sign-In. Designed to run on AWS (primary) and GCP (complementary) infrastructure.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
  - [1. Clone & Install](#1-clone--install)
  - [2. Configure Environment Variables](#2-configure-environment-variables)
  - [3. Start Infrastructure (Docker)](#3-start-infrastructure-docker)
  - [4. Run Database Migrations](#4-run-database-migrations)
  - [5. Start the Dev Server](#5-start-the-dev-server)
- [Running with Docker Compose (Full Stack)](#running-with-docker-compose-full-stack)
- [GraphQL API Usage](#graphql-api-usage)
  - [Authentication Examples](#authentication-examples)
- [Project Structure](#project-structure)
- [Environment Variables Reference](#environment-variables-reference)
- [AWS Infrastructure Setup](#aws-infrastructure-setup)
  - [Required AWS Services](#required-aws-services)
  - [Deploy with Terraform](#deploy-with-terraform)
  - [Cognito Social Login Configuration](#cognito-social-login-configuration)
- [GCP Infrastructure Setup](#gcp-infrastructure-setup)
  - [Required GCP Services](#required-gcp-services)
  - [Deploy with Terraform](#deploy-with-terraform-1)
- [Apple Sign-In Setup](#apple-sign-in-setup)
- [Google Sign-In Setup](#google-sign-in-setup)
- [Production Deployment](#production-deployment)
- [Health Check](#health-check)

---

## Architecture Overview

```
                        ┌─────────────────────────────────────┐
                        │           AWS Infrastructure          │
  Client  ──HTTPS──►   │  ALB  ──►  ECS Fargate (2-10 tasks)  │
                        │              │                         │
                        │    ┌─────────┼──────────┐             │
                        │  Cognito   RDS PG    ElastiCache      │
                        │  (Users)  (Multi-AZ)  (Redis HA)      │
                        │            + Read      + Replica      │
                        │            Replica                     │
                        │   Secrets Manager / KMS / SES / SNS   │
                        └──────────────┬──────────────────────-─┘
                                       │ Auth events / user events
                        ┌──────────────▼──────────────────────-─┐
                        │           GCP Infrastructure            │
                        │  Pub/Sub Topics ──► BigQuery Analytics  │
                        │  Google OAuth2 token verification       │
                        │  Cloud Storage (file uploads)           │
                        └─────────────────────────────────────────┘
```

**Multi-tenancy model:** Shared database with `tenantId` on every row. Each tenant has its own domain, plan, and auth settings.

---

## Prerequisites

Make sure the following are installed on your machine:

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 22+ | https://nodejs.org |
| npm | 10+ | Comes with Node.js |
| Docker | 24+ | https://docs.docker.com/get-docker |
| Docker Compose | v2+ | Included with Docker Desktop |
| Terraform | 1.9+ | https://developer.hashicorp.com/terraform/install |
| AWS CLI | 2+ | https://aws.amazon.com/cli |
| gcloud CLI | latest | https://cloud.google.com/sdk/docs/install |

---

## Local Development Setup

### 1. Clone & Install

```bash
# Navigate into the crm-backend directory
cd crm-backend

# Install dependencies
npm install
```

### 2. Configure Environment Variables

```bash
# Copy the example env file
cp .env.example .env
```

Open `.env` and fill in the required values. At minimum for local development you need:

```dotenv
# Required — everything else has a sensible default
DATABASE_URL=postgresql://crm:crm_password@localhost:5432/crm_db
REDIS_URL=redis://localhost:6379

JWT_ACCESS_SECRET=change-me-to-a-random-32-char-string-!!!
JWT_REFRESH_SECRET=change-me-to-another-32-char-string!!!

# Google Sign-In (get from Google Cloud Console)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com

# Apple Sign-In
APPLE_TEAM_ID=XXXXXXXXXX
APPLE_CLIENT_ID=com.yourcompany.crm
APPLE_KEY_ID=XXXXXXXXXX

# AWS Cognito (required even in dev — can point to a real pool)
AWS_COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
AWS_COGNITO_CLIENT_ID=your-cognito-client-id

# GCP
GCP_PROJECT_ID=your-gcp-project-id

# SES from-address
AWS_SES_FROM_EMAIL=noreply@yourdomain.com
```

> **Tip:** For local development the app skips CloudWatch and Pub/Sub calls when `NODE_ENV=development`, so those services don't need to be fully configured to get started.

### 3. Start Infrastructure (Docker)

This starts a local PostgreSQL and Redis container that mirror the AWS RDS and ElastiCache setup:

```bash
docker compose up postgres redis -d
```

Wait for both containers to report healthy:

```bash
docker compose ps
# NAME       STATUS
# postgres   running (healthy)
# redis      running (healthy)
```

### 4. Run Database Migrations

Generate the Prisma client and apply migrations:

```bash
# Generate Prisma client types
npm run prisma:generate

# Create/apply all migrations (creates tables in the database)
npm run prisma:migrate:dev
```

> On first run, Prisma will prompt you to name the initial migration — call it `init`.

To visually browse the database in your browser:

```bash
npm run prisma:studio
# Opens http://localhost:5555
```

### 5. Start the Dev Server

```bash
npm run dev
```

The server will start with hot-reload. You should see:

```
info: Database connected
info: Redis connected
info: Server ready at http://localhost:4000/graphql
info: Environment: development
```

Open **http://localhost:4000/graphql** in your browser — the Apollo Sandbox will load where you can explore the schema and run queries interactively.

---

## Running with Docker Compose (Full Stack)

To run the entire stack (app + Postgres + Redis) in containers:

```bash
# Build and start everything
docker compose up --build

# Or run in the background
docker compose up --build -d
```

To also open Prisma Studio alongside:

```bash
docker compose --profile debug up
```

View logs:

```bash
docker compose logs -f app
```

Stop everything:

```bash
docker compose down

# To also remove volumes (wipes database data)
docker compose down -v
```

---

## GraphQL API Usage

The GraphQL endpoint is: `POST http://localhost:4000/graphql`

### Authentication Examples

#### Register a New User

```graphql
mutation Register {
  register(input: {
    email: "alice@example.com"
    password: "SecurePass1!"
    firstName: "Alice"
    lastName: "Smith"
    tenantDomain: "acme"
  }) {
    accessToken
    refreshToken
    expiresIn
    tokenType
    user {
      id
      email
      fullName
      role
    }
    tenant {
      id
      name
      domain
    }
  }
}
```

#### Login with Email & Password

```graphql
mutation Login {
  login(input: {
    email: "alice@example.com"
    password: "SecurePass1!"
    tenantDomain: "acme"
  }) {
    accessToken
    refreshToken
    expiresIn
    user { id email role }
  }
}
```

#### Login with Google

The client obtains a Google `idToken` using the Google Sign-In SDK, then:

```graphql
mutation GoogleLogin {
  loginWithGoogle(input: {
    idToken: "<google-id-token-from-client>"
    tenantDomain: "acme"
  }) {
    accessToken
    refreshToken
    user { id email firstName lastName }
  }
}
```

#### Login with Apple

The client obtains an `identityToken` and `authorizationCode` from Apple Sign-In, then:

```graphql
mutation AppleLogin {
  loginWithApple(input: {
    identityToken: "<apple-identity-token>"
    authorizationCode: "<apple-authorization-code>"
    tenantDomain: "acme"
    firstName: "Bob"   # Only available on first sign-in
    lastName: "Jones"
  }) {
    accessToken
    refreshToken
    user { id email }
  }
}
```

#### Refresh an Access Token

```graphql
mutation Refresh {
  refreshToken(input: {
    refreshToken: "<your-refresh-token>"
  }) {
    accessToken
    refreshToken
    expiresIn
  }
}
```

#### Authenticated Requests

Pass the access token in the `Authorization` header:

```
Authorization: Bearer <accessToken>
```

#### Get Current User

```graphql
query Me {
  me {
    id
    email
    fullName
    role
    emailVerified
    lastLoginAt
  }
}
```

#### Logout

```graphql
mutation Logout {
  logout(refreshToken: "<your-refresh-token>") {
    success
    message
  }
}
```

#### Revoke All Sessions (logout everywhere)

```graphql
mutation RevokeAll {
  revokeAllSessions {
    success
    message
  }
}
```

#### Create a Tenant (SUPER_ADMIN only)

```graphql
mutation CreateTenant {
  createTenant(input: {
    name: "Acme Corp"
    domain: "acme"
    slug: "acme"
    adminEmail: "admin@acme.com"
    adminPassword: "SecurePass1!"
    adminFirstName: "Admin"
    adminLastName: "User"
    plan: PROFESSIONAL
  }) {
    id
    name
    domain
    plan
    status
  }
}
```

---

## Project Structure

```
crm-backend/
├── src/
│   ├── index.ts                        # Express + Apollo Server entry point
│   ├── context.ts                      # GraphQL context (auth, services, request meta)
│   ├── config/
│   │   ├── index.ts                    # Zod-validated environment config
│   │   ├── aws.config.ts               # AWS SDK client instances
│   │   └── gcp.config.ts               # GCP client instances (OAuth2, Pub/Sub)
│   ├── graphql/
│   │   ├── schema/
│   │   │   ├── auth.schema.ts          # GraphQL type definitions
│   │   │   └── index.ts                # Merged schema
│   │   ├── resolvers/
│   │   │   ├── auth.resolver.ts        # All auth queries & mutations
│   │   │   └── index.ts                # Merged resolvers
│   │   └── directives/
│   │       └── auth.directive.ts       # @auth and @requiresRole directives
│   ├── services/
│   │   ├── auth.service.ts             # Core auth logic (login, register, social)
│   │   ├── token.service.ts            # JWT generation, verification, rotation
│   │   ├── cache.service.ts            # Redis operations (tokens, sessions)
│   │   ├── cognito.service.ts          # AWS Cognito user lifecycle management
│   │   ├── google-auth.service.ts      # Google ID token verification
│   │   ├── apple-auth.service.ts       # Apple identity token verification
│   │   ├── tenant.service.ts           # Tenant lookup with Redis caching
│   │   └── pubsub.service.ts           # GCP Pub/Sub event publishing
│   ├── middleware/
│   │   ├── auth.middleware.ts          # REST endpoint auth guard
│   │   └── tenant.middleware.ts        # Tenant domain extraction
│   └── utils/
│       ├── logger.ts                   # Winston logger (+ CloudWatch in prod)
│       ├── errors.ts                   # Typed GraphQL errors with error codes
│       └── validators.ts               # Zod validation schemas
├── prisma/
│   └── schema.prisma                   # Database schema (multi-tenant)
├── infrastructure/
│   ├── aws/
│   │   ├── main.tf                     # Provider, backend, variables
│   │   ├── cognito.tf                  # User Pool + Google/Apple IdP
│   │   ├── rds.tf                      # PostgreSQL Multi-AZ + read replica
│   │   ├── elasticache.tf              # Redis HA replication group
│   │   └── ecs.tf                      # ECS Fargate, ALB, auto-scaling, KMS, Secrets
│   └── gcp/
│       └── main.tf                     # Pub/Sub, BigQuery, GCS, service accounts
├── Dockerfile                          # Multi-stage production image
├── docker-compose.yml                  # Local dev: Postgres + Redis + app
├── .env.example                        # All environment variables documented
├── package.json
└── tsconfig.json
```

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | No | `development` / `production` (default: `development`) |
| `PORT` | No | Server port (default: `4000`) |
| `DATABASE_URL` | **Yes** | PostgreSQL connection string |
| `REDIS_URL` | No | Redis connection URL (default: `redis://localhost:6379`) |
| `JWT_ACCESS_SECRET` | **Yes** | Secret for signing access tokens (min 32 chars) |
| `JWT_REFRESH_SECRET` | **Yes** | Secret for signing refresh tokens (min 32 chars) |
| `JWT_ACCESS_EXPIRES_IN` | No | Access token TTL (default: `15m`) |
| `JWT_REFRESH_EXPIRES_IN` | No | Refresh token TTL (default: `7d`) |
| `AWS_REGION` | No | AWS region (default: `us-east-1`) |
| `AWS_COGNITO_USER_POOL_ID` | **Yes** | Cognito User Pool ID |
| `AWS_COGNITO_CLIENT_ID` | **Yes** | Cognito App Client ID |
| `AWS_SES_FROM_EMAIL` | **Yes** | Verified SES sender address |
| `GOOGLE_CLIENT_ID` | **Yes** | Google OAuth2 Client ID |
| `GCP_PROJECT_ID` | **Yes** | GCP Project ID |
| `APPLE_TEAM_ID` | **Yes** | Apple Developer Team ID |
| `APPLE_CLIENT_ID` | **Yes** | Apple Service ID (e.g. `com.company.crm`) |
| `APPLE_KEY_ID` | **Yes** | Apple Sign-In key ID |

See `.env.example` for the complete list with descriptions.

---

## AWS Infrastructure Setup

### Required AWS Services

- **Cognito** — User Pool with Google + Apple federation
- **RDS PostgreSQL** — Multi-AZ with read replica
- **ElastiCache (Redis)** — HA replication group
- **ECS Fargate** — Container orchestration + auto-scaling
- **ALB** — Application Load Balancer
- **SES** — Transactional email (must verify domain/email)
- **Secrets Manager** — Encrypted secrets storage
- **KMS** — Encryption key management
- **CloudWatch** — Logging and metrics

### Deploy with Terraform

```bash
cd infrastructure/aws

# Initialise (downloads providers, configures S3 backend)
terraform init \
  -backend-config="bucket=your-terraform-state-bucket" \
  -backend-config="region=us-east-1"

# Review what will be created
terraform plan \
  -var="vpc_id=vpc-xxxxxxxx" \
  -var="private_subnet_ids=[\"subnet-aaa\",\"subnet-bbb\"]" \
  -var="public_subnet_ids=[\"subnet-ccc\",\"subnet-ddd\"]" \
  -var="db_password=YourSecureDBPassword1!" \
  -var="google_client_id=your-google-client-id" \
  -var="google_client_secret=your-google-client-secret" \
  -var="apple_client_id=com.yourcompany.crm" \
  -var="apple_team_id=XXXXXXXXXX" \
  -var="apple_key_id=XXXXXXXXXX" \
  -var="apple_private_key=$(cat /path/to/AuthKey_XXXXXXXXXX.p8)" \
  -var="ecr_repository_url=123456789.dkr.ecr.us-east-1.amazonaws.com/crm-backend"

# Apply
terraform apply [same -var flags as above]
```

After apply, Terraform outputs the endpoints you need for your `.env`:

```
cognito_user_pool_id   = "us-east-1_xxxxxxxxx"
cognito_client_id      = "xxxxxxxxxxxxxxxxxxxxxxxxxx"
rds_endpoint           = "crm-backend-production.xxx.us-east-1.rds.amazonaws.com:5432"
redis_primary_endpoint = "crm-backend-redis.xxx.cache.amazonaws.com"
```

### Cognito Social Login Configuration

After deploying, configure the Cognito Hosted UI domain in the AWS Console:

1. Go to **Cognito → User Pools → your pool → App integration → Domain**
2. Set a domain prefix, e.g. `crm-auth`
3. The full domain will be: `https://crm-auth.auth.us-east-1.amazoncognito.com`

---

## GCP Infrastructure Setup

### Required GCP Services

- **Cloud Pub/Sub** — Auth and user event streaming
- **BigQuery** — Auth event analytics (partitioned tables)
- **Cloud Storage** — File/document storage
- **Google Identity Platform** — OAuth2 token verification

### Deploy with Terraform

```bash
# Authenticate with GCP
gcloud auth application-default login

cd infrastructure/gcp

terraform init \
  -backend-config="bucket=your-gcp-terraform-state-bucket"

terraform plan \
  -var="project_id=your-gcp-project-id" \
  -var="region=us-central1"

terraform apply \
  -var="project_id=your-gcp-project-id" \
  -var="region=us-central1"
```

---

## Apple Sign-In Setup

1. Log in to [Apple Developer Console](https://developer.apple.com)
2. Go to **Certificates, Identifiers & Profiles → Identifiers**
3. Create a new **App ID** with Sign In with Apple capability
4. Create a new **Services ID** (this is your `APPLE_CLIENT_ID`, e.g. `com.yourcompany.crm`)
5. Configure the Services ID:
   - Enable **Sign In with Apple**
   - Add your domain and return URL under **Web Authentication Configuration**
6. Go to **Keys** and create a new key:
   - Enable **Sign In with Apple**
   - Download the `.p8` private key file
   - Note the **Key ID** (`APPLE_KEY_ID`) and your **Team ID** (`APPLE_TEAM_ID`)
7. Add to `.env`:

```dotenv
APPLE_TEAM_ID=XXXXXXXXXX
APPLE_CLIENT_ID=com.yourcompany.crm
APPLE_KEY_ID=XXXXXXXXXX
APPLE_PRIVATE_KEY_PATH=/path/to/AuthKey_XXXXXXXXXX.p8
```

---

## Google Sign-In Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services → Credentials**
2. Create an **OAuth 2.0 Client ID**:
   - Application type: **Web application**
   - Add Authorized JavaScript origins: `http://localhost:3000` (dev), `https://app.yourcrm.com` (prod)
   - Add Authorized redirect URIs as needed
3. Copy the **Client ID** and **Client Secret**
4. Add to `.env`:

```dotenv
GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxx
```

The backend verifies the `idToken` sent from the client-side Google Sign-In SDK. No redirect flow is handled server-side.

---

## Production Deployment

### Build & Push Docker Image

```bash
# Authenticate with ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  123456789.dkr.ecr.us-east-1.amazonaws.com

# Build the production image
docker build -t crm-backend .

# Tag and push
docker tag crm-backend:latest \
  123456789.dkr.ecr.us-east-1.amazonaws.com/crm-backend:latest

docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/crm-backend:latest
```

### Run Migrations in Production

Before deploying a new version, run migrations against the production database:

```bash
DATABASE_URL="postgresql://crm_admin:password@your-rds-endpoint:5432/crm_db" \
  npm run prisma:migrate
```

> In a CI/CD pipeline this should run as a one-off ECS task before the new service version is deployed.

### Secrets in AWS Secrets Manager

Store production secrets via the CLI:

```bash
# Database URL
aws secretsmanager create-secret \
  --name "crm-backend/production/database-url" \
  --secret-string "postgresql://crm_admin:password@rds-endpoint:5432/crm_db"

# JWT secrets
aws secretsmanager create-secret \
  --name "crm-backend/production/jwt-secrets" \
  --secret-string '{"access":"your-access-secret","refresh":"your-refresh-secret"}'
```

The ECS task definition pulls these automatically via the `secrets` block in the container definition.

---

## Health Check

The server exposes a health endpoint (no auth required):

```bash
curl http://localhost:4000/health
```

```json
{
  "status": "healthy",
  "timestamp": "2026-03-11T10:00:00.000Z"
}
```

Returns `503` if the database is unreachable. Used by the ALB target group health check and ECS container health check.
