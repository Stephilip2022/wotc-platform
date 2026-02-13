# WOTC Optimization Platform

## Overview

The WOTC Optimization Platform is a multi-tenant enterprise SaaS application designed to automate the end-to-end management of Work Opportunity Tax Credits (WOTC) for employers. It streamlines WOTC screening, submission, tracking, and credit calculation for employees, employers, administrators, and white-label licensees. The platform incorporates AI for questionnaire simplification, eligibility prediction, and credit forecasting, alongside comprehensive analytics dashboards. Its core purpose is to automate complex workflows, maximize tax credit capture, and integrate seamlessly with existing enterprise systems like ATS/HCM and payroll providers.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is built with React 18 and TypeScript, utilizing Vite for tooling and Shadcn/ui (based on Radix UI) for a utility-focused design. Styling is managed with Tailwind CSS, supporting light/dark themes and tenant-specific customizations. TanStack Query handles server state, Wouter manages client-side routing, and React Hook Form with Zod ensures type-safe form validation.

### Backend Architecture

The backend uses Node.js with Express.js to provide a RESTful API organized by domain, supporting file uploads via Multer. It implements WOTC eligibility and credit calculation logic, multi-tenant isolation, and role-based access control. Session management is handled by Express-session with a PostgreSQL store. AI integration leverages the OpenAI API for intelligent questionnaire assistance.

### Data Storage

PostgreSQL, accessed via Neon serverless driver, is the primary database. Drizzle ORM is used with a schema-first approach, TypeScript-defined schemas, and Drizzle Kit for migrations. The multi-tenant data model includes core entities for employers, employees, screenings, and credit calculations, utilizing JSONB for flexible data storage and ensuring PII encryption, audit trails, and data retention.

### Authentication & Authorization

Clerk authentication provides sign-in/sign-up via `@clerk/clerk-react` (frontend) and `@clerk/express` (backend middleware). The backend uses `clerkMiddleware()` with `getAuth(req).userId` to identify users. User records are auto-created/synced on first login via `getOrCreateUser()` in `server/clerkAuth.ts`. A role-based access control system supports employee, employer, admin, and licensee roles, enforced via Express middleware. Environment variables: `VITE_CLERK_PUBLISHABLE_KEY` (frontend), `CLERK_SECRET_KEY` (backend).

### Core Features

-   **WOTC Compliance & Screening**: Automated ETA Form 9198 intake, digital signatures, and a gamified, conditional logic questionnaire covering all WOTC target groups.
-   **Document Management**: Secure file upload system for IRS letters and supporting documents, including AI-powered OCR for data extraction.
-   **Credit Calculation & Tracking**: Automatic calculation of WOTC credits based on hours worked, determination tracking, and an admin interface for status updates. Includes advanced features like 400-hour milestone tracking and multi-credit bundling (R&D, state/local incentives).
-   **Payroll & Accounting Integration**: Enhanced CSV parser with intelligent column detection, employee matching, and reusable mapping templates. Bidirectional sync with major payroll providers (ADP, Gusto, QuickBooks Payroll) for real-time hours/wages and accounting exports to QuickBooks and Xero.
-   **Analytics & Reporting**: Comprehensive dashboards for employers and administrators, covering KPIs, credit projections, system-wide statistics, revenue tracking, and churn rates. Enhanced with interactive data visualizations (recharts), multi-credit program analytics (by category, geographic, trends), ROI summary, and automated PDF report generation (credit summary, ROI analysis, compliance) using PDFKit. Reports stored in `generated_reports` table with download tracking.
-   **Email Notifications**: Transactional emails for screening invites, status updates, and invoices via Resend.
-   **State Automation**: Production-ready state portal automation using Playwright bots (Texas Appian/Okta SSO) and SFTP (CSDC states: AL, AR, CO, GA, ID, OK, OR, SC, VT, WV). Includes OCR for determination letter parsing, credential management with encryption, MFA handling for 56 configured state portals, and CSDC fixed-width file generation with automated SFTP upload to hermes.csdco.com.
-   **AI-Powered Intelligence**: Eligibility prediction engine with confidence scores, smart questionnaire optimization (reading level adjustment, Spanish translation), prediction tracking, and predictive credit forecasting based on historical data. Includes AI turnover prediction.
-   **Enterprise Integrations**: Robust OAuth 2.0 infrastructure, a flexible integration framework, and production-ready bidirectional connectors for ATS/HCM (Greenhouse, BambooHR) and payroll systems. Includes comprehensive monitoring and automated sync schedulers.
-   **Zero-Touch Processing**: Automated submission readiness detection, intelligent queue management, and an orchestrator for automated state portal submissions with retry logic and MFA handling.
-   **Public API & Developer Platform**: Secure REST API (v1) for employees, screenings, and credits with API key management, scope-based permissions, rate limiting, and a robust webhook system. A developer portal UI provides key management, webhook configuration, interactive API docs, and usage analytics.
-   **White-Label & Enterprise Features**: Admin portal for white-label licensee management (branding, billing, revenue sharing), a Spanish translation service, and enhanced integration security.
-   **UI Components**: AI Chat Assistant, Document OCR Page, Multi-Credit Bundling Page, and a White-Label Preview Component.

## External Dependencies

### Third-Party Services

-   **Authentication**: Replit Auth (OpenID Connect)
-   **AI Services**: OpenAI API
-   **Payment Processing**: Stripe
-   **Database**: Neon Serverless PostgreSQL
-   **Email**: Resend

### Key NPM Dependencies

-   **Frontend**: react, react-dom, wouter, @radix-ui/*, shadcn/ui, react-hook-form, zod, @tanstack/react-query, tailwindcss
-   **Backend**: express, drizzle-orm, @neondatabase/serverless, passport, openid-client, express-session, connect-pg-simple, multer, openai, pdfkit