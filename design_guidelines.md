# Rockerbox WOTC Platform - Design Guidelines

## Brand Identity & Color Scheme

**Brand Name**: Rockerbox - The WOTC Optimization Platform

**Color Philosophy**: Warm amber/gold tones that convey stability, trust, and prosperity - perfect for a tax credit platform. The name "Rockerbox" evokes earthy, solid foundations while gold accents suggest financial success.

**Primary Colors**:
- **Primary (Amber Gold)**: HSL(38, 92%, 50%) - Rich amber for CTAs, accents, and branding
- **Primary Foreground**: HSL(20, 14%, 12%) - Dark brown text on primary buttons
- **Gradient Text**: Linear gradient from amber to orange to gold for headlines

**Background Colors**:
- **Light Mode**: Warm cream HSL(40, 33%, 98%) 
- **Dark Mode**: Rich chocolate HSL(20, 20%, 9%)

**UI Accents**:
- Cards and surfaces have warm undertones
- Borders use soft brown-gray tones
- Muted colors maintain warmth rather than cold gray

## Design Approach

**Selected Approach**: Design System - Modern SaaS Enterprise Pattern with Premium Brand Identity

**Justification**: This WOTC platform is a utility-focused, information-dense enterprise application requiring exceptional clarity, efficiency, and consistency across multiple user portals. The primary success metric is user task completion (screening questionnaires, form submissions, credit tracking) rather than visual engagement.

**Reference Models**: Linear (clean data presentation), Stripe (clarity in complex information), Notion (intuitive form design), and Retool (enterprise dashboard patterns)

**Core Design Principles**:
- Clarity over decoration: Every element serves a functional purpose
- Hierarchical information architecture: Complex data organized into digestible sections
- Progressive disclosure: Show essential information first, details on demand
- Consistency across portals: Shared patterns with role-appropriate customization
- Trust through professionalism: Polished, credible interface for financial/compliance data

---

## Typography System

**Font Stack**:
- **Primary**: Inter (via Google Fonts) - exceptional readability for data-dense interfaces
- **Monospace**: JetBrains Mono - for reference numbers, tax IDs, SSNs

**Type Scale**:
- **Headings**: 
  - H1: text-4xl font-bold (page titles)
  - H2: text-2xl font-semibold (section headers)
  - H3: text-xl font-semibold (card headers, form sections)
  - H4: text-lg font-medium (subsections)
- **Body**: 
  - Primary: text-base (forms, tables, content)
  - Secondary: text-sm (metadata, helper text)
  - Small: text-xs (timestamps, badges)
- **Labels**: text-sm font-medium uppercase tracking-wide (form labels, data labels)

**Line Height**: Generous spacing for readability - leading-relaxed for body text, leading-tight for headings

---

## Layout System

**Spacing Primitives**: Use Tailwind units of **2, 4, 6, 8, 12, 16, 20, 24** for consistent rhythm
- Micro spacing (form elements): p-2, gap-2, space-y-2
- Standard spacing (cards, sections): p-6, gap-6, space-y-6  
- Major spacing (page sections): p-8, py-12, gap-12
- Macro spacing (portal sections): py-16, py-20

**Grid System**:
- **Dashboards**: 12-column grid (grid-cols-12) for flexible widget layouts
- **Forms**: Single column max-w-2xl for optimal readability, two-column (grid-cols-2) for compact field pairs
- **Data Tables**: Full-width with horizontal scroll on mobile
- **Cards**: 2-3 column grids (grid-cols-1 md:grid-cols-2 lg:grid-cols-3) for metrics/stats

**Container Widths**:
- Dashboard content: max-w-7xl
- Forms: max-w-2xl
- Data tables: max-w-full with overflow-x-auto

---

## Component Library

### Navigation Architecture

**Admin/Employer Portal Navigation**:
- **Sidebar Navigation** (fixed left, 280px): 
  - Logo at top (h-16)
  - Main navigation items with icons (py-3 px-4)
  - User profile section at bottom
  - Collapsible on mobile
- **Top Bar** (h-16):
  - Breadcrumb navigation
  - Search functionality
  - User menu/notifications

**Employee Portal Navigation**:
- **Simplified Top Bar Only**: Logo, progress indicator, minimal menu
- Focus on single-task flow (questionnaire completion)

### Form Components (Critical for WOTC Questionnaires)

**Form Container**:
- Clean white background with subtle border
- Generous padding (p-8)
- Rounded corners (rounded-lg)
- Sections separated by horizontal dividers (border-b with py-8)

**Input Fields**:
- Height: h-10 for text inputs, h-12 for important fields (SSN, EIN)
- Border: border-2 with focus ring
- Label above input (text-sm font-medium mb-2)
- Helper text below (text-xs)
- Error states with inline validation messages

