# WOTC Optimization Platform

## Overview

The WOTC Optimization Platform is a multi-tenant enterprise SaaS application designed to streamline the end-to-end management of Work Opportunity Tax Credits for employers. It serves employees, employers, internal administrators, and white-label licensees by automating WOTC screening, submission, tracking, and credit calculation. The platform integrates AI-powered questionnaire simplification and provides comprehensive analytics dashboards, aiming to automate complex workflows and maximize tax credit capture.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & UI**: React 18 with TypeScript, Vite, and Shadcn/ui (based on Radix UI) for a clear, utility-focused design. Styling uses Tailwind CSS with light/dark themes and tenant-specific customization.
**State Management**: TanStack Query for server state caching and optimistic updates.
**Routing**: Wouter for lightweight, role-based client-side routing.
**Form Handling**: React Hook Form with Zod for type-safe form validation.

### Backend Architecture

**Runtime & API**: Node.js with Express.js for a RESTful API, organized by domain. Supports file uploads via Multer.
**Business Logic**: Implements WOTC eligibility determination based on IRS and ETA rules, a credit calculation engine for various target groups, and multi-tenant isolation with role-based access control.
**Session Management**: Express-session with PostgreSQL store for persistent cookie-based sessions.
**AI Integration**: Utilizes OpenAI API for intelligent questionnaire assistance, including question rewording and contextual help.

### Data Storage

**Database**: PostgreSQL accessed via Neon serverless driver.
**ORM**: Drizzle ORM with a schema-first approach, TypeScript-defined schemas, and Drizzle Kit for migrations.
**Schema Design**: Multi-tenant data model with employer isolation, Replit Auth compatibility, and core entities for employers, employees, screenings, documents, and credit calculations. Uses JSONB for flexible data storage.
**Security**: Includes provisions for PII encryption, audit trails, and data retention policies.

### Authentication & Authorization

**Provider**: Replit Auth (OpenID Connect) integrated with Passport.js.
**Session Strategy**: Cookie-based sessions stored in PostgreSQL with HTTP-only, secure cookies, and CSRF protection.
**Role System**: Supports four distinct roles (employee, employer, admin, licensee) with role-based access control enforced via Express middleware.

### Core Features

- **WOTC Compliance**: Automated ETA Form 9198 intake with digital signatures, QR codes, and questionnaire URLs.
- **Employee Screening**: Gamified, conditional logic questionnaire covering all WOTC target groups.
- **Document Management**: Secure file upload system for IRS letters and supporting documents.
- **Credit Calculation & Tracking**: Auto-calculation of WOTC credits based on hours worked, determination tracking, and an admin interface for status updates.
- **Payroll Integration**: Enhanced CSV parser with intelligent column detection, employee matching, and reusable mapping templates for importing payroll data.
- **Billing & Subscriptions**: Comprehensive billing schema, subscription plans, and Stripe integration for payments and invoicing.
- **Analytics & Reporting**: Comprehensive dashboards for employers (KPIs, credit projections) and administrators (system-wide statistics, revenue tracking, MRR/ARR, churn rates).
- **Email Notifications**: Resend integration for transactional emails (screening invites, status updates, invoices) with responsive, branded templates.
- **State Automation (Phase 4 - Complete)**: Production-ready state portal automation with Playwright-based submission bots, OCR-powered determination letter parsing, credential management with AES-256-GCM encryption, comprehensive MFA token handling, and automatic credential rotation with audit trail. 56 state portals configured (7 automation-enabled: CA, TX, NY, FL, IL, OH, PA).
- **AI-Powered Intelligence (Phase 5 - Complete)**: 
  - **Eligibility Prediction Engine**: AI analyzes applicant data (demographics, employment history, questionnaire responses) to predict WOTC eligibility with confidence scores (0-100%), target group recommendations, and detailed reasoning.
  - **Smart Questionnaire Optimization**: Real-time question simplification using OpenAI to adjust reading level (6th-14th grade), Spanish translation support, Flesch-Kincaid readability analysis, and batch processing capabilities.
  - **Prediction Tracking & Analytics**: Comprehensive validation system comparing AI predictions against actual determinations to measure accuracy rates, with detailed statistics on token usage and performance metrics.
  - **Predictive Credit Forecasting**: Historical data analysis with conversion rate tracking, hiring pipeline projections, and automated credit estimates based on target group distribution and typical hours worked patterns.
