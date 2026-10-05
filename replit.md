# Replit.md

## Overview

GrantFind is a full-stack grant management application designed to connect users with grant opportunities and help them manage their applications. It features a React frontend, an Express backend, and a PostgreSQL database. The application aims to provide a streamlined experience for browsing, viewing details, and tracking the status of grant applications. Its capabilities include robust search and filtering, responsive design, and real-time data handling.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **UI Library**: shadcn/ui components (built on Radix UI)
- **Styling**: Tailwind CSS with CSS variables
- **Routing**: Wouter
- **State Management**: TanStack Query (React Query)
- **Build Tool**: Vite

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Database Provider**: Neon Database (@neondatabase/serverless)
- **API Pattern**: RESTful endpoints
- **Error Handling**: Centralized middleware
- **Core Components**: Abstract storage interface, route handlers for CRUD operations, request logging, JSON parsing.

### Database Schema
- **Users**: Authentication structure with subscriptionTier (free/paid).
- **Grants**: Grant details (title, company, amount, deadline).
- **User Grant Applications**: Tracks user applications to grants.
- **Payments**: Stripe payment records (stripeSessionId, status, amount).

### Stripe Payment Integration
- **Setup**: Stripe Checkout (hosted) with server-side verification. User dismissed Replit's Stripe connector; keys are managed manually via Replit Secrets.
- **Required Secrets**: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID (not yet provided by user - app gracefully handles missing keys).
- **Files**: `server/stripe.ts` (routes), `server/index.ts` (raw body middleware for webhook).
- **Flow**: Profile page "Upgrade" button -> POST /api/stripe/create-checkout-session -> Stripe Checkout redirect -> /payment-success page verifies -> Webhook updates payment status and user tier.
- **Webhook**: Raw body parsing middleware registered before express.json() for signature verification.
- **Subscription Lifecycle**: Webhook handles `checkout.session.completed` (upgrade + save stripeCustomerId/stripeSubscriptionId/subscriptionEndDate), `customer.subscription.updated` (refresh end date on renewal), `customer.subscription.deleted` (downgrade to free + send email), `invoice.payment_failed` (send warning email via Resend).
- **Webhook Configuration (Live)**: Endpoint `we_1TOFOMHsPecpDcHazZ15hORE` at `https://grantfind.replit.app/api/stripe/webhook` is configured to receive: `checkout.session.completed`, `checkout.session.expired`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `payment_intent.payment_failed`. Last verified/updated: 2026-04-28.
- **Frontend**: `SubscriptionExpiryBanner` in App.tsx shows amber banner when subscription ends within 24 hours.

### UI/UX Decisions
- **Layout**: Header with user profile/actions, Sidebar for navigation.
- **Components**: Reusable GrantCard, detailed grant view pages, comprehensive shadcn/ui library.
- **Branding**: Consistent use of a golden color scheme (hsl(45, 100%, 51%)) across all pages, including buttons, gradients, backgrounds, and interactive elements, reflecting the "GrantFind" logo aesthetic. The logo features golden "Grant" text with black "Find" text and a magnifying glass icon.
- **User Flow**: Grant browsing, application status tracking, and responsive design.

### System Design Choices
- **Data Flow**: Frontend requests via React Query -> Express routes -> Storage layer -> Drizzle ORM for type-safe SQL -> Response.
- **Modularity**: Abstract storage interface for database provider switching; type-safe schema for data consistency.
- **Authentication**: Separate authentication systems for users and administrators.
- **Webhook System**: Comprehensive webhook functionality for events like user registration, business creation, and grant application submission, configurable via an admin panel.

### Google Sign-In Integration
- **Library**: `@react-oauth/google` (GoogleOAuthProvider + GoogleLogin components)
- **Required Secret**: `VITE_GOOGLE_CLIENT_ID` — the OAuth 2.0 Client ID from Google Cloud Console
- **Files**: `client/src/main.tsx` (provider setup), `client/src/pages/login.tsx`, `client/src/pages/signup.tsx`
- **Backend endpoint**: `POST /api/auth/google` — verifies the Google ID token and returns a session token
- **Authorized JavaScript Origins** (must be configured in Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID):
  - Dev preview: The current Replit dev preview URL (found in the Webview pane or from the `REPLIT_DOMAINS` environment variable — format: `https://<repl-id>.<username>.replit.dev`)
  - Production: `https://grantfind.replit.app`
  - Without these origins added, Google Sign-In will fail with "origin not allowed" errors
- **Setup checklist for new environments/domains**: When a new Replit workspace or production domain is created, the new URL must be added to the authorized origins list in Google Cloud Console (console.cloud.google.com → APIs & Services → Credentials → OAuth 2.0 Client ID). Changes take ~5 minutes to propagate after saving.

## External Dependencies

### Frontend Dependencies
- **UI Framework**: React, React DOM
- **Routing**: wouter
- **HTTP Client**: Native fetch with React Query
- **UI Components**: Radix UI
- **Styling**: Tailwind CSS, class-variance-authority
- **Date Handling**: date-fns

### Backend Dependencies
- **Database**: @neondatabase/serverless
- **ORM**: drizzle-orm, drizzle-kit
- **Validation**: drizzle-zod
- **Session Management**: connect-pg-simple
- **Payments**: stripe (Stripe Checkout integration)

### Development Dependencies
- **Build Tools**: Vite, esbuild
- **TypeScript**: For type safety
- **Development**: tsx

## Grant Development Guidelines
- **Rating System**: All grants must use integer ratings between 1-5 (with 5 being the highest). Never exceed 5.0 rating.
- **New Grant Ratings**: For any new grants, maintain ratings between 4-5 to ensure realistic and achievable scores.
- **Image Guidelines**: Grant images should be relevant to the grant category. Custom branded images should use object-contain styling to prevent cropping.
- **Deadline Format**: Display deadlines as short format (e.g., "Aug 18") on cards, switching to "Due in X days" when deadline approaches within 7 days.