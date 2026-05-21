# Logistics ERP - Design Guidelines

## Design Approach

**System-Based Approach**: Material Design principles adapted for enterprise SaaS applications, drawing inspiration from Linear, Stripe Dashboard, and modern ERP interfaces. This is a data-intensive business application requiring clarity, efficiency, and professional polish over visual flair.

## Core Design Principles

1. **Information Hierarchy**: Dense data presentation without clutter
2. **Workflow Efficiency**: Minimize clicks, maximize context
3. **Visual Consistency**: Predictable patterns across all modules
4. **Spatial Economy**: Make every pixel work

---

## Typography System

**Primary Font**: Inter (via Google Fonts CDN)
**Secondary Font**: JetBrains Mono (for numbers, currency, codes)

**Hierarchy**:
- Page Headers: text-2xl font-semibold (24px)
- Section Headers: text-lg font-semibold (18px)
- Card/Module Titles: text-base font-medium (16px)
- Body Text: text-sm (14px)
- Table Data: text-sm (14px)
- Metadata/Labels: text-xs font-medium uppercase tracking-wide (12px)
- Currency/Numbers: Use JetBrains Mono, text-sm to text-lg depending on context

**Number Formatting**: Always display Oman currency as `XXX.XXX RO` (e.g., 120.500 RO) with JetBrains Mono font

---

## Layout System

**Spacing Units**: Tailwind units of 2, 4, 6, and 8 as primary spacing (rare use of 12, 16 for major sections)
- Component padding: p-4 or p-6
- Section gaps: gap-4 or gap-6
- Page margins: Container max-w-7xl with px-6
- Form field spacing: space-y-4

**Grid Patterns**:
- Dashboard metrics: grid-cols-4 (desktop), grid-cols-2 (tablet), grid-cols-1 (mobile)
- Data tables: Full-width with horizontal scroll on mobile
- Forms: Two-column layout (lg:grid-cols-2) with single column on mobile
- Module cards: grid-cols-3 (desktop), grid-cols-2 (tablet), grid-cols-1 (mobile)

---

## Component Library

### Navigation & Layout

**Top Navigation Bar**:
- Fixed header with company/shop selector dropdown on left
- User profile, notifications, and settings on right
- Height: h-16
- Border bottom: border-b

**Sidebar Navigation** (Desktop):
- Width: w-64
- Collapsible to icon-only (w-16)
- Grouped menu items by module (Inventory, Sales, Purchase, Accounting, HR, Projects)
- Active state with left border accent and background treatment
- Icons from Heroicons (outline for inactive, solid for active)

**Breadcrumb Navigation**:
- Below header for deep pages (e.g., Products > Edit Product > Serial Numbers)
- text-xs with slash separators

### Data Display

**Tables**:
- Zebra striping on rows (subtle alternating background)
- Sticky header row
- Right-aligned numeric columns (amounts, quantities)
- Action column (fixed right) with icon buttons
- Pagination at bottom-right
- Sortable columns with arrow indicators
- Row hover state

**Cards**:
- Rounded corners (rounded-lg)
- Border treatment with shadow-sm on hover
- Padding: p-6
- Header with title and optional action button
- Content area with appropriate spacing

**Metric Cards** (Dashboard):
- Large number display with JetBrains Mono
- Label below in text-xs
- Icon top-right
- Trend indicator (up/down arrow with percentage)

### Forms & Inputs

**Form Layout**:
- Labels above inputs (font-medium text-sm)
- Required field indicator (asterisk)
- Helper text below input (text-xs)
- Error states with red border and error message
- Two-column responsive grid for related fields

**Input Fields**:
- Standard height: h-10
- Border radius: rounded-md
- Border: border with focus ring
- Disabled state: opacity-60 with cursor-not-allowed

**Buttons**:
- Primary: Solid background, font-medium, px-6 py-2, rounded-md
- Secondary: Border outline, px-6 py-2, rounded-md
- Icon buttons: p-2, rounded-md
- Danger: For delete/destructive actions
- Button groups for multi-action scenarios (Save, Save & New, Cancel)

