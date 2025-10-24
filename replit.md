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