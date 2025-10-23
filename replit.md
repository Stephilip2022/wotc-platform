# WOTC Optimization Platform

## Overview

The WOTC (Work Opportunity Tax Credit) Optimization Platform is a multi-tenant enterprise SaaS application designed to streamline the end-to-end process of managing work opportunity tax credits for employers. The system serves four distinct user types: employees (completing screenings), employers (managing their workforce programs), internal administrators (platform oversight), and licensees (white-label partners).

The platform automates the complex workflow of WOTC screening, submission, tracking, and credit calculation while providing intelligent assistance through AI-powered questionnaire simplification and comprehensive analytics dashboards.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

- **October 23, 2024 - Phase 1 Complete (Core Compliance & Submission)**:
  - **Employer Onboarding**: ETA Form 9198 intake with digital signature, automatic account creation, QR code generation, and unique questionnaire URLs
  - **Branding System**: Logo upload to object storage, custom colors, welcome messages, and employer-specific styling
  - **Employee Questionnaire**: Gamified wizard covering all 9 WOTC target groups and 14 subcategories with conditional logic and progress tracking
  - **Document Management**: File upload system for IRS letters and supporting documents stored in private object storage
  - **State-Specific CSV Export**: ETA Form 9061 format with 37-column universal template and 20-column Texas simplified template
  - **Admin Export UI**: Comprehensive filtering (state, employer, date range, status) with real-time record count preview
  - **Database Schema**: Multi-tenant isolation, Replit Auth integration, questionnaire responses with JSONB storage
  - **API Routes**: Complete CRUD operations for employers, employees, screenings, questionnaires, and CSV exports

- **October 23, 2024**: Created professional landing page at root route (/) with comprehensive WOTC system description, login options for employers and admins, and marketing content featuring all 9 target groups, 8 platform features, and system statistics
- Enhanced WOTC questionnaire system with comprehensive screening covering all 9 target groups and 14 subcategories
- Implemented gamified wizard interface with progress tracking, animations, and conditional logic
- Added metadata-driven eligibility determination with composite AND/OR conditions
- Created comprehensive seed data for all major WOTC target groups
- Fixed critical authentication bugs preventing user data persistence

## System Architecture

### Frontend Architecture

**Framework**: React 18 with TypeScript running on Vite for development and build optimization.

**UI System**: Shadcn/ui component library built on Radix UI primitives, following the "new-york" style variant. The design system emphasizes clarity over decoration with a utility-focused approach inspired by Linear, Stripe, and Notion. Typography uses Inter for general UI and JetBrains Mono for data fields (SSNs, tax IDs). The system implements a consistent spacing scale using Tailwind utilities and maintains role-specific portal layouts.

**Styling**: Tailwind CSS with custom design tokens defined via CSS variables. Supports light/dark themes with extensive color customization per tenant. The design includes specialized button variants with opacity-based borders and elevation effects for interactive states.

**State Management**: TanStack Query (React Query) for server state with optimistic updates and caching. Query client configured with infinite stale time and disabled automatic refetching to reduce unnecessary network calls.

**Routing**: Wouter for lightweight client-side routing with role-based route separation (employee, employer, admin portals).

**Form Handling**: React Hook Form with Zod validation schemas for type-safe form management throughout the application.

### Backend Architecture

**Runtime**: Node.js with Express.js server framework running in ESM mode.

**API Design**: RESTful API structure with route handlers organized by domain (auth, employers, employees, screenings, documents, credits). File upload support via Multer middleware with validation for document types (PDF, images, Word docs) up to 10MB.

**Business Logic**: 
- WOTC eligibility determination engine implementing IRS Form 8850 and ETA Form 9061/9062 rules
- Credit calculation system supporting multiple target groups (TANF, Veterans, Ex-Felons) with varying credit amounts and hour requirements
- Multi-tenant isolation at the employer level with role-based access control

**Session Management**: Express-session with PostgreSQL session store (connect-pg-simple) providing 7-day session persistence.

**AI Integration**: OpenAI API integration for intelligent questionnaire assistance - rewording confusing questions for users with lower literacy levels and providing contextual help.

### Data Storage

**Database**: PostgreSQL accessed via Neon serverless driver with WebSocket connections for serverless compatibility.

**ORM**: Drizzle ORM with schema-first approach. All database schemas defined in TypeScript with automatic type inference. Migration management through Drizzle Kit with migrations stored in dedicated directory.

**Schema Design**:
- Multi-tenant data model with employer-level isolation
- User management compatible with Replit Auth (sessions table, users with OAuth fields)
- Core entities: employers, employees, questionnaires, questionnaire responses, screenings, documents, credit calculations, invoices
- Support for AI assistance logging to track question rewording and user interactions
- JSONB columns for flexible storage of questionnaire structures and response data

**Data Security**: Support for PII encryption (planned), audit trail logging, and retention policy enforcement.

### Authentication & Authorization

**Provider**: Replit Auth (OpenID Connect) with Passport.js strategy integration.

**Session Strategy**: Cookie-based sessions stored in PostgreSQL with HTTP-only, secure cookies and CSRF protection.

**Role System**: Four distinct roles (employee, employer, admin, licensee) with role stored in users table and linked to employer context via employerId foreign key.

**Authorization Pattern**: Middleware-based authentication checks (`isAuthenticated`) with role-specific route protection at the Express layer.

## External Dependencies

### Third-Party Services

**Authentication**: Replit Auth (OpenID Connect provider) for user authentication and session management.

**AI Services**: OpenAI API (configurable base URL and API key) for intelligent questionnaire assistance, question rewording, and chatbot functionality.

**Payment Processing**: Stripe integration (react-stripe-js, stripe-js) for subscription billing, invoice management, and revenue-share calculations with licensees.

**Database**: Neon Serverless PostgreSQL with WebSocket support for serverless deployment environments.

### Key NPM Dependencies

**Frontend**:
- React ecosystem: react, react-dom, wouter (routing)
- UI Components: @radix-ui/* (20+ primitive components), shadcn/ui patterns
- Forms: react-hook-form, @hookform/resolvers, zod
- Data fetching: @tanstack/react-query
- Styling: tailwindcss, clsx, tailwind-merge, class-variance-authority

**Backend**:
- Server: express, http
- Database: drizzle-orm, @neondatabase/serverless, ws (WebSocket)
- Auth: passport, openid-client, express-session, connect-pg-simple
- File handling: multer
- AI: openai
- Utilities: memoizee (caching), nanoid (ID generation)

**Development**:
- Build: vite, esbuild, tsx (TypeScript execution)
- Replit plugins: @replit/vite-plugin-runtime-error-modal, @replit/vite-plugin-cartographer, @replit/vite-plugin-dev-banner

### API Integrations (Planned)

**Payroll Systems**: Adapters for ADP, Paycor, Paychex, QuickBooks, Gusto for automated hire data sync.

**State Workforce Agencies**: Automated submission robots using Puppeteer/Playwright for bulk CSV uploads to state portals.

**Document Processing**: OCR and automated parsing of state determination letters (certified/denied results).

**Accounting**: FreshBooks integration for invoice reconciliation and payment tracking.

**Communication**: Twilio for SMS-based screening reminders and multi-day engagement campaigns.

**Staffing Systems**: Bullhorn, Avionté, AxisCare integrations for candidate auto-screening during onboarding.

**Automation Platforms**: Zapier/Make webhook triggers for workflow automation based on screening and certification events.