**Dropdowns/Selects**:
- Searchable for long lists (customers, products)
- Multi-select with tag display for categories
- Clear button for optional fields

### POS/Sales Interface

**Product Search & Selection**:
- Prominent search bar at top
- Barcode scanner integration indicator
- Product cards in scrollable grid
- Quick-add buttons with quantity steppers

**Cart/Invoice Panel**:
- Fixed right panel or bottom sheet on mobile
- Line items table with inline edit (price, discount)
- Live calculation display (Subtotal, VAT, Discount, Total)
- Large currency display using JetBrains Mono
- Customer info at top with quick-select/add
- Payment mode buttons at bottom (Cash, Card, Credit, Mixed)

**Transaction Controls**:
- Large action buttons: REPLACE, RETURN, RESET, PAY (h-12, full-width on mobile)
- Confirmation modals for critical actions

### Modals & Overlays

**Modal Sizes**:
- Small (max-w-md): Confirmations, simple forms
- Medium (max-w-2xl): Standard forms, details view
- Large (max-w-5xl): Complex forms with multiple sections
- Full-screen: POS interface on mobile

**Modal Structure**:
- Header with title and close button (h-16, border-b)
- Scrollable content area (p-6)
- Fixed footer with action buttons (border-t, p-4)

### Project Management UI

**Kanban Board**:
- Column-based layout (To Do, In Progress, Done)
- Draggable cards
- Card shows: Task title, assignee avatar, due date, priority indicator
- Add task button at column top

**Task Detail Panel**:
- Slide-in from right (w-96 desktop, full-screen mobile)
- Task info at top
- Tabbed sections: Details, Comments, Activity, Expenses
- Image upload area with thumbnail grid
- Comment thread with timestamps

---

## Navigation Patterns

**Multi-level Hierarchy Selector**:
- Dropdown cascade: Company > Shop > Branch
- Persistent in header
- Visual indicator of current context
- Switch between contexts without page reload where possible

**Module Quick Access**:
- Favorite/pinned modules in top nav
- Recent actions sidebar widget
- Global search (Cmd/Ctrl+K) for cross-module navigation

---

## Financial Display Standards

**Amount Display**:
- Always use format: `123.456 RO` with JetBrains Mono
- Right-align in tables and summaries
- Negative amounts with minus sign prefix
- Large totals: text-xl or text-2xl
- Inline amounts: text-base

**Bank/Cash Balance Cards**:
- Current balance prominent (text-3xl)
- Opening balance secondary (text-sm)
- Transaction history link

---

## Dashboard Layout

**Structure**:
- Metric cards row (4 columns): Total Sales, Total Purchases, Bank Balance, Pending Receivables
- Chart row: Sales trends (line chart) and top products (bar chart)
- Quick actions: Create Sale, Record Purchase, Add Product, View Reports
- Recent transactions table
- Alerts/Notifications panel (expiring products, low stock, pending approvals)

---

## Responsive Behavior

**Breakpoints**:
- Mobile: < 768px (single column, bottom sheets, hamburger menu)
- Tablet: 768px - 1024px (collapsed sidebar, 2-column grids)
- Desktop: > 1024px (full sidebar, multi-column layouts)

**Mobile Optimizations**:
- Bottom navigation for primary modules
- Floating action button for primary action
- Swipe gestures for common actions
- Simplified tables (card view with key info)

---

## Icons

**Library**: Heroicons (outline style primary, solid for active states)
**Usage**: 
- Navigation: w-5 h-5
- Buttons: w-4 h-4
- Large indicators: w-6 h-6

---

## Images

This ERP system does NOT use hero images or decorative photography. All visual elements are functional:
- Product thumbnails in inventory (square, rounded-md)
- Employee avatars (circular, w-8 h-8 or w-10 h-10)
- Company/shop logos (rectangular, max-h-10)
- Task/project attached images (grid display with lightbox)
- Document previews (PDF icons with filename)