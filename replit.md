# Logistics ERP System

## Overview

Logistics ERP is an integrated enterprise resource planning (ERP) system for Omani businesses. It offers comprehensive management of inventory, accounting, HR, payroll, and project management across multi-company and multi-branch structures. The system prioritizes strict financial controls, accurate accounting, and robust data integrity, with future ambitions for advanced CRM and detailed project profitability analysis.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Framework**: React with TypeScript
- **State Management**: TanStack React Query
- **UI Components**: shadcn/ui (Radix UI, Tailwind CSS)
- **Theming**: Custom design tokens, inspired by Material Design, Linear, Stripe Dashboard
- **Typography**: Inter (UI text), JetBrains Mono (numbers/currency)

### Technical Implementations
- **Backend**: Node.js with Express and TypeScript (ES modules)
- **API Pattern**: RESTful endpoints under `/api`
- **Validation**: Zod schemas
- **Build**: Vite (client), esbuild (server)

### Feature Specifications
- **Multi-company/Multi-branch**: Supports complex organizational structures with branch-level data segregation.
- **Role-Based Access Control (RBAC)**: Comprehensive company/shop/branch-based access control with super admin-only management and scope enforcement for other roles. All data tables include `companyId`, `shopId`, `branchId` for scope filtering.
- **Global Scope Filtering**: Allows admin users to filter all major data endpoints (products, customers, suppliers, sales, purchases, employees, projects) by selected shop/branch/warehouse via frontend headers. Non-admin users are restricted to their assigned scope.
- **Modular Design**: Organized into functional ERP modules including Organization, Inventory, Sales & Purchases, Finance, HR, Projects, and CRM.
- **Double-Entry Accounting**: Implements a comprehensive double-entry bookkeeping system with seeded Chart of Accounts and auto-generated journal entries.
- **Strict Financial Control**: Validates available funds across bank and petty cash before cash outflow.
- **Inventory Management**: Includes product, category, brand, supplier management, stock transfers, and serial number tracking.
- **Sales & Purchases**: Manages customer accounts, POS-style sales, purchase orders, returns, and payment tracking.
- **CRM Module**: Basic lead management (creation, conversion), deal pipeline tracking, and activity logging.
- **User Management**: Super admin-only module for managing system users, roles, and scope assignments.
- **Document & Compliance Management**: Supports employee and office document management with status workflows, audit trails, expiry tracking, and recurring compliance reminders.
- **Project Management**: Comprehensive project and task management, including client linking, budget tracking, and income/expense recording.
- **Smart Refund Logic**: Automatically offsets customer debt with return value before issuing cash refunds.
- **Supplier Credit Management**: Tracks supplier credits from purchase returns for application against new purchases.
- **Data Integrity**: Prevents duplicate entries and enhances bulk upload for existing items and serial numbers.
- **Global Date Validation Engine**: Implements strict date validation rules across all modules (transaction, expiry, manufacturing/issue, reminder dates) with centralized utilities, backend middleware, and frontend components.
- **ERP-Grade Supplier Accounting**: Ledger-driven supplier balance calculations based on double-entry principles, sourcing all data from immutable transaction tables for accuracy.
- **Global Error Handling**: Transparent backend error message display across all frontend modules, providing specific error details rather than generic messages.

### System Design Choices
- **Shared Types**: Schema definitions in `/shared` used by client and server.
- **Path Aliases**: `@/` (client), `@shared/` (shared modules).
- **Form Handling**: React Hook Form with Zod resolver.
- **API Requests**: Centralized helper for consistent API interaction.
- **Currency Format**: Oman Rial displayed as `XXX.XXX RO`.

## External Dependencies

### Database
- **PostgreSQL**: Primary database.
- **Drizzle ORM**: TypeScript ORM for PostgreSQL.
- **Node-postgres (pg)**: PostgreSQL client with connection pooling.
- **connect-pg-simple**: For session storage in PostgreSQL.

### UI Libraries
- **Radix UI**: Accessible component primitives.
- **shadcn/ui**: Pre-styled component system.
- **Lucide React**: Icon library.
- **Embla Carousel**: Carousel component.
- **React Day Picker**: Calendar/date picker.
- **cmdk**: Command palette component.
- **Vaul**: Drawer component.

### Data & Forms
- **TanStack React Query**: Asynchronous state management and caching.
- **React Hook Form**: Form state management.
- **Zod**: Schema validation.
- **drizzle-zod**: Zod schema generation from Drizzle tables.

### Utilities
- **date-fns**: Date manipulation.
- **class-variance-authority**: Component variant management.
- **clsx/tailwind-merge**: Utilities for conditional class composition.

### Build Tools
- **Vite**: Frontend development server and bundler.
- **esbuild**: Server bundling.
- **tsx**: TypeScript execution for development.

## Mobile App (React Native)

### Overview
The `mobile/` directory contains a React Native mobile app (JavaScript only) that syncs with the main Logistics ERP database.

### Features
- **Login Module**: JWT authentication with secure token storage
- **CRM Module**: Leads and deals management (managers only)
- **Task Module**: Manager assigns tasks to employees; employees update status with photo proof
- **Store/Inventory Module**: Search products, view quantity, serial numbers, and selling price

### Technology Stack
- **React Native** with Expo
- **React Navigation** for screen navigation
- **TanStack React Query** for data fetching
- **Zustand** for state management
- **Expo SecureStore** for secure token storage
- **Expo ImagePicker** for photo capture

### Running the Mobile App
1. Navigate to `mobile/` directory
2. Run `npm install`
3. Update `src/utils/constants.js` with your backend URL
4. Run `npm start` (or `expo start`)
5. Scan QR code with Expo Go app

### Mobile API Endpoints
- `POST /api/auth/mobile-login` - Mobile login (returns JWT in body)
- `POST /api/auth/refresh` - Refresh JWT token
- `GET /api/mobile/tasks` - Get tasks (filtered by role)
- `POST /api/mobile/tasks` - Create task (managers only)
- `PATCH /api/mobile/tasks/:id/status` - Update task status
- `POST /api/mobile/tasks/:id/proof` - Upload proof photo
- `GET /api/mobile/products/search` - Search products
- `GET /api/mobile/products/:id` - Get product details
- `GET /api/mobile/products/:id/serials` - Get serial numbers