**Question Groups**:
- Each target group as expandable accordion or stepped wizard
- Radio/checkbox groups with generous spacing (space-y-3)
- Visual hierarchy: Question number → Question text → Helper text → Input

**Progress Tracking**:
- Multi-step progress bar (h-2 rounded-full) showing completion percentage
- Step indicators with check marks for completed sections
- "Save & Continue" and "Back" buttons prominently placed

### Dashboard Widgets

**Metric Cards**:
- Compact height (p-6)
- Large number display (text-3xl font-bold)
- Label below (text-sm)
- Trend indicator if applicable
- Grid layout: grid-cols-1 md:grid-cols-2 lg:grid-cols-4

**Data Tables**:
- Sticky header row
- Alternating row treatment for readability
- Row height: h-12 minimum
- Cell padding: px-4 py-3
- Action buttons in rightmost column
- Sortable column headers with icons
- Pagination at bottom

**Status Indicators**:
- Badges for certification status (rounded-full px-3 py-1 text-xs font-medium)
- Progress bars for completion rates
- Icon-text combinations for quick scanning

### Employer Branding (White-Label)

**Customizable Elements**:
- Logo upload area (max-h-12)
- Custom welcome message on employee questionnaire
- Footer text/links
- Email template header

**Fixed Elements**:
- Core layout structure remains consistent
- Form fields maintain standard styling
- Navigation patterns unchanged

### Document Management

**Upload Component**:
- Drag-and-drop zone (border-2 border-dashed p-8 rounded-lg)
- File list with preview icons
- Progress indicators during upload
- Document type tags (DD-214, TANF letter, etc.)

**Document Viewer**:
- Modal overlay for PDF preview
- Download button prominent
- Document metadata sidebar

### Admin Portal - Specific Components

**Employer Management Table**:
- Search and filter bar (sticky top)
- Columns: Employer name, screening %, submission %, credit total, status
- Quick actions dropdown per row

**Questionnaire Builder**:
- Question library on left (w-80)
- Canvas in center for drag-and-drop
- Properties panel on right (w-80)
- Question preview mode

**Analytics Dashboard**:
- Large area charts for trends (h-64)
- Comparison tables
- Filter controls (date range, employer, target group)

### Employee Portal - Questionnaire Experience

**Mobile-First Design** (Critical):
- Single column layout always
- Large touch targets (min h-12)
- Minimal navigation chrome
- Auto-save functionality indicators

**AI-Assisted Features**:
- "Simplify this question" button inline (text-xs underline)
- Loading state during rephrasing
- Side-by-side comparison of original/simplified

**Completion Experience**:
- Celebration screen with clear next steps
- Summary of responses (collapsible sections)
- "Submit" button highly prominent (h-14 w-full text-lg)

---

## Animation & Interaction

**Minimal Animation Strategy**:
- Subtle transitions only (transition-colors duration-200)
- Loading spinners for async operations
- Smooth scrolling for navigation anchors
- No decorative animations

**Focus States**: 
- Prominent focus rings on all interactive elements
- Skip-to-content link for accessibility

---

## Responsive Breakpoints

- **Mobile**: base styles (single column, stacked navigation)
- **Tablet**: md: breakpoint (2-column forms, exposed sidebar)
- **Desktop**: lg: and xl: (multi-column dashboards, expanded tables)

---

## Images

**Hero Images**: Not applicable - this is a utility application, not a marketing site

**UI Images**:
- **Admin Dashboard**: No hero images; focus on data visualization
- **Employer Portal**: Optional small banner image area in dashboard header (h-32 w-full object-cover rounded-lg) for employer branding
- **Employee Questionnaire**: Clean, distraction-free - no images except employer logo
- **Marketing/Landing Page** (if needed): Hero section with image showing dashboard preview or happy employees (h-96 object-cover), features section with icon illustrations only

**Document Thumbnails**: Small preview icons for uploaded PDFs (h-16 w-16)

---

## Portal-Specific Layouts

**Employee Portal**:
- Centered form (max-w-2xl mx-auto)
- Minimal header with logo and progress
- Clean footer with support contact
- Full focus on questionnaire completion

**Employer Portal**:
- Sidebar + main content layout
- Dashboard landing: 4-column metrics, followed by recent activity table, credit forecast chart
- Employees table: Full-width with filters
- Reports section: Chart-heavy with export buttons

**Admin Portal**:
- Sidebar + main content layout  
- Employer list as primary view
- Multi-tab interface for employer detail (Overview, Questionnaire Config, Submissions, Billing)
- System settings in dedicated section