- **Enterprise Integrations (Phase 6 - Complete)**: 
  - **OAuth 2.0 Infrastructure**: Complete token management system with AES-256-GCM encryption, automatic refresh logic, webhook validation, and exponential backoff retry mechanisms.
  - **Integration Framework**: Field mapping engine, sync logging, connection health monitoring, and comprehensive error tracking for all external system integrations.
  - **ATS/HCM Connectors**: Production-ready bidirectional sync for Greenhouse (candidate import, WOTC results export) and BambooHR (employee sync, certification status updates) with auto-creation of employee records and screening workflows.
  - **Payroll Integrations**: Real-time hours and wages sync from ADP, Gusto, and QuickBooks Payroll with automatic credit recalculation. Employee matching via integrationSyncedRecords ensures accurate data attribution. Enhanced hoursWorked schema stores both hours (decimal 10,2) and wages (decimal 12,2) for precise WOTC credit calculations.
  - **Accounting Exports**: QuickBooks and Xero integrations for pushing certified WOTC credits as journal entries with detailed supporting documentation, credit memos, and tax filing attachments for CPA workflows.
  - **Integration Monitoring**: Comprehensive dashboard tracking sync status, error logs, data flow statistics, connection health metrics, and API rate limit monitoring across all connected systems.
  - **Automated Sync Scheduler**: Configurable sync intervals (real-time webhooks, hourly, daily) with intelligent retry logic using exponential backoff, connection health checks, and automatic pause/resume for unhealthy connections.
- **Zero-Touch Processing (Phase 7 - Complete)**: 
  - **Submission Readiness Detection**: Automated monitoring engine that validates screening completion (eligible status, forms generated, state credentials present), assigns readiness scores (0-100), identifies missing fields, and calculates submission priority (1-10) based on hire date urgency and certification deadlines.
  - **Intelligent Queue Manager**: Batch optimization system that groups screenings by state/employer/submission window, respects state portal limits (maxBatchSize), implements priority escalation for urgent items (priority ≥8), and uses database transactions for race-condition-safe job creation ensuring single-claim guarantees.
  - **Automated Submission Orchestrator**: Production-ready background worker that polls for pending jobs, enforces concurrency limits (max 5 simultaneous submissions), integrates with Playwright bots for automated state portal submission, implements exponential backoff retry logic (3 attempts with 5-second base delay), and automatically handles MFA challenges using TOTP/authenticator apps.
  - **Monitoring & Alerting System**: Comprehensive analytics dashboard with real-time metrics (success rates, processing times, job statistics), automated anomaly detection (high failure rates, stuck jobs, repeated failures), email notifications for submission success/failure, state-by-state performance breakdown, and auto-refreshing admin UI with detailed failure logs and filtering capabilities.

## External Dependencies

### Third-Party Services

-   **Authentication**: Replit Auth (OpenID Connect).
-   **AI Services**: OpenAI API for questionnaire assistance.
-   **Payment Processing**: Stripe for billing, invoicing, and subscription management.
-   **Database**: Neon Serverless PostgreSQL.
-   **Email**: Resend for transactional email notifications.

### Key NPM Dependencies

-   **Frontend**: react, react-dom, wouter, @radix-ui/*, shadcn/ui, react-hook-form, zod, @tanstack/react-query, tailwindcss.
-   **Backend**: express, drizzle-orm, @neondatabase/serverless, passport, openid-client, express-session, connect-pg-simple, multer, openai.