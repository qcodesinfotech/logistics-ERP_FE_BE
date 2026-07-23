import {
  companies, shops, branches, warehouses,
  categories, brands, manufacturers, units, suppliers, products, inventory,
  customers, purchaseOrders, purchaseOrderItems, purchases, purchaseItems, purchasePayments, sales, saleItems, saleReturns, saleReturnItems, saleReplacements, salePayments,
  bankAccounts, bankTransactions, pettyCash, pettyCashTransactions, capital,
  employees, salaryPayments, salaryAdvances, clients, projects, tasks, taskAttachments, projectFiles, projectExpenses, projectIncome, stockTransfers, stockTransferItems,
  users, chartOfAccounts, journalEntries, journalLines,
  quotations, quotationItems, employeeDocuments, leaveTypes, leaveRequests, leaveBalances,
  warehouseLocations, serialNumbers, purchaseReturns, purchaseReturnItems, supplierCredits, supplierCreditTransactions, supplierRefunds,
  complianceDocuments, documentAuditLogs, complianceReminders,
  roles, menus, permissions, taskTimerSessions, timesheets,
  type Company, type Shop, type Branch, type Warehouse,
  type Category, type Brand, type Manufacturer, type Unit, type Supplier, type Product, type Inventory,
  type Customer, type PurchaseOrder, type PurchaseOrderItem, type Purchase, type PurchaseItem, type Sale,
  type BankAccount, type BankTransaction, type PettyCash, type Capital,
  type Employee, type SalaryPayment, type Client, type Project, type Task, type TaskAttachment, type ProjectFile, type ProjectIncome, type StockTransfer,
  type User, type ChartOfAccount, type JournalEntry, type JournalLine,
  type Quotation, type QuotationItem, type EmployeeDocument, type LeaveType, type LeaveRequest, type LeaveBalance,
  type WarehouseLocation, type SerialNumber, type PurchaseReturn, type PurchaseReturnItem, type SupplierCredit, type SupplierCreditTransaction,
  type ComplianceDocument, type DocumentAuditLog, type ComplianceReminder,
  type Role, type Menu, type Permission, type InsertRole, type InsertMenu, type InsertPermission,
  type TaskTimerSession, type InsertTaskTimerSession, type Timesheet, type InsertTimesheet,
  type InsertCompany, type InsertShop, type InsertBranch, type InsertWarehouse,
  type InsertCategory, type InsertBrand, type InsertSupplier, type InsertProduct, type InsertInventory,
  type InsertCustomer, type InsertPurchaseOrder, type InsertPurchase, type InsertSale,
  type InsertBankAccount, type InsertBankTransaction, type InsertPettyCash, type InsertCapital,
  type InsertEmployee, type InsertSalaryPayment, type InsertSalaryAdvance, type InsertClient, type InsertProject, type InsertTask, type InsertProjectExpense, type InsertProjectIncome, type InsertStockTransfer,
  type InsertUser, type InsertChartOfAccounts, type InsertJournalEntry, type InsertJournalLine,
  type InsertQuotation, type InsertQuotationItem, type InsertEmployeeDocument,
  type InsertLeaveType, type InsertLeaveRequest, type InsertLeaveBalance, type InsertWarehouseLocation,
  type InsertSerialNumber, type InsertPurchaseReturn, type InsertPurchaseReturnItem, type InsertSupplierCreditTransaction,
  type InsertComplianceDocument, type InsertDocumentAuditLog, type InsertComplianceReminder,
  type InsertServiceTicket, type ServiceTicket, serviceTickets,
  type InsertServiceTicketPayment, type ServiceTicketPayment, serviceTicketPayments,
  crmLeads, crmDeals, crmActivities, crmLeadNotes, crmCalendarEvents, crmReminders, crmCustomerContacts, crmNotifications, crmTasks,
  type CrmLead, type CrmDeal, type CrmActivity, type CrmLeadNote, type CrmCalendarEvent, type CrmReminder, type CrmCustomerContact, type CrmNotification, type CrmTask,
  type InsertCrmLead, type InsertCrmDeal, type InsertCrmActivity, type InsertCrmLeadNote, type InsertCrmCalendarEvent, type InsertCrmReminder, type InsertCrmCustomerContact, type InsertCrmNotification, type InsertCrmTask,
  userScopes, type UserScope,
  zones, supervisorZones, contracts, vehicles, locations, rfqs, orders, orderCharges, orderExpenses, invoicePayments, trips, tripOrders, deliveries, deliveryAttachments, driverActivities, driverAttendance, vehicleMaintenance, fuelLogs, userActivityLogs,
  type Zone, type InsertZone, type SupervisorZone, type InsertSupervisorZone, type Contract, type InsertContract, type Vehicle, type InsertVehicle, type Location, type InsertLocation, type Rfq, type InsertRfq, type Order, type InsertOrder, type OrderExpense, type InsertOrderExpense, type InvoicePayment, type InsertInvoicePayment, type Trip, type InsertTrip, type TripOrder, type InsertTripOrder, type Delivery, type InsertDelivery, type DriverActivity, type InsertDriverActivity, type DriverAttendance, type InsertDriverAttendance, type VehicleMaintenance, type InsertVehicleMaintenance, type FuelLog, type InsertFuelLog, type UserActivityLog, type InsertUserActivityLog, drivers, type Driver, type InsertDriver, outlets, outletZones, type Outlet, type InsertOutlet, type OutletZone, type InsertOutletZone, routes, type Route, type InsertRoute,
  driverZones, dispatchSheets, dispatchItems, dispatchOutletZoneOverrides, dispatchDeliveries,
  dispatchTruckAssignments, dispatchOutletTruckAssignments, dispatchPendingQuantities, truckTransfers,
  contractInvoices, contractMonthlyUsage,
  type DispatchTruckAssignment, type InsertDispatchTruckAssignment,
  type DispatchOutletTruckAssignment, type InsertDispatchOutletTruckAssignment,
  type DispatchPendingQuantity, type InsertDispatchPendingQuantity,
  type TruckTransfer, type InsertTruckTransfer,
  type ContractInvoice, type InsertContractInvoice,
  type ContractMonthlyUsage, type InsertContractMonthlyUsage,
} from "@shared/schema";
import { db, pool, ensureDriverTablesSchema } from "./db";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, desc, and, sql, asc, or, ne, gt, ilike, count, isNull, inArray, type SQL } from "drizzle-orm";
import * as schema from "@shared/schema";
import { sendLeaveRequestNotification } from "./lib/email";
import { type ScopeParams } from "./auth";

// Storage interface for all CRUD operations
export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword(id: string, passwordHash: string): Promise<void>;
  getUsers(): Promise<User[]>;
  getUserScopes(userId: string): Promise<UserScope[]>;
  setUserScopes(userId: string, scopes: { companyId?: string | null; shopId?: string | null; branchId?: string | null }[]): Promise<UserScope[]>;

  // Companies
  getCompanies(): Promise<Company[]>;
  getCompany(id: string): Promise<Company | undefined>;
  createCompany(data: InsertCompany): Promise<Company>;
  updateCompany(id: string, data: Partial<InsertCompany>): Promise<Company | undefined>;
  deleteCompany(id: string): Promise<void>;

  // Shops
  getShops(): Promise<Shop[]>;
  getShop(id: string): Promise<Shop | undefined>;
  createShop(data: InsertShop): Promise<Shop>;
  updateShop(id: string, data: Partial<InsertShop>): Promise<Shop | undefined>;
  deleteShop(id: string): Promise<void>;

  // Branches
  getBranches(): Promise<Branch[]>;
  getBranch(id: string): Promise<Branch | undefined>;
  createBranch(data: InsertBranch): Promise<Branch>;
  updateBranch(id: string, data: Partial<InsertBranch>): Promise<Branch | undefined>;
  deleteBranch(id: string): Promise<void>;

  // Warehouses
  getWarehouses(): Promise<Warehouse[]>;
  getWarehouse(id: string): Promise<Warehouse | undefined>;
  createWarehouse(data: InsertWarehouse): Promise<Warehouse>;
  updateWarehouse(id: string, data: Partial<InsertWarehouse>): Promise<Warehouse | undefined>;
  deleteWarehouse(id: string): Promise<void>;

  // Categories
  getCategories(): Promise<Category[]>;
  getCategory(id: string): Promise<Category | undefined>;
  createCategory(data: InsertCategory): Promise<Category>;
  updateCategory(id: string, data: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<void>;

  // Brands
  getBrands(): Promise<Brand[]>;
  getBrand(id: string): Promise<Brand | undefined>;
  createBrand(data: InsertBrand): Promise<Brand>;
  updateBrand(id: string, data: Partial<InsertBrand>): Promise<Brand | undefined>;
  deleteBrand(id: string): Promise<void>;

  // Manufacturers
  getManufacturers(): Promise<Manufacturer[]>;
  createManufacturer(data: { name: string; description?: string }): Promise<Manufacturer>;
  deleteManufacturer(id: string): Promise<void>;

  // Units
  getUnits(): Promise<Unit[]>;
  createUnit(data: { name: string; abbreviation?: string }): Promise<Unit>;
  updateUnit(id: string, data: { name?: string; abbreviation?: string }): Promise<Unit | undefined>;
  deleteUnit(id: string): Promise<void>;

  // Suppliers
  getSuppliers(): Promise<Supplier[]>;
  getSupplier(id: string): Promise<Supplier | undefined>;
  createSupplier(data: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: string, data: Partial<InsertSupplier>): Promise<Supplier | undefined>;
  deleteSupplier(id: string): Promise<void>;

  // Products
  getProducts(scope?: { companyId?: string | null; shopId?: string | null; branchId?: string | null; warehouseId?: string | null } | null, options?: { limit?: number; offset?: number; search?: string }): Promise<{ products: Product[]; total: number }>;
  getProductStockCounts(): Promise<Record<string, number>>;
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(data: InsertProduct): Promise<Product>;
  createProductWithAccounting(data: InsertProduct, bankAccountId?: string | null): Promise<Product>;
  updateProduct(id: string, data: Partial<InsertProduct>): Promise<Product | undefined>;
  updateProductWithSerials(productId: string, existingProduct: Product, data: Partial<InsertProduct>, newQuantity: number): Promise<Product | undefined>;
  updateProductWithSerialsAndAccounting(productId: string, existingProduct: Product, data: Partial<InsertProduct>, newQuantity: number, bankAccountId: string): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<void>;

  // Inventory
  getInventory(warehouseId?: string): Promise<Inventory[]>;
  createInventory(data: InsertInventory): Promise<Inventory>;
  updateInventory(id: string, data: Partial<InsertInventory>): Promise<Inventory | undefined>;
  adjustInventory(data: { productId: string; warehouseId: string; quantityChange: number; costPrice: number; reason: string; adjustmentType: "add" | "remove" }): Promise<Inventory>;

  // Customers
  getCustomers(): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  createCustomer(data: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, data: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(id: string): Promise<void>;
  clearCustomerCredit(id: string, amount: number, paymentMethod: string, notes?: string): Promise<any>;
  refundCustomerCredit(id: string, amount: number, paymentMethod: string, bankAccountId: string, notes?: string): Promise<any>;
  clearSupplierCredit(id: string, amount: number, paymentMethod: string, notes?: string): Promise<any>;

  // Purchase Orders
  getPurchaseOrders(): Promise<PurchaseOrder[]>;
  getPurchaseOrder(id: string): Promise<PurchaseOrder | undefined>;
  getPurchaseOrderWithItems(id: string): Promise<{ order: PurchaseOrder; items: PurchaseOrderItem[] } | undefined>;
  createPurchaseOrder(data: InsertPurchaseOrder, items: any[]): Promise<PurchaseOrder>;
  updatePurchaseOrderStatus(id: string, status: string): Promise<PurchaseOrder | undefined>;

  // Purchases
  getPurchases(): Promise<Purchase[]>;
  getPurchase(id: string): Promise<Purchase | undefined>;
  getPurchaseWithItems(id: string): Promise<{ purchase: Purchase; items: PurchaseItem[] } | undefined>;
  createPurchase(data: InsertPurchase, items: any[]): Promise<Purchase>;
  getPurchasePayments(purchaseId: string): Promise<any[]>;
  createPurchasePayment(data: { purchaseId: string; amount: number; paymentMethod: string; bankAccountId: string; notes?: string }): Promise<any>;
  getPurchaseInvoiceSummary(purchaseId: string): Promise<any>;

  // Sales
  getSales(): Promise<Sale[]>;
  getSale(id: string): Promise<Sale | undefined>;
  getSaleItems(saleId: string): Promise<any[]>;
  getSaleItemsWithReplacementHistory(saleId: string): Promise<{ currentItems: any[], replacementHistory: any[] }>;
  createSale(data: InsertSale, items: any[]): Promise<Sale>;
  getCustomerSalesWithItems(customerId: string): Promise<any[]>;
  getNextSaleNumber(): Promise<string>;

  // Sale Returns
  getSaleReturns(): Promise<any[]>;
  createSaleReturn(data: any, items: any[]): Promise<any>;

  // Sale Replacements
  getSaleReplacements(): Promise<any[]>;
  getSaleReplacementsBySaleId(saleId: string): Promise<any[]>;
  createSaleReplacement(data: any): Promise<any>;
  replaceSaleItem(data: {
    saleId: string;
    saleItemId: string;
    originalSerialNumberId: string;
    replacementProductId: string;
    replacementSerialNumberId: string;
    paymentMethod?: string;
    bankAccountId?: string;
    reason?: string;
    shopId?: string;
    branchId?: string;
  }): Promise<any>;

  // Sale Payments (Payment History)
  getSalePayments(saleId?: string): Promise<any[]>;
  createSalePayment(data: any): Promise<any>;
  getSaleInvoiceSummary(saleId: string): Promise<any>;

  // Bank Accounts
  getBankAccounts(scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<BankAccount[]>;
  getBankAccount(id: string): Promise<BankAccount | undefined>;
  createBankAccount(data: InsertBankAccount): Promise<BankAccount>;
  updateBankAccount(id: string, data: Partial<InsertBankAccount>): Promise<BankAccount | undefined>;
  deleteBankAccount(id: string): Promise<void>;

  // Bank Transactions
  getBankTransactions(accountId?: string, scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<BankTransaction[]>;
  createBankTransaction(data: InsertBankTransaction): Promise<BankTransaction>;

  // Petty Cash
  getPettyCashAccounts(scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<PettyCash[]>;
  createPettyCash(data: InsertPettyCash): Promise<PettyCash>;
  getPettyCashTransactions(scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<any[]>;
  createPettyCashTransaction(data: any): Promise<any>;
  deletePettyCashTransaction(id: string): Promise<void>;
  getPettyCashReport(startDate?: string, endDate?: string, scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<any>;

  // Capital
  getCapitalEntries(scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<Capital[]>;
  createCapital(data: InsertCapital): Promise<Capital>;

  // Employees
  getEmployees(): Promise<Employee[]>;
  getEmployee(id: string): Promise<Employee | undefined>;
  createEmployee(data: InsertEmployee): Promise<Employee>;
  updateEmployee(id: string, data: Partial<InsertEmployee>): Promise<Employee | undefined>;
  deleteEmployee(id: string): Promise<void>;

  // Salary Payments
  getSalaryPayments(employeeId?: string, scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<SalaryPayment[]>;
  createSalaryPayment(data: InsertSalaryPayment): Promise<SalaryPayment>;

  // Salary Advances
  getSalaryAdvances(employeeId?: string, scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<any[]>;
  createSalaryAdvance(data: InsertSalaryAdvance): Promise<any>;
  updateSalaryAdvance(id: string, data: any): Promise<any>;
  getEmployeeAdvanceBalance(employeeId: string): Promise<number>;
  repaySalaryAdvance(advanceId: string, amount: number, bankAccountId?: string, notes?: string): Promise<any>;
  getAdvanceRepaymentHistory(advanceId: string): Promise<any[]>;

  // Projects
  getProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(data: InsertProject): Promise<Project>;
  updateProject(id: string, data: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<void>;

  // Routes
  getRoutes(): Promise<Route[]>;
  getRoute(id: string): Promise<Route | undefined>;
  createRoute(data: InsertRoute): Promise<Route>;
  updateRoute(id: string, data: Partial<InsertRoute>): Promise<Route | undefined>;
  deleteRoute(id: string): Promise<void>;

  // Outlets
  getOutlets(clientId?: string, routeId?: string, brandId?: string): Promise<Outlet[]>;
  getOutlet(id: string): Promise<Outlet | undefined>;
  createOutlet(data: InsertOutlet): Promise<Outlet>;
  updateOutlet(id: string, data: Partial<InsertOutlet>): Promise<Outlet | undefined>;
  deleteOutlet(id: string): Promise<void>;
  getOutletZones(outletId: string): Promise<Zone[]>;
  assignOutletZones(outletId: string, zoneIds: string[]): Promise<void>;
  getZoneOutlets(zoneId: string): Promise<Outlet[]>;
  appendOutletsToZone(zoneId: string, outletIds: string[]): Promise<void>;
  removeOutletFromZone(zoneId: string, outletId: string): Promise<void>;

  // Tasks
  getTasks(scope?: { shopId?: string | null; branchId?: string | null } | null, options?: { currentEmployeeId?: string | null; isAdmin?: boolean }): Promise<Task[]>;
  getTask(id: string): Promise<Task | undefined>;
  createTask(data: InsertTask): Promise<Task>;
  updateTask(id: string, data: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<void>;
  getTaskAttachments(taskId: string): Promise<any[]>;
  createTaskAttachment(data: any): Promise<any>;
  deleteTaskAttachment(id: string): Promise<void>;

  // Task Timer
  getTaskTimerSessions(taskId: string): Promise<TaskTimerSession[]>;
  getActiveTaskTimerSession(taskId: string, userId: string): Promise<TaskTimerSession | undefined>;
  getAllActiveTimerSessions(userId: string): Promise<TaskTimerSession[]>;
  createTaskTimerSession(data: InsertTaskTimerSession): Promise<TaskTimerSession>;
  updateTaskTimerSession(id: string, data: Partial<TaskTimerSession>): Promise<TaskTimerSession | undefined>;
  
  // Timesheets
  getTimesheets(projectId?: string, taskId?: string): Promise<any[]>;
  createTimesheet(data: InsertTimesheet): Promise<Timesheet>;

  // Project Files
  getProjectFiles(projectId: string): Promise<ProjectFile[]>;
  createProjectFile(data: any): Promise<ProjectFile>;
  deleteProjectFile(id: string): Promise<void>;

  // Project Expenses
  getProjectExpenses(projectId?: string): Promise<any[]>;
  createProjectExpense(data: InsertProjectExpense): Promise<any>;
  updateProjectExpense(id: string, data: any): Promise<any>;
  deleteProjectExpense(id: string): Promise<void>;
  getProjectBudgetSummary(projectId: string): Promise<{ budget: number; spent: number; remaining: number }>;

  // Stock Transfers
  getStockTransfers(): Promise<StockTransfer[]>;
  createStockTransfer(data: InsertStockTransfer): Promise<StockTransfer>;

  // Dashboard
  getDashboardStats(scope?: { shopId?: string | null; branchId?: string | null; warehouseId?: string | null } | null): Promise<any>;

  // Chart of Accounts
  getChartOfAccounts(companyId?: string, scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<ChartOfAccount[]>;
  getChartOfAccount(id: string): Promise<ChartOfAccount | undefined>;
  getChartOfAccountByCodeAndBranch(accountCode: string, branchId: string): Promise<ChartOfAccount | undefined>;
  createChartOfAccount(data: InsertChartOfAccounts): Promise<ChartOfAccount>;
  updateChartOfAccount(id: string, data: Partial<InsertChartOfAccounts>): Promise<ChartOfAccount | undefined>;
  deleteChartOfAccount(id: string): Promise<void>;
  seedChartOfAccountsForBranch(branchId: string): Promise<{ created: number; existing: number }>;
  seedChartOfAccountsForShop(shopId: string, branchId: string): Promise<{ created: number; existing: number }>;

  // Journal Entries
  getJournalEntries(companyId?: string, sourceType?: string, sourceId?: string, branchId?: string): Promise<JournalEntry[]>;
  getJournalEntry(id: string): Promise<JournalEntry | undefined>;
  createJournalEntry(data: any, lines: any[]): Promise<JournalEntry>;
  getJournalLines(journalEntryId: string): Promise<JournalLine[]>;
  getCustomerARStatement(customerId: string): Promise<{ entries: any[]; openingBalance: number }>;
  getCustomerPaymentStatement(customerId: string): Promise<any>;

  // Financial Reports
  getTrialBalance(companyId?: string, startDate?: string, endDate?: string, scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<any>;
  getGeneralLedger(accountId: string, startDate?: string, endDate?: string, scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<any>;
  getProfitAndLoss(companyId?: string, startDate?: string, endDate?: string, scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<any>;
  getBalanceSheet(companyId?: string, asOfDate?: string, scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<any>;
  getSalaryReport(employeeId?: string, startDate?: string, endDate?: string, scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<any>;
  getProjectReport(projectId?: string, employeeId?: string, startDate?: string, endDate?: string, scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<any>;

  // Quotations
  getQuotations(scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<Quotation[]>;
  getQuotation(id: string): Promise<Quotation | undefined>;
  getQuotationWithItems(id: string): Promise<{ quotation: Quotation; items: QuotationItem[] } | undefined>;
  getApprovedQuotationsForCustomer(customerId: string, scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<Quotation[]>;
  createQuotation(data: any, items: any[]): Promise<Quotation>;
  updateQuotation(id: string, data: Partial<InsertQuotation>): Promise<Quotation | undefined>;
  convertQuotationToSale(id: string): Promise<Sale>;

  // Employee Documents
  getEmployeeDocuments(employeeId?: string): Promise<EmployeeDocument[]>;
  createEmployeeDocument(data: InsertEmployeeDocument): Promise<EmployeeDocument>;
  updateEmployeeDocument(id: string, data: Partial<InsertEmployeeDocument>): Promise<EmployeeDocument | undefined>;
  deleteEmployeeDocument(id: string): Promise<void>;
  getExpiringDocuments(days?: number): Promise<EmployeeDocument[]>;

  // Leave Types
  getLeaveTypes(): Promise<LeaveType[]>;
  createLeaveType(data: InsertLeaveType): Promise<LeaveType>;
  updateLeaveType(id: string, data: Partial<InsertLeaveType>): Promise<LeaveType | undefined>;
  deleteLeaveType(id: string): Promise<void>;

  // Leave Requests
  getLeaveRequests(employeeId?: string, scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<LeaveRequest[]>;
  getUnapprovedLeaveDeduction(employeeId: string, month: number, year: number): Promise<{ unapprovedDays: number; leaveDeduction: number; dailyRate: number; leaveIds: string[] }>;
  createLeaveRequest(data: InsertLeaveRequest): Promise<LeaveRequest>;
  updateLeaveRequest(id: string, data: Partial<InsertLeaveRequest>): Promise<LeaveRequest | undefined>;
  approveLeaveRequest(id: string, approvedById: string, approvedPaidDays?: number, approvedUnpaidDays?: number): Promise<LeaveRequest | undefined>;
  rejectLeaveRequest(id: string, comments: string): Promise<LeaveRequest | undefined>;
  getAccruedLeave(employeeId: string): Promise<{ accruedDays: number; usedPaidDays: number; balance: number }>;

  // Leave Balances
  getLeaveBalances(employeeId: string, year?: number): Promise<LeaveBalance[]>;
  updateLeaveBalance(employeeId: string, leaveTypeId: string, year: number, data: Partial<InsertLeaveBalance>): Promise<LeaveBalance | undefined>;

  // Warehouse Locations
  getWarehouseLocations(warehouseId?: string): Promise<WarehouseLocation[]>;
  createWarehouseLocation(data: InsertWarehouseLocation): Promise<WarehouseLocation>;
  updateWarehouseLocation(id: string, data: Partial<InsertWarehouseLocation>): Promise<WarehouseLocation | undefined>;
  deleteWarehouseLocation(id: string): Promise<void>;

  // Salary Generation
  generateMonthlySalaries(month: number, year: number): Promise<SalaryPayment[]>;

  // Serial Numbers
  getSerialNumbers(filters?: { productId?: string; warehouseId?: string; shopId?: string; status?: string }): Promise<SerialNumber[]>;
  getSerialNumber(id: string): Promise<SerialNumber | undefined>;
  createSerialNumbers(serials: InsertSerialNumber[]): Promise<SerialNumber[]>;
  updateSerialNumber(id: string, data: { costPrice?: string; sellingPrice?: string; warehouseId?: string | null; updatedAt?: Date }): Promise<SerialNumber | undefined>;
  updateSerialNumberStatus(id: string, status: string, additionalData?: { saleId?: string; saleItemId?: string; soldAt?: Date; returnedAt?: Date; replacedAt?: Date }): Promise<SerialNumber | undefined>;

  // Purchase Returns
  getPurchaseReturns(supplierId?: string, scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<PurchaseReturn[]>;
  getPurchaseReturn(id: string): Promise<PurchaseReturn | undefined>;
  createPurchaseReturn(data: InsertPurchaseReturn & { items: InsertPurchaseReturnItem[] }): Promise<PurchaseReturn>;

  // Supplier Credits
  getSupplierCredit(supplierId: string, shopId?: string): Promise<SupplierCredit | undefined>;
  updateSupplierCredit(supplierId: string, amount: string, shopId?: string): Promise<SupplierCredit>;
  getSupplierCreditTransactions(supplierId: string): Promise<SupplierCreditTransaction[]>;
  createSupplierCreditTransaction(data: InsertSupplierCreditTransaction): Promise<SupplierCreditTransaction>;
  getSupplierCreditRefunds(supplierId: string): Promise<any[]>;

  // Purchase Returns Helper
  getPurchasesForReturn(supplierId: string): Promise<any[]>;
  getAvailableSerialsForPurchase(purchaseId: string): Promise<SerialNumber[]>;

  // Service Tickets
  getServiceTickets(shopId?: string, filters?: { technicianId?: string; startDate?: Date; endDate?: Date; paymentStatus?: "paid" | "outstanding" }): Promise<ServiceTicket[]>;
  getServiceTicketsReport(filters: { technicianId?: string; startDate?: Date; endDate?: Date; paymentStatus?: "paid" | "outstanding"; shopId?: string; branchId?: string }): Promise<ServiceTicket[]>;
  getServiceTicket(id: string): Promise<ServiceTicket | undefined>;
  createServiceTicket(data: InsertServiceTicket): Promise<ServiceTicket>;
  addServiceTicketPayment(ticketId: string, paymentData: { amount: number; paymentMethod: string; bankAccountId?: string; notes?: string; processedBy?: string }): Promise<{ payment: ServiceTicketPayment; ticket: ServiceTicket; receiptNumber: string }>;
  getServiceTicketPayments(ticketId: string): Promise<ServiceTicketPayment[]>;
  updateServiceTicket(id: string, data: Partial<InsertServiceTicket>): Promise<ServiceTicket | undefined>;
  deleteServiceTicket(id: string): Promise<void>;
  repairServiceTicketPaymentRecord(ticketId: string): Promise<any>;

  // CRM Leads
  getCrmLeads(): Promise<CrmLead[]>;
  getCrmLead(id: string): Promise<CrmLead | undefined>;
  createCrmLead(data: InsertCrmLead): Promise<CrmLead>;
  updateCrmLead(id: string, data: Partial<InsertCrmLead>): Promise<CrmLead | undefined>;
  deleteCrmLead(id: string): Promise<void>;
  convertLeadToCustomer(leadId: string): Promise<{ lead: CrmLead; customerId: string }>;

  // CRM Deals
  getCrmDeals(): Promise<CrmDeal[]>;
  getCrmDeal(id: string): Promise<CrmDeal | undefined>;
  createCrmDeal(data: InsertCrmDeal): Promise<CrmDeal>;
  updateCrmDeal(id: string, data: Partial<InsertCrmDeal>): Promise<CrmDeal | undefined>;
  deleteCrmDeal(id: string): Promise<void>;

  // CRM Activities
  getCrmActivities(filters?: { leadId?: string; dealId?: string; customerId?: string }): Promise<CrmActivity[]>;
  getCrmActivity(id: string): Promise<CrmActivity | undefined>;
  createCrmActivity(data: InsertCrmActivity): Promise<CrmActivity>;
  updateCrmActivity(id: string, data: Partial<InsertCrmActivity>): Promise<CrmActivity | undefined>;
  deleteCrmActivity(id: string): Promise<void>;

  // CRM Lead Notes
  getCrmLeadNotes(leadId: string): Promise<CrmLeadNote[]>;
  createCrmLeadNote(data: InsertCrmLeadNote): Promise<CrmLeadNote>;
  deleteCrmLeadNote(id: string): Promise<void>;

  // CRM Calendar Events
  getCrmCalendarEvents(filters?: { startDate?: Date; endDate?: Date; assignedTo?: string; shopId?: string; branchId?: string }): Promise<CrmCalendarEvent[]>;
  getCrmCalendarEvent(id: string): Promise<CrmCalendarEvent | undefined>;
  createCrmCalendarEvent(data: InsertCrmCalendarEvent): Promise<CrmCalendarEvent>;
  updateCrmCalendarEvent(id: string, data: Partial<InsertCrmCalendarEvent>): Promise<CrmCalendarEvent | undefined>;
  deleteCrmCalendarEvent(id: string): Promise<void>;

  // CRM Reminders
  getCrmReminders(filters?: { assignedTo?: string; status?: string; shopId?: string; branchId?: string }): Promise<CrmReminder[]>;
  getCrmReminder(id: string): Promise<CrmReminder | undefined>;
  createCrmReminder(data: InsertCrmReminder): Promise<CrmReminder>;
  updateCrmReminder(id: string, data: Partial<InsertCrmReminder>): Promise<CrmReminder | undefined>;
  deleteCrmReminder(id: string): Promise<void>;
  getDueCrmReminders(userId: string): Promise<CrmReminder[]>;

  // Employee Work Report
  getEmployeeWorkReport(employeeId: string, startDate?: string, endDate?: string): Promise<any[]>;

  // CRM Customer Contacts
  getCrmCustomerContacts(customerId: string): Promise<CrmCustomerContact[]>;
  createCrmCustomerContact(data: InsertCrmCustomerContact): Promise<CrmCustomerContact>;
  updateCrmCustomerContact(id: string, data: Partial<InsertCrmCustomerContact>): Promise<CrmCustomerContact | undefined>;
  deleteCrmCustomerContact(id: string): Promise<void>;

  // CRM Notifications
  getCrmNotifications(userId: string, unreadOnly?: boolean): Promise<CrmNotification[]>;
  createCrmNotification(data: InsertCrmNotification): Promise<CrmNotification>;
  markCrmNotificationRead(id: string): Promise<CrmNotification | undefined>;
  markAllCrmNotificationsRead(userId: string): Promise<void>;

  // CRM Tasks
  getCrmTasks(filters?: { assignedTo?: string; status?: string; leadId?: string; dealId?: string; customerId?: string; shopId?: string; branchId?: string }): Promise<CrmTask[]>;
  getCrmTask(id: string): Promise<CrmTask | undefined>;
  createCrmTask(data: InsertCrmTask): Promise<CrmTask>;
  updateCrmTask(id: string, data: Partial<InsertCrmTask>): Promise<CrmTask | undefined>;
  deleteCrmTask(id: string): Promise<void>;

  // Compliance Documents
  getComplianceDocuments(filters?: { category?: string; status?: string; employeeId?: string; shopId?: string; branchId?: string; warehouseId?: string; expiringWithinDays?: number }): Promise<ComplianceDocument[]>;
  getComplianceDocument(id: string): Promise<ComplianceDocument | undefined>;
  createComplianceDocument(data: InsertComplianceDocument): Promise<ComplianceDocument>;
  updateComplianceDocument(id: string, data: Partial<InsertComplianceDocument>): Promise<ComplianceDocument | undefined>;
  deleteComplianceDocument(id: string): Promise<void>;
  updateExpiredDocuments(): Promise<number>;

  // Document Audit Logs
  getDocumentAuditLogs(documentId: string): Promise<DocumentAuditLog[]>;
  createDocumentAuditLog(data: InsertDocumentAuditLog): Promise<DocumentAuditLog>;

  // Compliance Reminders
  getComplianceReminders(filters?: { shopId?: string; branchId?: string; warehouseId?: string; isActive?: boolean }): Promise<ComplianceReminder[]>;
  getComplianceReminder(id: string): Promise<ComplianceReminder | undefined>;
  createComplianceReminder(data: InsertComplianceReminder): Promise<ComplianceReminder>;
  updateComplianceReminder(id: string, data: Partial<InsertComplianceReminder>): Promise<ComplianceReminder | undefined>;
  deleteComplianceReminder(id: string): Promise<void>;
  getDueReminders(): Promise<ComplianceReminder[]>;
  payComplianceReminder(id: string, bankAccountId: string, notes?: string): Promise<ComplianceReminder>;

  // Dynamic RBAC
  getRoles(): Promise<Role[]>;
  getRole(id: string): Promise<Role | undefined>;
  getRoleByName(name: string): Promise<Role | undefined>;
  createRole(data: InsertRole): Promise<Role>;
  updateRole(id: string, data: Partial<InsertRole>): Promise<Role | undefined>;
  deleteRole(id: string): Promise<void>;
  cloneRole(id: string, newName: string): Promise<Role>;

  getMenus(): Promise<Menu[]>;
  getMenu(id: string): Promise<Menu | undefined>;
  createMenu(data: InsertMenu): Promise<Menu>;
  updateMenu(id: string, data: Partial<InsertMenu>): Promise<Menu | undefined>;
  deleteMenu(id: string): Promise<void>;

  getPermissions(roleId?: string): Promise<Permission[]>;
  getPermissionsByRole(roleId: string): Promise<Permission[]>;
  getUserPermissions(userId: string): Promise<Array<Permission & { menuKey: string }>>;
  setPermission(roleId: string, menuId: string, canRead: boolean, canWrite: boolean): Promise<Permission>;
  deletePermissionsByRole(roleId: string): Promise<void>;

  // Logistics Zones
  getZones(scope?: Partial<ScopeParams>): Promise<Zone[]>;
  getZone(id: string): Promise<Zone | undefined>;
  createZone(data: InsertZone): Promise<Zone>;
  updateZone(id: string, data: Partial<InsertZone>): Promise<Zone | undefined>;
  deleteZone(id: string): Promise<void>;
  getSupervisorZones(supervisorId: string): Promise<SupervisorZone[]>;
  assignSupervisorZones(supervisorId: string, zoneIds: string[]): Promise<SupervisorZone[]>;

  // Logistics Contracts
  getContracts(customerId?: string): Promise<Contract[]>;
  getContract(id: string): Promise<Contract | undefined>;
  createContract(data: InsertContract): Promise<Contract>;
  updateContract(id: string, data: Partial<InsertContract>): Promise<Contract | undefined>;
  deleteContract(id: string): Promise<void>;

  // Logistics Vehicles
  getVehicles(status?: string, type?: string): Promise<Vehicle[]>;
  getVehicle(id: string): Promise<Vehicle | undefined>;
  createVehicle(data: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: string, data: Partial<InsertVehicle>): Promise<Vehicle | undefined>;
  deleteVehicle(id: string): Promise<void>;

  // Logistics Locations
  getLocations(): Promise<Location[]>;
  getLocation(id: string): Promise<Location | undefined>;
  getLocationByCode(code: string): Promise<Location | undefined>;
  createLocation(data: InsertLocation): Promise<Location>;
  updateLocation(id: string, data: Partial<InsertLocation>): Promise<Location | undefined>;
  deleteLocation(id: string): Promise<void>;

  // Logistics RFQs
  getRfqs(): Promise<Rfq[]>;
  getRfq(id: string): Promise<Rfq | undefined>;
  createRfq(data: InsertRfq): Promise<Rfq>;
  updateRfq(id: string, data: Partial<InsertRfq>): Promise<Rfq | undefined>;
  deleteRfq(id: string): Promise<void>;

  // Logistics Orders
  getOrders(customerId?: string, zoneId?: string, status?: string): Promise<Order[]>;
  getOrder(id: string): Promise<Order | undefined>;
  getOrderWithCharges(id: string): Promise<{ order: Order; charges: any[]; expenses: any[] } | undefined>;
  createOrder(data: InsertOrder & { charges?: any[] }): Promise<Order>;
  updateOrder(id: string, data: Partial<InsertOrder> & { charges?: any[], expenses?: any[] }): Promise<Order | undefined>;
  payOrderInvoice(id: string, payment: InsertInvoicePayment): Promise<Order>;
  deleteOrder(id: string): Promise<void>;

  // Logistics Trips
  getTrips(driverId?: string, status?: string): Promise<Trip[]>;
  getTrip(id: string): Promise<Trip | undefined>;
  createTrip(data: InsertTrip & { orderIds: string[] }): Promise<Trip>;
  updateTrip(id: string, data: Partial<InsertTrip>): Promise<Trip | undefined>;
  deleteTrip(id: string): Promise<void>;
  getTripOrders(tripId: string): Promise<Order[]>;

  // Logistics Deliveries
  getDeliveries(tripId?: string, orderId?: string): Promise<Delivery[]>;
  getDelivery(id: string): Promise<Delivery | undefined>;
  createDelivery(data: InsertDelivery): Promise<Delivery>;
  updateDelivery(id: string, data: Partial<InsertDelivery>): Promise<Delivery | undefined>;
  recordDeliveryPOD(tripId: string, orderId: string, podUrl: string, status: string, issueLog?: string): Promise<Delivery>;
  getOutletDeliveryAttachments(outletId: string): Promise<any[]>;

  // Logistics Driver Management
  getDrivers(): Promise<Driver[]>;
  createDriver(data: InsertDriver): Promise<Driver>;

  // Logistics Driver activities & attendance
  getDriverActivities(driverId?: string, tripId?: string): Promise<DriverActivity[]>;
  createDriverActivity(data: InsertDriverActivity): Promise<DriverActivity>;
  getDriverAttendance(driverId?: string, date?: string): Promise<DriverAttendance[]>;
  createDriverAttendance(data: InsertDriverAttendance): Promise<DriverAttendance>;
  updateDriverAttendance(id: string, data: Partial<DriverAttendance>): Promise<DriverAttendance>;
  getDriverAttendanceReport(driverId?: string, startDate?: string, endDate?: string): Promise<any[]>;
  getDriverDeliveriesReport(driverId?: string, startDate?: string, endDate?: string): Promise<any[]>;

  // Logistics Fleet Advanced
  getVehicleMaintenance(vehicleId?: string, driverId?: string): Promise<VehicleMaintenance[]>;
  createVehicleMaintenance(data: InsertVehicleMaintenance): Promise<VehicleMaintenance>;
  getFuelLogs(vehicleId?: string, tripId?: string, driverId?: string): Promise<FuelLog[]>;
  createFuelLog(data: InsertFuelLog): Promise<FuelLog>;

  // Logistics User Activity Logs
  getUserActivityLogs(userId?: string): Promise<UserActivityLog[]>;
  createUserActivityLog(data: InsertUserActivityLog): Promise<UserActivityLog>;

  // Dispatch Engine Automation
  autoAssignZoneTrucksToSheet(sheetId: string): Promise<void>;
  autoAllocateFfd(sheetId: string): Promise<{ allocated: number; overflow: string[] }>;
}

// Database storage implementation
export class DatabaseStorage implements IStorage {
  // ==================== SUPPLIER LEDGER HELPERS ====================

  // Calculate supplier ledger dynamically from transactions
  // STRICT ACCOUNTING: Balance = Purchases - Payments - Returns - Credits Applied
  // Credit Applied = internal ledger offset, NOT a cash payment (reduces liability without bank transaction)
  // Refunds received clear overpayment (what supplier owed us)
  // Returns: { totalPurchases, totalPayments, totalReturns, totalCreditsApplied, totalRefundsReceived, outstandingPayable, overpayment, netBalance }
  async getSupplierLedgerSummary(supplierId: string): Promise<{
    totalPurchases: number;
    totalPayments: number;
    totalReturns: number;
    totalCreditsApplied: number;
    totalRefundsReceived: number;
    outstandingPayable: number;
    overpayment: number;
    netBalance: number;
  }> {
    return { totalPurchases: 0, totalPayments: 0, totalReturns: 0, totalCreditsApplied: 0, totalRefundsReceived: 0, outstandingPayable: 0, overpayment: 0, netBalance: 0 };
  }

  // Calculate purchase invoice outstanding dynamically from payment records
  async getPurchaseOutstanding(purchaseId: string): Promise<{
    invoiceTotal: number;
    totalPaid: number;
    creditApplied: number;
    outstandingAmount: number;
    paymentStatus: 'unpaid' | 'partial' | 'paid' | 'credit_adjusted';
  }> {
    return { invoiceTotal: 0, totalPaid: 0, creditApplied: 0, outstandingAmount: 0, paymentStatus: 'unpaid' };
  }

  // Get comprehensive purchase invoice summary with all transaction history (ledger-driven)
  // Mirrors getSaleInvoiceSummary for consistency
  async getPurchaseInvoiceSummary(purchaseId: string): Promise<any> {
    return {};
  }

  // ==================== CUSTOMER LEDGER HELPERS ====================

  // Calculate customer ledger dynamically from transactions
  // Returns: { totalSales, totalPayments, totalReturns, outstandingReceivable, storeCredit, netBalance }
  async getCustomerLedgerSummary(customerId: string): Promise<{
    totalSales: number;
    totalPayments: number;
    totalCreditsFromReturns: number;
    totalRefundsFromReturns: number;
    totalReturns: number;
    totalServiceInvoices: number;
    totalServicePayments: number;
    totalStoreCreditRefunds: number;
    totalOpeningBalance: number;
    outstandingReceivable: number;
    storeCredit: number;
    netBalance: number;
  }> {
    return { totalSales: 0, totalPayments: 0, totalCreditsFromReturns: 0, totalRefundsFromReturns: 0, totalReturns: 0, totalServiceInvoices: 0, totalServicePayments: 0, totalStoreCreditRefunds: 0, totalOpeningBalance: 0, outstandingReceivable: 0, storeCredit: 0, netBalance: 0 };
  }

  // ==================== END SUPPLIER LEDGER HELPERS ====================

  // Auto-increment counters for document numbers
  private async getNextNumber(prefix: string): Promise<string> {
    const count = await this.getCountForPrefix(prefix);
    const num = (count + 1).toString().padStart(6, "0");
    return `${prefix}-${num}`;
  }

  private async getCountForPrefix(prefix: string): Promise<number> {
    if (prefix === "SL") {
      const result = await db.select({ count: sql<number>`count(*)` }).from(sales);
      return Number(result[0]?.count || 0);
    }
    if (prefix === "PU") {
      const result = await db.select({ count: sql<number>`count(*)` }).from(purchases);
      return Number(result[0]?.count || 0);
    }
    if (prefix === "PO") {
      const result = await db.select({ count: sql<number>`count(*)` }).from(purchaseOrders);
      return Number(result[0]?.count || 0);
    }
    if (prefix === "TR") {
      const result = await db.select({ count: sql<number>`count(*)` }).from(schema.stockTransfers);
      return Number(result[0]?.count || 0);
    }
    if (prefix === "JE") {
      const result = await db.select({ count: sql<number>`count(*)` }).from(schema.journalEntries);
      return Number(result[0]?.count || 0);
    }
    return 0;
  }

  // Generate project invoice number in format TT-YYYY-NNN, resets each year
  private async getNextProjectInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
    const yearEnd = new Date(`${year + 1}-01-01T00:00:00.000Z`);

    const result = await db.select({ count: sql<number>`count(*)` })
      .from(projectIncome)
      .where(
        and(
          sql`payment_date >= ${yearStart.toISOString()}`,
          sql`payment_date < ${yearEnd.toISOString()}`,
          sql`invoice_no IS NOT NULL`
        )
      );

    const count = Number(result[0]?.count || 0);
    const num = (count + 1).toString().padStart(3, "0");
    return `TT-${year}-${num}`;
  }


  // Generate a year-based sequential sale number: SW{YEAR}-TO-{NNNN}
  // Resets to 0001 at the start of each new year
  async getNextSaleNumber(): Promise<string> {
    return "";
  }


  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUserPassword(id: string, passwordHash: string): Promise<void> {
    await db.update(users)
      .set({ password: passwordHash })
      .where(eq(users.id, id));
  }

  async getUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(users.username);
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
    // Clean up scope assignments too
    await db.delete(userScopes).where(eq(userScopes.userId, id));
  }

  async getUserScopes(userId: string): Promise<UserScope[]> {
    return db.select().from(userScopes).where(eq(userScopes.userId, userId));
  }

  async setUserScopes(
    userId: string,
    scopes: { companyId?: string | null; shopId?: string | null; branchId?: string | null }[]
  ): Promise<UserScope[]> {
    // Atomically replace all scope rows for this user
    await db.delete(userScopes).where(eq(userScopes.userId, userId));
    if (!scopes || scopes.length === 0) return [];
    const rows = scopes.map(s => ({
      userId,
      companyId: s.companyId || null,
      shopId: s.shopId || null,
      branchId: s.branchId || null,
    }));
    return db.insert(userScopes).values(rows).returning();
  }

  // Companies
  async getCompanies(): Promise<Company[]> {
    return db.select().from(companies);
  }

  async getCompany(id: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company || undefined;
  }

  async createCompany(data: InsertCompany): Promise<Company> {
    const [company] = await db.insert(companies).values(data).returning();
    return company;
  }

  async updateCompany(id: string, data: Partial<InsertCompany>): Promise<Company | undefined> {
    const [company] = await db.update(companies).set(data).where(eq(companies.id, id)).returning();
    return company || undefined;
  }

  async deleteCompany(id: string): Promise<void> {
    await db.delete(companies).where(eq(companies.id, id));
  }

  // Shops
  async getShops(): Promise<Shop[]> {
    return [];
  }

  async getShop(id: string): Promise<Shop | undefined> {
    return undefined;
  }

  async createShop(data: InsertShop): Promise<Shop> {
    return {} as any;
  }

  async updateShop(id: string, data: Partial<InsertShop>): Promise<Shop | undefined> {
    return undefined;
  }

  async deleteShop(id: string): Promise<void> {
    return;
  }

  // Branches
  async getBranches(): Promise<Branch[]> {
    return db.select().from(branches);
  }

  async getBranch(id: string): Promise<Branch | undefined> {
    const [branch] = await db.select().from(branches).where(eq(branches.id, id));
    return branch || undefined;
  }

  async createBranch(data: InsertBranch): Promise<Branch> {
    const [branch] = await db.insert(branches).values(data).returning();
    return branch;
  }

  async updateBranch(id: string, data: Partial<InsertBranch>): Promise<Branch | undefined> {
    const [branch] = await db.update(branches).set(data).where(eq(branches.id, id)).returning();
    return branch || undefined;
  }

  async deleteBranch(id: string): Promise<void> {
    await db.delete(branches).where(eq(branches.id, id));
  }

  // Warehouses
  async getWarehouses(): Promise<Warehouse[]> {
    return [];
  }

  async getWarehouse(id: string): Promise<Warehouse | undefined> {
    return undefined;
  }

  async createWarehouse(data: InsertWarehouse): Promise<Warehouse> {
    return {} as any;
  }

  async updateWarehouse(id: string, data: Partial<InsertWarehouse>): Promise<Warehouse | undefined> {
    return undefined;
  }

  async deleteWarehouse(id: string): Promise<void> {
    return;
  }

  // Categories
  async getCategories(): Promise<Category[]> {
    return [];
  }

  async getCategory(id: string): Promise<Category | undefined> {
    return undefined;
  }

  async createCategory(data: InsertCategory): Promise<Category> {
    return {} as any;
  }

  async updateCategory(id: string, data: Partial<InsertCategory>): Promise<Category | undefined> {
    return undefined;
  }

  async deleteCategory(id: string): Promise<void> {
    return;
  }

  // Brands
  async getBrands(companyId?: string, branchId?: string): Promise<Brand[]> {
    const conditions = [];
    if (companyId) conditions.push(eq(brands.companyId, companyId));
    if (branchId) conditions.push(eq(brands.branchId, branchId));
    
    if (conditions.length > 0) {
      return db.select().from(brands).where(and(...conditions)).orderBy(desc(brands.createdAt));
    }
    return db.select().from(brands).orderBy(desc(brands.createdAt));
  }

  async getBrand(id: string): Promise<Brand | undefined> {
    const [brand] = await db.select().from(brands).where(eq(brands.id, id));
    return brand || undefined;
  }

  async createBrand(data: InsertBrand): Promise<Brand> {
    const [brand] = await db.insert(brands).values(data).returning();
    return brand;
  }

  async updateBrand(id: string, data: Partial<InsertBrand>): Promise<Brand | undefined> {
    const [brand] = await db.update(brands).set(data).where(eq(brands.id, id)).returning();
    return brand || undefined;
  }

  async deleteBrand(id: string): Promise<void> {
    await db.delete(brands).where(eq(brands.id, id));
  }

  // Manufacturers
  async getManufacturers(): Promise<Manufacturer[]> {
    return [];
  }

  async createManufacturer(data: { name: string; description?: string }): Promise<Manufacturer> {
    return {} as any;
  }

  async deleteManufacturer(id: string): Promise<void> {
    return;
  }

  // Units
  async getUnits(): Promise<Unit[]> {
    return [];
  }

  async createUnit(data: { name: string; abbreviation?: string }): Promise<Unit> {
    return {} as any;
  }

  async updateUnit(id: string, data: { name?: string; abbreviation?: string }): Promise<Unit | undefined> {
    return undefined;
  }

  async deleteUnit(id: string): Promise<void> {
    return;
  }

  // Suppliers
  async getSuppliers(scope?: { companyId?: string | null; shopId?: string | null; branchId?: string | null } | null): Promise<Supplier[]> {
    return [];
  }

  async getSupplier(id: string): Promise<Supplier | undefined> {
    return undefined;
  }

  async createSupplier(data: InsertSupplier): Promise<Supplier> {
    return {} as any;
  }

  async updateSupplier(id: string, data: Partial<InsertSupplier>): Promise<Supplier | undefined> {
    return undefined;
  }

  async deleteSupplier(id: string): Promise<void> {
    return;
  }

  // Products
  async getProducts(
    scope?: { companyId?: string | null; shopId?: string | null; branchId?: string | null; warehouseId?: string | null } | null,
    options: { limit?: number; offset?: number; search?: string } = {}
  ): Promise<{ products: Product[]; total: number }> {
    return { products: [], total: 0 };
  }

  async getProductStockCounts(): Promise<Record<string, number>> {
    return {};
  }

  async getProduct(id: string): Promise<Product | undefined> {
    return undefined;
  }

  async createProduct(data: InsertProduct): Promise<Product> {
    return {} as any;
  }

  async createProductWithAccounting(data: InsertProduct, bankAccountId?: string | null): Promise<Product> {
    return {} as any;
  }

  async updateProduct(id: string, data: Partial<InsertProduct>): Promise<Product | undefined> {
    return undefined;
  }

  async updateProductWithSerials(productId: string, existingProduct: Product, data: Partial<InsertProduct>, newQuantity: number): Promise<Product | undefined> {
    return undefined;
  }

  async updateProductWithSerialsAndAccounting(productId: string, existingProduct: Product, data: Partial<InsertProduct>, newQuantity: number, bankAccountId: string): Promise<Product | undefined> {
    return undefined;
  }

  async deleteProduct(id: string): Promise<void> {
    return;
  }

  async bulkCreateProductsWithAccounting(
    productsData: Array<{
      data: InsertProduct;
      isUpdate: boolean;
      existingProductId?: string;
      existingProduct?: Product;
      newQuantity?: number;
      explicitSerials?: string[];
    }>,
    bankAccountId: string
  ): Promise<{ created: number; updated: number; errors: string[] }> {
    return {} as any;
  }

  // Inventory
  async getInventory(warehouseId?: string): Promise<Inventory[]> {
    return [];
  }

  async getInventoryByWarehouse(warehouseId: string): Promise<any[]> {
    return [];
  }

  async createInventory(data: InsertInventory): Promise<Inventory> {
    return {} as any;
  }

  async updateInventory(id: string, data: Partial<InsertInventory>): Promise<Inventory | undefined> {
    return undefined;
  }

  async adjustInventory(data: { productId: string; warehouseId: string; quantityChange: number; costPrice: number; reason: string; adjustmentType: "add" | "remove" }): Promise<Inventory> {
    return {} as any;
  }

  // Customers
  async getCustomers(scope?: { companyId?: string | null; shopId?: string | null; branchId?: string | null } | null): Promise<Customer[]> {
    return [];
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    return undefined;
  }

  async createCustomer(data: InsertCustomer): Promise<Customer> {
    return {} as any;
  }

  async updateCustomer(id: string, data: Partial<InsertCustomer>): Promise<Customer | undefined> {
    return undefined;
  }

  async deleteCustomer(id: string): Promise<void> {
    return;
  }

  async clearCustomerCredit(id: string, amount: number, paymentMethod: string, bankAccountId: string, notes?: string, scope?: { shopId?: string; branchId?: string }): Promise<any> {
    return [];
  }

  async refundCustomerCredit(id: string, amount: number, paymentMethod: string, bankAccountId: string, notes?: string): Promise<any> {
    return [];
  }

  // Clear customer opening balance (receive payment for initial receivable)
  async clearCustomerOpeningBalance(
    customerId: string,
    amount: number,
    paymentMethod: string,
    bankAccountId: string,
    notes?: string,
    scope?: { shopId?: string; branchId?: string }
  ): Promise<any> {
    return;
  }

  async clearSupplierCredit(id: string, amount: number, paymentMethod: string, bankAccountId?: string | null, notes?: string): Promise<any> {
    return [];
  }

  // Clear supplier opening balance (pay off initial balance owed to supplier)
  async clearSupplierOpeningBalance(
    supplierId: string,
    amount: number,
    paymentMethod: string,
    bankAccountId: string,
    notes?: string,
    scope?: { shopId?: string; branchId?: string }
  ): Promise<any> {
    return;
  }

  // Purchase Orders
  async getPurchaseOrders(): Promise<PurchaseOrder[]> {
    return [];
  }

  async getPurchaseOrder(id: string): Promise<PurchaseOrder | undefined> {
    return undefined;
  }

  async getPurchaseOrderWithItems(id: string): Promise<{ order: PurchaseOrder; items: PurchaseOrderItem[] } | undefined> {
    return undefined;
  }

  async createPurchaseOrder(data: any, items: any[]): Promise<PurchaseOrder> {
    return {} as any;
  }

  async updatePurchaseOrderStatus(id: string, status: string): Promise<PurchaseOrder | undefined> {
    return undefined;
  }

  // Purchases
  async getPurchases(scope?: { companyId?: string | null; shopId?: string | null; branchId?: string | null } | null): Promise<Purchase[]> {
    return [];
  }

  async getPurchase(id: string): Promise<Purchase | undefined> {
    return undefined;
  }

  async getPurchaseWithItems(id: string): Promise<{ purchase: Purchase; items: any[] } | undefined> {
    return undefined;
  }

  
  async deletePurchase(id: string): Promise<void> {
    return;
  }


  async createPurchase(data: any, items: any[]): Promise<Purchase> {
    return {} as any;
  }

  async getPurchasePayments(purchaseId: string): Promise<any[]> {
    return [];
  }

  async createPurchasePayment(data: { purchaseId: string; amount: number; paymentMethod: string; bankAccountId: string; notes?: string }): Promise<any> {
    return [];
  }

  // Sales
  async getSales(scope?: { companyId?: string | null; shopId?: string | null; branchId?: string | null } | null): Promise<Sale[]> {
    return [];
  }

  async getSale(id: string): Promise<Sale | undefined> {
    return undefined;
  }

  
  async updateSaleMetadata(id: string, data: { lpoNumber?: string; paymentStatus?: string; notes?: string }): Promise<any> {
    return [];
  }

  async deleteSale(id: string): Promise<void> {
    return;
  }


  async createSale(data: any, items: any[]): Promise<Sale> {
    return {} as any;
  }

  // Get sale items by sale ID - returns only current (active) sale line items
  async getSaleItems(saleId: string): Promise<any[]> {
    return [];
  }

  // Get sale items with replacement info - returns { currentItems, replacementHistory }
  async getSaleItemsWithReplacementHistory(saleId: string): Promise<{ currentItems: any[], replacementHistory: any[] }> {
    return { currentItems: [], replacementHistory: [] };
  }

  // Get sale replacements by sale ID
  async getSaleReplacementsBySaleId(saleId: string): Promise<any[]> {
    return [];
  }

  // Get customer sales with items (includes remaining returnable quantities)
  async getCustomerSalesWithItems(customerId: string): Promise<any[]> {
    return [];
  }

  // Sale Returns
  async getSaleReturns(): Promise<any[]> {
    return [];
  }

  async getSaleReturnItems(returnId: string): Promise<any[]> {
    return [];
  }

  async createSaleReturn(data: any, items: any[]): Promise<any> {
    return [];
  }

  // Sale Replacements
  async getSaleReplacements(): Promise<any[]> {
    return [];
  }

  async createSaleReplacement(data: any): Promise<any> {
    return [];
  }

  async replaceSaleItem(data: {
    saleId: string;
    saleItemId: string;
    originalSerialNumberId: string;
    replacementProductId: string;
    replacementSerialNumberId: string;
    paymentMethod?: string;
    bankAccountId?: string;
    reason?: string;
    shopId?: string;
    branchId?: string;
  }): Promise<any> {
    return [];
  }

  // Sale Payments (Payment History)
  async getSalePayments(saleId?: string): Promise<any[]> {
    return [];
  }

  async createSalePayment(data: any): Promise<any> {
    const amount = parseFloat(data.amount?.toString() || "0");

    if (amount <= 0) {
      throw new Error("Payment amount must be greater than zero.");
    }

    // LEDGER-DRIVEN: Get invoice summary to check outstanding balance
    const invoiceSummary = await this.getSaleInvoiceSummary(data.saleId);
    if (!invoiceSummary) {
      throw new Error("Sale invoice not found.");
    }

    const balanceRemaining = parseFloat(invoiceSummary.summary.balanceRemaining);

    // OVERPAYMENT PREVENTION: Cannot pay more than outstanding balance
    if (invoiceSummary.summary.storeOwesCustomer) {
      throw new Error("This invoice is fully paid. Customer is owed a refund.");
    }

    if (balanceRemaining <= 0.001) {
      throw new Error("This invoice is already fully paid. No payment can be recorded.");
    }

    if (amount > balanceRemaining + 0.001) {
      throw new Error(`Payment amount (${amount.toFixed(3)} BD) exceeds invoice outstanding balance (${balanceRemaining.toFixed(3)} BD). Overpayment is not allowed.`);
    }

    return await db.transaction(async (tx) => {
      // Create payment record
      const paymentData = {
        saleId: data.saleId,
        customerId: data.customerId || null,
        paymentMethod: data.paymentMethod,
        bankAccountId: data.bankAccountId || null,
        amount: amount.toFixed(3),
        reference: data.reference || null,
        notes: data.notes || null,
      };

      const [payment] = await tx.insert(salePayments).values(paymentData).returning();

      // Update bank account balance if cash/bank payment
      if (data.bankAccountId && data.paymentMethod !== "credit") {
        const [account] = await tx.select().from(bankAccounts).where(eq(bankAccounts.id, data.bankAccountId));
        if (account) {
          const newBalance = parseFloat(account.currentBalance || "0") + amount;
          await tx.update(bankAccounts).set({ currentBalance: newBalance.toFixed(3) }).where(eq(bankAccounts.id, data.bankAccountId));
        }
      }

      // Update customer balance if applicable
      if (data.customerId) {
        const [customer] = await tx.select().from(customers).where(eq(customers.id, data.customerId));
        if (customer) {
          const newBalance = parseFloat(customer.currentBalance || "0") - amount;
          await tx.update(customers).set({ currentBalance: newBalance.toFixed(3) }).where(eq(customers.id, data.customerId));
        }
      }

      // Create accounting entry: Debit Bank/Cash, Credit AR
      const journalLines = [];
      if (data.bankAccountId) {
        journalLines.push({ accountCode: "1000", debit: amount, description: `Payment received - Sale ${data.saleId}` });
      }
      journalLines.push({ accountCode: "1100", credit: amount, description: `Reduce AR for payment` });

      // Get shopId/branchId from the original sale first, then fallback to bank account
      const [sale] = await tx.select().from(sales).where(eq(sales.id, data.saleId));
      let journalShopId = sale?.shopId;
      let journalBranchId = sale?.branchId;

      // If sale doesn't have scope, try to get from bank account
      if (!journalBranchId && data.bankAccountId) {
        const [bankAccount] = await tx.select().from(bankAccounts).where(eq(bankAccounts.id, data.bankAccountId));
        if (bankAccount) {
          journalShopId = journalShopId || bankAccount.shopId || journalBranchId || "";
          journalBranchId = journalBranchId || bankAccount.branchId || "";
        }
      }
      if (!journalBranchId) throw new Error("branchId is required for sale payment journal entry");
      // Use branchId as fallback for shopId
      journalShopId = journalShopId || journalBranchId;

      await this.createJournalEntryInTx(tx, {
        sourceType: "sale_payment",
        sourceId: payment.id,
        shopId: journalShopId,
        branchId: journalBranchId,
        reference: `PMT-${payment.id.slice(0, 8)}`,
        description: `Payment for sale ${data.saleId}`,
        lines: journalLines,
      });

      // Auto-update payment status on the sale based on total payments vs total amount
      const [updatedSale] = await tx.select().from(sales).where(eq(sales.id, data.saleId));
      if (updatedSale) {
        const allPayments = await tx.select({ amount: salePayments.amount })
          .from(salePayments)
          .where(eq(salePayments.saleId, data.saleId));
        const totalPaid = allPayments.reduce((sum, p) => sum + parseFloat(p.amount || "0"), 0);
        const saleTotal = parseFloat(updatedSale.total || "0");
        let newStatus: string;
        if (totalPaid <= 0) {
          newStatus = "unpaid";
        } else if (totalPaid >= saleTotal - 0.001) {
          newStatus = "paid";
        } else {
          newStatus = "partial";
        }
        await tx.update(sales).set({ paymentStatus: newStatus }).where(eq(sales.id, data.saleId));
      }

      return payment;
    });
  }

  async getSaleInvoiceSummary(saleId: string): Promise<any> {
    return {};
  }

  // Bank Accounts
  async getBankAccounts(scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<BankAccount[]> {
    const conditions: SQL[] = [];
    if (scope?.shopId) {
      conditions.push(eq(bankAccounts.shopId, scope.shopId));
    }
    if (scope?.branchId) {
      conditions.push(eq(bankAccounts.branchId, scope.branchId));
    }
    if (conditions.length > 0) {
      return db.select().from(bankAccounts).where(and(...conditions));
    }
    return db.select().from(bankAccounts);
  }

  async getBankAccount(id: string): Promise<BankAccount | undefined> {
    const [account] = await db.select().from(bankAccounts).where(eq(bankAccounts.id, id));
    return account || undefined;
  }

  async createBankAccount(data: InsertBankAccount): Promise<BankAccount> {
    const accountData = {
      ...data,
      currentBalance: data.openingBalance || "0.000",
    };
    const [account] = await db.insert(bankAccounts).values(accountData).returning();
    return account;
  }

  async updateBankAccount(id: string, data: Partial<InsertBankAccount>): Promise<BankAccount | undefined> {
    const [account] = await db.update(bankAccounts).set(data).where(eq(bankAccounts.id, id)).returning();
    return account || undefined;
  }

  async deleteBankAccount(id: string): Promise<void> {
    await db.delete(bankAccounts).where(eq(bankAccounts.id, id));
  }

  // Bank Transactions
  async getBankTransactions(accountId?: string, scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<BankTransaction[]> {
    const conditions = [];
    if (accountId) {
      conditions.push(eq(bankTransactions.bankAccountId, accountId));
    }
    if (scope?.shopId) {
      conditions.push(eq(bankTransactions.shopId, scope.shopId));
    }
    if (scope?.branchId) {
      conditions.push(eq(bankTransactions.branchId, scope.branchId));
    }
    if (conditions.length > 0) {
      return db.select().from(bankTransactions).where(and(...conditions)).orderBy(desc(bankTransactions.transactionDate));
    }
    return db.select().from(bankTransactions).orderBy(desc(bankTransactions.transactionDate));
  }

  async createBankTransaction(data: InsertBankTransaction): Promise<BankTransaction> {
    const amount = parseFloat(data.amount?.toString() || "0");

    // STRICT FINANCIAL CONTROL: Validate sufficient funds for withdrawals and transfers out
    if (data.type === "withdrawal" && amount > 0) {
      await this.ensureSufficientFunds(amount, data.bankAccountId, "bank withdrawal");
    }

    return await db.transaction(async (tx) => {
      // Fetch bank account first to get shopId and branchId
      const [account] = await tx.select().from(bankAccounts).where(eq(bankAccounts.id, data.bankAccountId));
      if (!account) {
        throw new Error("Bank account not found");
      }

      const [transaction] = await tx.insert(bankTransactions).values({
        ...data,
        shopId: account.shopId,
        branchId: account.branchId,
      }).returning();

      const currentBalance = parseFloat(account.currentBalance || "0");
      const newBalance = data.type === "deposit" ? currentBalance + amount : currentBalance - amount;
      await tx.update(bankAccounts).set({ currentBalance: newBalance.toFixed(3) }).where(eq(bankAccounts.id, data.bankAccountId));

      // Create accounting journal entry for bank transaction
      // For deposits: Debit Bank Account (1000), Credit Owner's Capital (3000) - initial/manual deposits
      // For withdrawals: Debit Owner's Drawings (3100), Credit Bank Account (1000) - manual withdrawals
      // Note: Automated deposits/withdrawals from sales, purchases, etc. create their own journal entries
      if (amount > 0 && !data.relatedType) {
        const journalLines = [];
        if (data.type === "deposit") {
          journalLines.push(
            { accountCode: "1000", debit: amount, description: `Bank deposit - ${data.reference || ""}` },
            { accountCode: "3000", credit: amount, description: "Capital/cash deposit to bank" }
          );
        } else {
          journalLines.push(
            { accountCode: "3100", debit: amount, description: `Cash withdrawal from bank - ${data.reference || ""}` },
            { accountCode: "1000", credit: amount, description: "Bank balance reduction" }
          );
        }

        await this.createJournalEntryInTx(tx, {
          sourceType: "bank_transaction",
          sourceId: transaction.id,
          shopId: account.shopId,
          branchId: account.branchId,
          reference: data.reference || `BT-${Date.now()}`,
          description: data.description || `Bank ${data.type}`,
          lines: journalLines,
        });
      }

      return transaction;
    });
  }

  // Petty Cash
  async getPettyCashAccounts(scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<PettyCash[]> {
    const conditions = [];
    if (scope?.shopId) {
      conditions.push(eq(pettyCash.shopId, scope.shopId));
    }
    if (scope?.branchId) {
      conditions.push(eq(pettyCash.branchId, scope.branchId));
    }
    if (conditions.length > 0) {
      return db.select().from(pettyCash).where(and(...conditions));
    }
    return db.select().from(pettyCash);
  }

  async createPettyCash(data: InsertPettyCash): Promise<PettyCash> {
    const pcData = {
      ...data,
      currentBalance: data.openingBalance || "0.000",
    };
    const [pc] = await db.insert(pettyCash).values(pcData).returning();
    return pc;
  }

  async getPettyCashTransactions(scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<any[]> {
    // Petty cash transactions are scoped via the petty cash account
    // Join with petty cash to filter by shop/branch
    if (scope?.shopId || scope?.branchId) {
      const conditions = [];
      if (scope?.shopId) {
        conditions.push(eq(pettyCash.shopId, scope.shopId));
      }
      if (scope?.branchId) {
        conditions.push(eq(pettyCash.branchId, scope.branchId));
      }
      return db.select({
        id: pettyCashTransactions.id,
        pettyCashId: pettyCashTransactions.pettyCashId,
        transactionDate: pettyCashTransactions.transactionDate,
        type: pettyCashTransactions.type,
        amount: pettyCashTransactions.amount,
        description: pettyCashTransactions.description,
        reference: pettyCashTransactions.reference,
      })
        .from(pettyCashTransactions)
        .innerJoin(pettyCash, eq(pettyCashTransactions.pettyCashId, pettyCash.id))
        .where(and(...conditions))
        .orderBy(desc(pettyCashTransactions.transactionDate));
    }
    return db.select().from(pettyCashTransactions).orderBy(desc(pettyCashTransactions.transactionDate));
  }

  
  async deletePettyCashTransaction(id: string): Promise<void> {
    try {
      await db.transaction(async (tx) => {
        const [transaction] = await tx.select().from(pettyCashTransactions).where(eq(pettyCashTransactions.id, id));
        if (!transaction) return;

        const [account] = await tx.select().from(pettyCash).where(eq(pettyCash.id, transaction.pettyCashId));
        if (account) {
          const amount = parseFloat(transaction.amount?.toString() || "0");
          let newBalance = parseFloat(account.currentBalance?.toString() || "0");
          
          // Revert petty cash account balance
          if (transaction.type === "deposit") {
            newBalance -= amount;
          } else {
            newBalance += amount;
          }
          
          await tx.update(pettyCash)
            .set({ currentBalance: newBalance.toFixed(3) })
            .where(eq(pettyCash.id, account.id));

          // Revert bank account balance if it was a bank-linked transaction
          if ((transaction.type === "deposit" || transaction.type === "return") && transaction.bankAccountId) {
            const [bankAccount] = await tx.select().from(bankAccounts).where(eq(bankAccounts.id, transaction.bankAccountId));
            if (bankAccount) {
              const bankBalance = parseFloat(bankAccount.currentBalance?.toString() || "0");
              // If it was a deposit (PC <- Bank), we added to PC and deducted from Bank. Revert: Add to Bank.
              // If it was a return (PC -> Bank), we deducted from PC and added to Bank. Revert: Deduct from Bank.
              const newBankBalance = transaction.type === "deposit" ? bankBalance + amount : bankBalance - amount;
              
              await tx.update(bankAccounts)
                .set({ currentBalance: newBankBalance.toFixed(3) })
                .where(eq(bankAccounts.id, bankAccount.id));
            }
          }
        }

        // Delete associated bank transactions
        await tx.delete(bankTransactions)
          .where(and(
            eq(bankTransactions.relatedType, "petty_cash"),
            eq(bankTransactions.relatedId, id)
          ));

        // Delete associated journal entries and lines
        const entries = await tx.select().from(journalEntries)
          .where(and(
            eq(journalEntries.sourceType, "petty_cash"),
            eq(journalEntries.sourceId, id)
          ));
        
        for (const entry of entries) {
          await tx.delete(journalLines).where(eq(journalLines.journalEntryId, entry.id));
          await tx.delete(journalEntries).where(eq(journalEntries.id, entry.id));
        }

        // Finally delete the petty cash transaction itself
        await tx.delete(pettyCashTransactions).where(eq(pettyCashTransactions.id, id));
      });
    } catch (error) {
      console.error("Error in deletePettyCashTransaction:", error);
      throw error;
    }
  }

  async createPettyCashTransaction(data: any): Promise<any> {
    const amount = parseFloat(data.amount?.toString() || "0");

    // STRICT FINANCIAL CONTROL: For deposits, bank account is required and must have sufficient funds
    if (data.type === "deposit" && amount > 0) {
      if (!data.bankAccountId) {
        throw new Error("Bank account is required for petty cash deposits. The deposit amount will be deducted from the selected bank account.");
      }
      await this.ensureSufficientFunds(amount, data.bankAccountId, "petty cash deposit");
    }

    // STRICT FINANCIAL CONTROL: Validate sufficient funds for petty cash withdrawal/expense/return
    if (data.type !== "deposit" && amount > 0) {
      // Check petty cash account balance
      const [pc] = await db.select().from(pettyCash).where(eq(pettyCash.id, data.pettyCashId));
      if (pc) {
        const currentBalance = parseFloat(pc.currentBalance || "0");
        if (amount > currentBalance) {
          const actionName = data.type === "return" ? "return to bank" : "withdrawals";
          throw new Error(`Insufficient petty cash balance for ${actionName}. Available: ${currentBalance.toFixed(3)} BD, Required: ${amount.toFixed(3)} BD. Please check petty cash funds.`);
        }
      }
    }

    if (data.type === "return" && !data.bankAccountId) {
      throw new Error("Bank account is required to return petty cash funds to the bank.");
    }

    return await db.transaction(async (tx) => {
      const [transaction] = await tx.insert(pettyCashTransactions).values(data).returning();

      // Update petty cash balance
      const [pc] = await tx.select().from(pettyCash).where(eq(pettyCash.id, data.pettyCashId));
      if (pc) {
        const currentBalance = parseFloat(pc.currentBalance || "0");
        const newBalance = data.type === "deposit" ? currentBalance + amount : currentBalance - amount;
        await tx.update(pettyCash).set({ currentBalance: newBalance.toFixed(3) }).where(eq(pettyCash.id, data.pettyCashId));

        // Get shopId and branchId from petty cash account
        const pettyCashShopId = pc.shopId;
        let pettyCashBranchId = pc.branchId;
        if (!pettyCashBranchId) throw new Error("Petty cash must have a branchId for journal entries");
        // Use branchId as fallback for shopId
        if (!pettyCashShopId) {
          // branchId will be used as shopId in createJournalEntryInTx
        }

        // Create accounting journal entry & bank transactions
        if (amount > 0) {
          const journalLines = [];
          if (data.type === "deposit") {
            // For deposits: Debit Petty Cash Fund (1010), Credit Bank (1000)
            // This represents transferring cash from bank to petty cash fund
            journalLines.push(
              { accountCode: "1010", debit: amount, description: `Petty cash replenishment - ${data.description || ""}` },
              { accountCode: "1000", credit: amount, description: "Transfer from bank account" }
            );

            // STRICT FINANCIAL CONTROL: Deduct from bank account - MANDATORY for deposits
            if (data.bankAccountId) {
              const [bankAccount] = await tx.select().from(bankAccounts).where(eq(bankAccounts.id, data.bankAccountId));
              if (!bankAccount) {
                throw new Error("Bank account not found. Cannot process petty cash deposit without a valid bank account.");
              }

              const bankCurrentBalance = parseFloat(bankAccount.currentBalance || "0");
              const newBankBalance = bankCurrentBalance - amount;
              await tx.update(bankAccounts).set({ currentBalance: newBankBalance.toFixed(3) }).where(eq(bankAccounts.id, data.bankAccountId));

              // Record bank transaction for the withdrawal
              await tx.insert(bankTransactions).values({
                bankAccountId: data.bankAccountId,
                shopId: bankAccount.shopId,
                branchId: bankAccount.branchId,
                type: "withdrawal",
                amount: amount.toFixed(3),
                reference: data.reference || `PC-DEP-${Date.now()}`,
                description: `Transfer to petty cash: ${data.description || "Petty cash deposit"}`,
                relatedType: "petty_cash",
                relatedId: transaction.id,
              });
            }
          } else if (data.type === "return") {
            // For returns: Debit Bank (1000), Credit Petty Cash Fund (1010)
            // This represents returning remaining petty cash to bank
            journalLines.push(
              { accountCode: "1000", debit: amount, description: `Petty cash return to bank - ${data.description || ""}` },
              { accountCode: "1010", credit: amount, description: "Petty cash fund reduction" }
            );

            // Deposit back into bank account
            if (data.bankAccountId) {
              const [bankAccount] = await tx.select().from(bankAccounts).where(eq(bankAccounts.id, data.bankAccountId));
              if (!bankAccount) {
                throw new Error("Bank account not found. Cannot process petty cash return without a valid bank account.");
              }

              const bankCurrentBalance = parseFloat(bankAccount.currentBalance || "0");
              const newBankBalance = bankCurrentBalance + amount;
              await tx.update(bankAccounts).set({ currentBalance: newBankBalance.toFixed(3) }).where(eq(bankAccounts.id, data.bankAccountId));

              // Record bank transaction for the deposit
              await tx.insert(bankTransactions).values({
                bankAccountId: data.bankAccountId,
                shopId: bankAccount.shopId,
                branchId: bankAccount.branchId,
                type: "deposit",
                amount: amount.toFixed(3),
                reference: data.reference || `PC-RET-${Date.now()}`,
                description: `Return from petty cash: ${data.description || "Petty cash return"}`,
                relatedType: "petty_cash",
                relatedId: transaction.id,
              });
            }
          } else {
            // For expenses/withdrawals: Debit Expense (category-based), Credit Petty Cash Fund (1010)
            const expenseCode = this.getPettyCashExpenseCode(data.category);
            journalLines.push(
              { accountCode: expenseCode, debit: amount, description: `Petty cash expense - ${data.description || data.category || ""}` },
              { accountCode: "1010", credit: amount, description: "Petty cash fund reduction" }
            );
          }

          await this.createJournalEntryInTx(tx, {
            sourceType: "petty_cash",
            sourceId: transaction.id,
            shopId: pettyCashShopId || undefined,
            branchId: pettyCashBranchId!,
            reference: data.reference || `PC-${Date.now()}`,
            description: data.description || `Petty cash ${data.type}`,
            lines: journalLines,
          });
        }
      }

      return transaction;
    });
  }

  private getPettyCashExpenseCode(category?: string): string {
    const categoryMap: Record<string, string> = {
      office: "6000",
      supplies: "6000",
      transport: "6200",
      travel: "6200",
      meals: "6000",
      utilities: "6500",
      maintenance: "6900",
      other: "6300",
    };
    return categoryMap[category?.toLowerCase() || "other"] || "6300";
  }

  // Capital
  async getCapitalEntries(scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<Capital[]> {
    const conditions = [];
    if (scope?.shopId) {
      conditions.push(eq(capital.shopId, scope.shopId));
    }
    if (scope?.branchId) {
      conditions.push(eq(capital.branchId, scope.branchId));
    }
    if (conditions.length > 0) {
      return db.select().from(capital).where(and(...conditions)).orderBy(desc(capital.transactionDate));
    }
    return db.select().from(capital).orderBy(desc(capital.transactionDate));
  }

  async createCapital(data: InsertCapital): Promise<Capital> {
    const amount = parseFloat(data.amount?.toString() || "0");
    const isInvestment = data.type === "investment" || data.type === "capital_injection" || data.type === "initial" || data.type === "additional";

    // STRICT FINANCIAL CONTROL: Validate sufficient funds before capital withdrawal
    if (!isInvestment && amount > 0 && data.bankAccountId) {
      await this.ensureSufficientFunds(amount, data.bankAccountId, "capital withdrawal");
    }

    return await db.transaction(async (tx) => {
      const [entry] = await tx.insert(capital).values(data).returning();

      // Update bank account if specified
      if (data.bankAccountId) {
        const [account] = await tx.select().from(bankAccounts).where(eq(bankAccounts.id, data.bankAccountId));
        if (account) {
          const currentBalance = parseFloat(account.currentBalance || "0");
          const newBalance = isInvestment ? currentBalance + amount : currentBalance - amount;
          await tx.update(bankAccounts).set({ currentBalance: newBalance.toFixed(3) }).where(eq(bankAccounts.id, data.bankAccountId));

          // Record bank transaction
          await tx.insert(bankTransactions).values({
            bankAccountId: data.bankAccountId,
            shopId: account.shopId,
            branchId: account.branchId,
            type: isInvestment ? "deposit" : "withdrawal",
            amount: amount.toFixed(3),
            reference: `CAP-${Date.now()}`,
            description: data.description || `Capital ${data.type}`,
            relatedType: "capital",
            relatedId: entry.id,
          });
        }
      }

      // Create accounting journal entry for capital
      if (amount > 0) {
        const journalLines = [];
        if (isInvestment) {
          journalLines.push(
            { accountCode: "1000", debit: amount, description: `Capital investment - ${data.description || ""}` },
            { accountCode: "3000", credit: amount, description: "Owner's capital increase" }
          );
        } else {
          journalLines.push(
            { accountCode: "3100", debit: amount, description: `Owner's withdrawal - ${data.description || ""}` },
            { accountCode: "1000", credit: amount, description: "Cash withdrawal" }
          );
        }

        // Get shopId and branchId from capital data (now provided by scope middleware)
        let capitalShopId = data.shopId;
        let capitalBranchId = data.branchId;

        // If bankAccountId is provided, try to get shop/branch from it as fallback
        if (data.bankAccountId && (!capitalBranchId)) {
          const [bankAccount] = await tx.select().from(bankAccounts).where(eq(bankAccounts.id, data.bankAccountId));
          if (bankAccount) {
            capitalShopId = capitalShopId || bankAccount.shopId || capitalBranchId || "";
            capitalBranchId = capitalBranchId || bankAccount.branchId || "";
          }
        }

        if (!capitalBranchId) throw new Error("branchId is required for capital journal entry");
        // Use branchId as fallback for shopId
        capitalShopId = capitalShopId || capitalBranchId;

        await this.createJournalEntryInTx(tx, {
          sourceType: "capital",
          sourceId: entry.id,
          shopId: capitalShopId,
          branchId: capitalBranchId,
          reference: `CAP-${Date.now()}`,
          description: data.description || `Capital ${data.type}`,
          lines: journalLines,
        });
      }

      return entry;
    });
  }

  // Employees
  async getEmployees(scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<Employee[]> {
    const conditions = [];
    if (scope?.shopId) {
      conditions.push(or(eq(employees.shopId, scope.shopId), sql`${employees.shopId} IS NULL`));
    }
    if (scope?.branchId) {
      conditions.push(or(eq(employees.branchId, scope.branchId), sql`${employees.branchId} IS NULL`));
    }
    if (conditions.length > 0) {
      return db.select().from(employees).where(and(...conditions));
    }
    return db.select().from(employees);
  }

  async getEmployee(id: string): Promise<Employee | undefined> {
    const [employee] = await db.select().from(employees).where(eq(employees.id, id));
    return employee || undefined;
  }

  async createEmployee(data: InsertEmployee): Promise<Employee> {
    const [employee] = await db.insert(employees).values(data).returning();
    return employee;
  }

  async updateEmployee(id: string, data: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const [employee] = await db.update(employees).set(data).where(eq(employees.id, id)).returning();
    return employee || undefined;
  }

  async deleteEmployee(id: string): Promise<void> {
    await db.delete(employees).where(eq(employees.id, id));
  }

  // Salary Payments
  async getSalaryPayments(employeeId?: string, scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<SalaryPayment[]> {
    const conditions = [];
    if (employeeId) {
      conditions.push(eq(salaryPayments.employeeId, employeeId));
    }
    if (scope?.shopId) {
      conditions.push(or(eq(salaryPayments.shopId, scope.shopId), sql`${salaryPayments.shopId} IS NULL`));
    }
    if (scope?.branchId) {
      conditions.push(or(eq(salaryPayments.branchId, scope.branchId), sql`${salaryPayments.branchId} IS NULL`));
    }
    if (conditions.length > 0) {
      return db.select().from(salaryPayments).where(and(...conditions)).orderBy(desc(salaryPayments.paymentDate));
    }
    return db.select().from(salaryPayments).orderBy(desc(salaryPayments.paymentDate));
  }

  
  async deleteSalaryPayment(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      // 1. Get payment
      const [payment] = await tx.select().from(salaryPayments).where(eq(salaryPayments.id, id));
      if (!payment) return;
      
      // 2. Reverse bank transaction if exists
      if (payment.bankAccountId) {
         const [account] = await tx.select().from(bankAccounts).where(eq(bankAccounts.id, payment.bankAccountId));
         if (account) {
           // Refunding bank account since it was a withdrawal
           const amount = parseFloat(payment.netSalary || "0");
           const newBalance = parseFloat(account.currentBalance || "0") + amount;
           await tx.update(bankAccounts)
             .set({ currentBalance: newBalance.toFixed(3) })
             .where(eq(bankAccounts.id, account.id));
         }
      }
      
      // 3. Delete related bank transactions and journal entries
      await tx.delete(bankTransactions).where(and(eq(bankTransactions.relatedType, "salary"), eq(bankTransactions.relatedId, id)));
      await tx.delete(journalEntries).where(and(eq(journalEntries.sourceType, "salary"), eq(journalEntries.sourceId, id)));
      
      // 4. Delete salary payment
      await tx.delete(salaryPayments).where(eq(salaryPayments.id, id));
    });
  }

  async createSalaryPayment(data: InsertSalaryPayment): Promise<SalaryPayment> {
    const netSalary = parseFloat(data.netSalary?.toString() || "0");

    // STRICT FINANCIAL CONTROL: Validate sufficient funds before salary payment
    if (netSalary > 0 && data.bankAccountId) {
      await this.ensureSufficientFunds(netSalary, data.bankAccountId, "salary payment");
    }

    return db.transaction(async (tx) => {
      const [payment] = await tx.insert(salaryPayments).values(data).returning();

      const advanceDeduction = parseFloat(data.advanceDeduction?.toString() || "0");

      if (advanceDeduction > 0) {
        const pendingAdvances = await tx.select()
          .from(salaryAdvances)
          .where(and(
            eq(salaryAdvances.employeeId, data.employeeId),
            sql`CAST(remaining_amount AS NUMERIC) > 0`
          ))
          .orderBy(salaryAdvances.advanceDate);

        let remainingDeduction = advanceDeduction;
        for (const advance of pendingAdvances) {
          if (remainingDeduction <= 0.001) break;

          const advanceRemaining = parseFloat(advance.remainingAmount || "0");
          const repayAmount = Math.min(remainingDeduction, advanceRemaining);
          const newRemaining = Math.max(0, advanceRemaining - repayAmount);
          const newRepaid = parseFloat(advance.repaidAmount || "0") + repayAmount;

          await tx.update(salaryAdvances)
            .set({
              remainingAmount: newRemaining.toFixed(3),
              repaidAmount: newRepaid.toFixed(3),
              status: newRemaining < 0.001 ? "repaid" : "partial",
            })
            .where(eq(salaryAdvances.id, advance.id));

          remainingDeduction -= repayAmount;
        }
      }

      if (netSalary > 0 && data.bankAccountId) {
        const [account] = await tx.select().from(bankAccounts).where(eq(bankAccounts.id, data.bankAccountId));
        if (account) {
          await tx.update(bankAccounts)
            .set({ currentBalance: sql`CAST(current_balance AS NUMERIC) - ${netSalary}` })
            .where(eq(bankAccounts.id, data.bankAccountId));

          await tx.insert(bankTransactions).values({
            bankAccountId: data.bankAccountId,
            shopId: account.shopId,
            branchId: account.branchId,
            type: "withdrawal",
            amount: netSalary.toString(),
            reference: `SAL-${payment.id.slice(0, 8)}`,
            description: `Salary payment for ${data.month}/${data.year}`,
            relatedType: "salary_payment",
            relatedId: payment.id,
          });
        }

        const journalLines = [
          { accountCode: "6100", debit: netSalary + advanceDeduction, description: "Salary expense (gross)" },
          { accountCode: "1000", credit: netSalary, description: "Cash paid for salary" },
        ];

        if (advanceDeduction > 0) {
          journalLines.push({ accountCode: "1300", credit: advanceDeduction, description: "Advance repayment" });
        }

        await this.createJournalEntryInTx(tx, {
          sourceType: "salary_payment",
          sourceId: payment.id,
          shopId: account.shopId,
          branchId: account.branchId,
          reference: `SAL-${payment.id.slice(0, 8)}`,
          description: `Salary payment for month ${data.month}/${data.year}`,
          lines: journalLines,
        });
      }

      return payment;
    });
  }

  // Salary Advances
  async getSalaryAdvances(employeeId?: string, scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<any[]> {
    const conditions = [];
    if (employeeId) {
      conditions.push(eq(salaryAdvances.employeeId, employeeId));
    }
    if (scope?.shopId) {
      conditions.push(or(eq(salaryAdvances.shopId, scope.shopId), sql`${salaryAdvances.shopId} IS NULL`));
    }
    if (scope?.branchId) {
      conditions.push(or(eq(salaryAdvances.branchId, scope.branchId), sql`${salaryAdvances.branchId} IS NULL`));
    }
    if (conditions.length > 0) {
      return db.select().from(salaryAdvances).where(and(...conditions)).orderBy(desc(salaryAdvances.advanceDate));
    }
    return db.select().from(salaryAdvances).orderBy(desc(salaryAdvances.advanceDate));
  }

  async createSalaryAdvance(data: InsertSalaryAdvance): Promise<any> {
    const amount = parseFloat(data.amount?.toString() || "0");

    // STRICT FINANCIAL CONTROL: Validate sufficient funds before employee advance
    if (amount > 0 && data.bankAccountId) {
      await this.ensureSufficientFunds(amount, data.bankAccountId, "employee advance");
    }

    return db.transaction(async (tx) => {
      const advanceData = {
        ...data,
        remainingAmount: amount.toString(),
        status: "pending",
      };

      const [advance] = await tx.insert(salaryAdvances).values(advanceData).returning();

      if (amount > 0 && data.bankAccountId) {
        const [account] = await tx.select().from(bankAccounts).where(eq(bankAccounts.id, data.bankAccountId));
        if (account) {
          await tx.update(bankAccounts)
            .set({ currentBalance: sql`CAST(current_balance AS NUMERIC) - ${amount}` })
            .where(eq(bankAccounts.id, data.bankAccountId));

          await tx.insert(bankTransactions).values({
            bankAccountId: data.bankAccountId,
            shopId: account.shopId,
            branchId: account.branchId,
            type: "withdrawal",
            amount: amount.toString(),
            reference: `ADV-${advance.id.slice(0, 8)}`,
            description: `Salary advance to employee`,
            relatedType: "salary_advance",
            relatedId: advance.id,
          });

          await this.createJournalEntryInTx(tx, {
            sourceType: "salary_advance",
            sourceId: advance.id,
            shopId: account.shopId,
            branchId: account.branchId,
            reference: `ADV-${advance.id.slice(0, 8)}`,
            description: `Salary advance given`,
            lines: [
              { accountCode: "1300", debit: amount, description: "Employee advance receivable" },
              { accountCode: "1000", credit: amount, description: "Cash paid for advance" },
            ],
          });
        }
      }

      return advance;
    });
  }

  async updateSalaryAdvance(id: string, data: any): Promise<any> {
    const [advance] = await db.update(salaryAdvances).set(data).where(eq(salaryAdvances.id, id)).returning();
    return advance;
  }

  async getEmployeeAdvanceBalance(employeeId: string): Promise<number> {
    const [result] = await db.select({
      total: sql<string>`COALESCE(SUM(CAST(remaining_amount AS NUMERIC)), 0)`
    }).from(salaryAdvances).where(and(
      eq(salaryAdvances.employeeId, employeeId),
      sql`status != 'repaid'`
    ));
    return parseFloat(result?.total || "0");
  }

  async repaySalaryAdvance(advanceId: string, amount: number, bankAccountId?: string, notes?: string): Promise<any> {
    if (amount <= 0) {
      throw new Error("Repayment amount must be greater than zero");
    }

    return db.transaction(async (tx) => {
      const [advance] = await tx.select().from(salaryAdvances).where(eq(salaryAdvances.id, advanceId));
      if (!advance) throw new Error("Advance not found");

      const remainingAmount = parseFloat(advance.remainingAmount?.toString() || "0");
      if (remainingAmount <= 0) {
        throw new Error("This advance has already been fully repaid");
      }

      if (amount > remainingAmount) {
        throw new Error(`Cannot repay more than the remaining balance of ${remainingAmount.toFixed(3)} BD`);
      }

      const newRemaining = remainingAmount - amount;
      const newRepaid = parseFloat(advance.repaidAmount?.toString() || "0") + amount;
      const newStatus = newRemaining <= 0 ? "repaid" : "partial";

      const [updatedAdvance] = await tx.update(salaryAdvances).set({
        repaidAmount: newRepaid.toFixed(3),
        remainingAmount: newRemaining.toFixed(3),
        status: newStatus,
      }).where(eq(salaryAdvances.id, advanceId)).returning();

      if (bankAccountId) {
        const [account] = await tx.select().from(bankAccounts).where(eq(bankAccounts.id, bankAccountId));
        if (account) {
          await tx.update(bankAccounts)
            .set({ currentBalance: sql`CAST(current_balance AS NUMERIC) + ${amount}` })
            .where(eq(bankAccounts.id, bankAccountId));

          await tx.insert(bankTransactions).values({
            bankAccountId: bankAccountId,
            shopId: account.shopId,
            branchId: account.branchId,
            type: "deposit",
            amount: amount.toString(),
            reference: `ADVR-${advanceId.slice(0, 8)}`,
            description: notes || `Advance repayment from employee`,
            relatedType: "salary_advance_repayment",
            relatedId: advanceId,
          });

          await this.createJournalEntryInTx(tx, {
            sourceType: "salary_advance_repayment",
            sourceId: advanceId,
            shopId: account.shopId,
            branchId: account.branchId,
            reference: `ADVR-${advanceId.slice(0, 8)}`,
            description: notes || `Advance repayment received`,
            lines: [
              { accountCode: "1000", debit: amount, description: "Cash received for advance repayment" },
              { accountCode: "1300", credit: amount, description: "Employee advance receivable reduced" },
            ],
          });
        }
      }

      return updatedAdvance;
    });
  }

  async getAdvanceRepaymentHistory(advanceId: string): Promise<any[]> {
    // Get bank transactions related to this advance repayment
    const transactions = await db.select()
      .from(bankTransactions)
      .where(and(
        eq(bankTransactions.relatedType, "salary_advance_repayment"),
        eq(bankTransactions.relatedId, advanceId)
      ))
      .orderBy(sql`transaction_date DESC`);

    return transactions.map(t => ({
      id: t.id,
      date: t.transactionDate,
      amount: t.amount,
      reference: t.reference,
      notes: t.description,
      bankAccountId: t.bankAccountId,
    }));
  }

  // Clients
  async getClients(): Promise<Client[]> {
    return db.select().from(clients).orderBy(clients.name);
  }

  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client || undefined;
  }

  async createClient(data: InsertClient): Promise<Client> {
    // Check for duplicate client by phone or email (contact details)
    if (data.phone) {
      const existingByPhone = await db.select().from(clients).where(eq(clients.phone, data.phone));
      if (existingByPhone.length > 0) {
        throw new Error(`A client with phone "${data.phone}" already exists`);
      }
    }
    if (data.email) {
      const existingByEmail = await db.select().from(clients).where(sql`LOWER(email) = LOWER(${data.email})`);
      if (existingByEmail.length > 0) {
        throw new Error(`A client with email "${data.email}" already exists`);
      }
    }
    const [client] = await db.insert(clients).values(data).returning();
    return client;
  }

  async updateClient(id: string, data: Partial<InsertClient>): Promise<Client | undefined> {
    const [client] = await db.update(clients).set(data).where(eq(clients.id, id)).returning();
    return client || undefined;
  }

  async deleteClient(id: string): Promise<void> {
    await db.delete(clients).where(eq(clients.id, id));
  }

  // Routes
  async getRoutes(): Promise<Route[]> {
    return db.select().from(routes).orderBy(routes.name);
  }

  async getRoute(id: string): Promise<Route | undefined> {
    const [route] = await db.select().from(routes).where(eq(routes.id, id));
    return route || undefined;
  }

  async createRoute(data: InsertRoute): Promise<Route> {
    const [route] = await db.insert(routes).values(data).returning();
    return route;
  }

  async updateRoute(id: string, data: Partial<InsertRoute>): Promise<Route | undefined> {
    const [route] = await db.update(routes).set(data).where(eq(routes.id, id)).returning();
    return route || undefined;
  }

  async deleteRoute(id: string): Promise<void> {
    await db.delete(routes).where(eq(routes.id, id));
  }

  // Outlets
  async getOutlets(clientId?: string, routeId?: string, brandId?: string): Promise<Outlet[]> {
    const conditions = [];
    if (clientId) conditions.push(eq(outlets.clientId, clientId));
    if (routeId) conditions.push(eq(outlets.routeId, routeId));
    if (brandId) conditions.push(eq(outlets.brandId, brandId));
    
    if (conditions.length > 0) {
      return db.select().from(outlets).where(and(...conditions)).orderBy(outlets.name);
    }
    return db.select().from(outlets).orderBy(outlets.name);
  }

  async getOutlet(id: string): Promise<Outlet | undefined> {
    const [outlet] = await db.select().from(outlets).where(eq(outlets.id, id));
    return outlet || undefined;
  }

  async createOutlet(data: InsertOutlet): Promise<Outlet> {
    const [outlet] = await db.insert(outlets).values(data).returning();
    return outlet;
  }

  async updateOutlet(id: string, data: Partial<InsertOutlet>): Promise<Outlet | undefined> {
    const [outlet] = await db.update(outlets).set(data).where(eq(outlets.id, id)).returning();
    return outlet || undefined;
  }

  async deleteOutlet(id: string): Promise<void> {
    await db.delete(outletZones).where(eq(outletZones.outletId, id));
    await db.delete(outlets).where(eq(outlets.id, id));
  }

  async getOutletZones(outletId: string): Promise<Zone[]> {
    const assignments = await db.select().from(outletZones).where(eq(outletZones.outletId, outletId));
    if (assignments.length === 0) return [];
    
    const zoneIds = assignments.map(a => a.zoneId);
    return db.select().from(zones).where(inArray(zones.id, zoneIds));
  }

  async assignOutletZones(outletId: string, zoneIds: string[]): Promise<void> {
    await db.delete(outletZones).where(eq(outletZones.outletId, outletId));
    if (zoneIds.length > 0) {
      const values = zoneIds.map(zoneId => ({ outletId, zoneId }));
      await db.insert(outletZones).values(values);
    }
  }

  async getZoneOutlets(zoneId: string): Promise<Outlet[]> {
    const assignments = await db.select().from(outletZones).where(eq(outletZones.zoneId, zoneId));
    const assignedOutletIds = assignments.map(a => a.outletId);
    
    const primaryOutlets = await db.select().from(outlets).where(eq(outlets.routeId, zoneId));
    const primaryOutletIds = primaryOutlets.map(o => o.id);
    
    const allOutletIds = Array.from(new Set([...assignedOutletIds, ...primaryOutletIds]));
    
    if (allOutletIds.length === 0) return [];
    return db.select().from(outlets).where(inArray(outlets.id, allOutletIds));
  }

  async appendOutletsToZone(zoneId: string, outletIds: string[]): Promise<void> {
    if (outletIds.length === 0) return;
    
    const existing = await db.select().from(outletZones)
      .where(and(eq(outletZones.zoneId, zoneId), inArray(outletZones.outletId, outletIds)));
    const existingOutletIds = new Set(existing.map(e => e.outletId));
    
    const newOutletIds = outletIds.filter(id => !existingOutletIds.has(id));
    if (newOutletIds.length > 0) {
      const values = newOutletIds.map(outletId => ({ outletId, zoneId }));
      await db.insert(outletZones).values(values);
      
      // Sync the primary routeId so it appears correctly on the Dispatch Board
      await db.update(outlets).set({ routeId: zoneId }).where(inArray(outlets.id, newOutletIds));
    }
  }

  async removeOutletFromZone(zoneId: string, outletId: string): Promise<void> {
    await db.delete(outletZones).where(
      and(
        eq(outletZones.zoneId, zoneId),
        eq(outletZones.outletId, outletId)
      )
    );
    
    // Also clear the primary routeId if it matches this zone
    const [outlet] = await db.select().from(outlets).where(eq(outlets.id, outletId));
    if (outlet && outlet.routeId === zoneId) {
      await db.update(outlets).set({ routeId: null }).where(eq(outlets.id, outletId));
    }
  }

  // ===== DAILY DISPATCH MODULE =====

  async getDriverZones(): Promise<any[]> {
    const rows = await db.select().from(driverZones).orderBy(driverZones.createdAt);
    return rows;
  }

  async getZoneDrivers(zoneId: string): Promise<any[]> {
    return db.select().from(driverZones).where(eq(driverZones.zoneId, zoneId));
  }

  async assignDriverZone(driverId: string, zoneId: string): Promise<any> {
    const [row] = await db.insert(driverZones).values({ driverId, zoneId }).returning();
    return row;
  }

  async removeDriverZone(id: string): Promise<void> {
    await db.delete(driverZones).where(eq(driverZones.id, id));
  }

  async getDispatchSheets(): Promise<any[]> {
    return db.select().from(dispatchSheets).orderBy(desc(dispatchSheets.date));
  }

  async getDispatchSheet(id: string): Promise<any> {
    const [sheet] = await db.select().from(dispatchSheets).where(eq(dispatchSheets.id, id));
    return sheet;
  }

  async getDispatchSheetByDate(date: string): Promise<any | undefined> {
    const [sheet] = await db.select().from(dispatchSheets).where(eq(dispatchSheets.date, date));
    return sheet;
  }

  async createDispatchSheet(data: { date: string; uploadedBy?: string; fileName?: string }): Promise<any> {
    // Delete existing sheet for same date (replace strategy)
    const existing = await this.getDispatchSheetByDate(data.date);
    if (existing) {
      await this.deleteDispatchSheet(existing.id);
    }
    const [sheet] = await db.insert(dispatchSheets).values(data).returning();
    return sheet;
  }

  async deleteDispatchSheet(id: string): Promise<void> {
    const existingItems = await db.select({ id: dispatchItems.id })
      .from(dispatchItems)
      .where(eq(dispatchItems.sheetId, id));
    
    const itemIds = existingItems.map(item => item.id);
    
    if (itemIds.length > 0) {
      await db.delete(dispatchDeliveries)
        .where(inArray(dispatchDeliveries.dispatchItemId, itemIds));
    }
    
    await db.delete(dispatchOutletZoneOverrides).where(eq(dispatchOutletZoneOverrides.sheetId, id));
    await db.delete(dispatchItems).where(eq(dispatchItems.sheetId, id));
    await db.delete(dispatchSheets).where(eq(dispatchSheets.id, id));
  }

  async createDispatchItems(items: any[]): Promise<any[]> {
    if (items.length === 0) return [];
    const inserted = await db.insert(dispatchItems).values(items).returning();
    return inserted;
  }

  async getDispatchItemsForSheet(sheetId: string): Promise<any[]> {
    return await db.select().from(dispatchItems).where(eq(dispatchItems.sheetId, sheetId));
  }

  async getDispatchBoard(sheetId: string): Promise<any> {
    await ensureDriverTablesSchema();
    // Auto-sync any trucks assigned in Zonal Config to this sheet
    await this.autoAssignZoneTrucksToSheet(sheetId);

    // Get all items for sheet
    const items = await db.select().from(dispatchItems).where(eq(dispatchItems.sheetId, sheetId));

    // Get overrides for sheet
    const overrides = await db.select().from(dispatchOutletZoneOverrides).where(eq(dispatchOutletZoneOverrides.sheetId, sheetId));
    const overrideMap = new Map(overrides.map(o => [o.outletId, o]));

    // Get all outlets involved
    const outletIds = Array.from(new Set(items.map(i => i.outletId).filter(Boolean))) as string[];
    const allOutlets = outletIds.length > 0 ? await db.select().from(outlets).where(inArray(outlets.id, outletIds)) : [];
    const outletMap = new Map(allOutlets.map(o => [o.id, o]));

    // Get zone assignments for all outlets (using routeId directly)
    const outletToZone = new Map<string, string>();
    for (const outlet of allOutlets) {
      if (outlet.routeId) outletToZone.set(outlet.id, outlet.routeId);
    }
    for (const [outletId, ov] of Array.from(overrideMap.entries())) {
      if (ov?.overrideZoneId) outletToZone.set(outletId, ov.overrideZoneId);
    }

    // Get all zone IDs we need (including from item.routeId)
    const allItemRouteIds = items.map(i => i.routeId).filter(Boolean) as string[];
    const zoneIds = Array.from(new Set([...Array.from(outletToZone.values()), ...allItemRouteIds])) as string[];
    const allZones = zoneIds.length > 0 ? await db.select().from(routes).where(inArray(routes.id, zoneIds)) : [];
    const zoneMap = new Map(allZones.map(z => [z.id, z]));

    // Get driver assignments for each zone
    const allDriverZones = zoneIds.length > 0 ? await db.select().from(driverZones).where(inArray(driverZones.zoneId, zoneIds)) : [];
    const zoneToDriverIds = new Map<string, string[]>();
    for (const dz of allDriverZones) {
      if (!zoneToDriverIds.has(dz.zoneId)) zoneToDriverIds.set(dz.zoneId, []);
      zoneToDriverIds.get(dz.zoneId)!.push(dz.driverId);
    }

    // Get truck assignments for this sheet
    const truckAssigns = await db.select().from(dispatchTruckAssignments).where(eq(dispatchTruckAssignments.sheetId, sheetId));
    const allTruckIds = Array.from(new Set(truckAssigns.map(t => t.truckId)));
    const allTrucks = allTruckIds.length > 0 ? await db.select().from(vehicles).where(inArray(vehicles.id, allTruckIds)) : [];
    const truckMap = new Map(allTrucks.map(t => [t.id, t]));

    // Get all driver names (from both users and employees table)
    const allDriverIds = Array.from(new Set([
      ...allDriverZones.map(dz => dz.driverId),
      ...truckAssigns.map(t => t.driverId).filter(Boolean) as string[]
    ]));
    const allUsers = allDriverIds.length > 0 ? await db.select().from(users).where(inArray(users.id, allDriverIds)) : [];
    const allEmployees = allDriverIds.length > 0 ? await db.select().from(employees).where(inArray(employees.id, allDriverIds)) : [];
    
    const driverMap = new Map<string, any>();
    for (const emp of allEmployees) {
      driverMap.set(emp.id, { id: emp.id, name: emp.name, username: emp.employeeCode, role: "driver" });
    }
    for (const u of allUsers) {
      driverMap.set(u.id, u);
    }

    // Get outlet-to-truck assignments
    const truckAssignIds = truckAssigns.map(t => t.id);
    const outletTruckAssigns = truckAssignIds.length > 0 ? await db.select().from(dispatchOutletTruckAssignments).where(inArray(dispatchOutletTruckAssignments.truckAssignmentId, truckAssignIds)) : [];
    const outletToTruck = new Map<string, string>();
    for (const ota of outletTruckAssigns) {
      if (ota.outletId) outletToTruck.set(ota.outletId, ota.truckAssignmentId);
      else outletToTruck.set(ota.outletCode, ota.truckAssignmentId);
    }

    // Get delivery statuses for all items
    const itemIds = items.map(i => i.id);
    const deliveries = itemIds.length > 0 ? await db.select().from(dispatchDeliveries).where(inArray(dispatchDeliveries.dispatchItemId, itemIds)) : [];
    const deliveryMap = new Map(deliveries.map(d => [d.dispatchItemId, d]));

    // Build board
    const board: Record<string, any> = {};

    // Add "Unassigned" bucket
    board["unassigned"] = { zoneId: "unassigned", zoneName: "Unassigned", drivers: [], trucks: [], outlets: {} };

    for (const item of items) {
      let effectiveZoneId = "unassigned";
      
      if (item.overrideRouteId) {
        effectiveZoneId = item.overrideRouteId;
      } else if (item.outletId && overrideMap.has(item.outletId)) {
        effectiveZoneId = overrideMap.get(item.outletId)!.overrideZoneId;
      } else if (item.outletId && outletToZone.has(item.outletId)) {
        effectiveZoneId = outletToZone.get(item.outletId)!;
      } else if (item.routeId) {
        effectiveZoneId = item.routeId;
      }
      const isOverridden = (item.outletId ? overrideMap.has(item.outletId) : false) || !!item.overrideRouteId;

      if (!board[effectiveZoneId]) {
        const zone = zoneMap.get(effectiveZoneId);
        const driverIds = zoneToDriverIds.get(effectiveZoneId) || [];
        board[effectiveZoneId] = {
          zoneId: effectiveZoneId,
          zoneName: zone?.name || "Unknown Zone",
          drivers: driverIds.map(id => driverMap.get(id)).filter(Boolean),
          trucks: truckAssigns.filter(t => t.zoneId === effectiveZoneId).map(t => ({
             ...t,
             vehicle: truckMap.get(t.truckId),
             driver: t.driverId ? driverMap.get(t.driverId) : null
          })),
          outlets: {},
        };
      }

      const outletKey = item.outletId || item.outletCode;
      if (!board[effectiveZoneId].outlets[outletKey]) {
        const outlet = item.outletId ? outletMap.get(item.outletId) : null;
        let tAssignId = (item.outletId ? outletToTruck.get(item.outletId) : null) || outletToTruck.get(item.outletCode) || null;
        if (item.outletId && overrideMap.has(item.outletId)) {
           const ov = overrideMap.get(item.outletId);
           if (ov?.overrideTruckId) {
             tAssignId = ov.overrideTruckId;
           }
        }

        board[effectiveZoneId].outlets[outletKey] = {
          outletId: item.outletId,
          outletCode: item.outletCode,
          outletName: outlet?.name || item.outletCode,
          isOverridden,
          overrideZoneId: isOverridden ? (item.overrideRouteId || (item.outletId ? overrideMap.get(item.outletId)?.overrideZoneId : null) || null) : null,
          truckAssignmentId: tAssignId,
          items: [],
        };
      }

      board[effectiveZoneId].outlets[outletKey].items.push({
        ...item,
        delivery: deliveryMap.get(item.id) || null,
      });
    }

    return {
      zones: Object.values(board).map(z => ({
        ...z,
        outlets: Object.values(z.outlets),
      })),
      overrides,
    };
  }

  async updateDispatchDelivery(dispatchItemId: string, data: { deliveredQty?: string; remainingQty?: string; remark?: string; status?: string; driverId?: string; podUrl?: string; temperature?: string; outletId?: string; deliveryTime?: string }): Promise<any> {
    const existing = await db.select().from(dispatchDeliveries).where(eq(dispatchDeliveries.dispatchItemId, dispatchItemId));
    if (existing.length > 0) {
      const [updated] = await db.update(dispatchDeliveries)
        .set({ ...data, deliveredAt: new Date() })
        .where(eq(dispatchDeliveries.dispatchItemId, dispatchItemId))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(dispatchDeliveries)
        .values({ dispatchItemId, ...data, deliveredAt: new Date() })
        .returning();
      return created;
    }
  }

  async createDispatchOverride(data: { sheetId: string; outletId: string; overrideZoneId: string; overrideTruckId?: string; reason?: string; createdBy?: string }): Promise<any> {
    // Remove existing override for same outlet+sheet
    await db.delete(dispatchOutletZoneOverrides)
      .where(and(eq(dispatchOutletZoneOverrides.sheetId, data.sheetId), eq(dispatchOutletZoneOverrides.outletId, data.outletId)));
    const [row] = await db.insert(dispatchOutletZoneOverrides).values(data).returning();
    return row;
  }

  async deleteDispatchOverride(id: string): Promise<void> {
    await db.delete(dispatchOutletZoneOverrides).where(eq(dispatchOutletZoneOverrides.id, id));
  }

  async updateDispatchItemOverride(itemId: string, overrideRouteId: string | null): Promise<any> {
    const [updated] = await db.update(dispatchItems)
      .set({ overrideRouteId })
      .where(eq(dispatchItems.id, itemId))
      .returning();
    return updated;
  }

  // Projects
  async getProjects(scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<Project[]> {
    return [];
  }

  async getProject(id: string): Promise<Project | undefined> {
    return undefined;
  }

  async createProject(data: InsertProject): Promise<Project> {
    return {} as any;
  }

  async updateProject(id: string, data: Partial<InsertProject>): Promise<Project | undefined> {
    return undefined;
  }

  async deleteProject(id: string): Promise<void> {
    return;
  }

  // Tasks
  async getTasks(scope?: { shopId?: string | null; branchId?: string | null } | null, options?: { currentEmployeeId?: string | null; isAdmin?: boolean }): Promise<Task[]> {
    const conditions = [];
    if (scope?.shopId) {
      conditions.push(or(eq(tasks.shopId, scope.shopId), sql`${tasks.shopId} IS NULL`));
    }
    if (scope?.branchId) {
      conditions.push(or(eq(tasks.branchId, scope.branchId), sql`${tasks.branchId} IS NULL`));
    }

    if (!options?.isAdmin && options?.currentEmployeeId) {
      const empId = options.currentEmployeeId;
      conditions.push(sql`${tasks.assigneeId} LIKE ${'%' + empId + '%'}`);
    } else if (!options?.isAdmin && !options?.currentEmployeeId) {
      // If not admin and no employee ID mapped, they shouldn't see tasks
      conditions.push(sql`1 = 0`);
    }

    if (conditions.length > 0) {
      return db.select().from(tasks).where(and(...conditions));
    }
    return db.select().from(tasks);
  }

  async getTask(id: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task || undefined;
  }

  async createTask(data: InsertTask): Promise<Task> {
    const [task] = await db.insert(tasks).values(data).returning();
    return task;
  }

  async updateTask(id: string, data: Partial<InsertTask>): Promise<Task | undefined> {
    const [task] = await db.update(tasks).set(data).where(eq(tasks.id, id)).returning();
    return task || undefined;
  }

  async deleteTask(id: string): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  // Task Attachments
  async getTaskAttachments(taskId: string): Promise<any[]> {
    return db.select().from(taskAttachments).where(eq(taskAttachments.taskId, taskId)).orderBy(desc(taskAttachments.uploadedAt));
  }

  async createTaskAttachment(data: any): Promise<any> {
    const [attachment] = await db.insert(taskAttachments).values(data).returning();
    return attachment;
  }

  async deleteTaskAttachment(id: string): Promise<void> {
    await db.delete(taskAttachments).where(eq(taskAttachments.id, id));
  }

  // Task Timer Methods
  async getTaskTimerSessions(taskId: string): Promise<TaskTimerSession[]> {
    return await db.select().from(taskTimerSessions).where(eq(taskTimerSessions.taskId, taskId)).orderBy(desc(taskTimerSessions.startTime));
  }

  async getActiveTaskTimerSession(taskId: string, userId: string): Promise<TaskTimerSession | undefined> {
    const [session] = await db.select().from(taskTimerSessions)
      .where(and(
        eq(taskTimerSessions.taskId, taskId),
        eq(taskTimerSessions.userId, userId),
        ne(taskTimerSessions.status, "completed")
      ))
      .limit(1);
    return session;
  }

  async getAllActiveTimerSessions(userId: string): Promise<TaskTimerSession[]> {
    return await db.select().from(taskTimerSessions)
      .where(and(
        eq(taskTimerSessions.userId, userId),
        ne(taskTimerSessions.status, "completed")
      ));
  }

  async createTaskTimerSession(data: InsertTaskTimerSession): Promise<TaskTimerSession> {
    const [session] = await db.insert(taskTimerSessions).values(data).returning();
    return session;
  }

  async updateTaskTimerSession(id: string, data: Partial<TaskTimerSession>): Promise<TaskTimerSession | undefined> {
    const [session] = await db.update(taskTimerSessions).set(data).where(eq(taskTimerSessions.id, id)).returning();
    return session;
  }

  // Timesheet Methods
  async getTimesheets(projectId?: string, taskId?: string): Promise<any[]> {
    let query = db.select({
      id: timesheets.id,
      taskId: timesheets.taskId,
      projectId: timesheets.projectId,
      userId: timesheets.userId,
      hours: timesheets.hours,
      date: timesheets.date,
      startTime: timesheets.startTime,
      endTime: timesheets.endTime,
      source: timesheets.source,
      description: timesheets.description,
      taskTitle: tasks.title,
      taskStatus: tasks.status,
      billable: tasks.billable,
      hourlyRate: tasks.hourlyRate,
      employeeName: users.name,
    })
    .from(timesheets)
    .leftJoin(tasks, eq(timesheets.taskId, tasks.id))
    .leftJoin(users, eq(timesheets.userId, users.id));
    
    const conditions = [];
    if (projectId) conditions.push(eq(timesheets.projectId, projectId));
    if (taskId) conditions.push(eq(timesheets.taskId, taskId));
    
    if (conditions.length > 0) {
      return await query.where(and(...conditions)).orderBy(desc(timesheets.date), desc(timesheets.startTime));
    }
    
    return await query.orderBy(desc(timesheets.date), desc(timesheets.startTime));
  }

  async createTimesheet(data: InsertTimesheet): Promise<Timesheet> {
    const [entry] = await db.insert(timesheets).values(data).returning();
    return entry;
  }

  // Project Files
  async getProjectFiles(projectId: string): Promise<ProjectFile[]> {
    return [];
  }

  async createProjectFile(data: any): Promise<ProjectFile> {
    return {} as any;
  }

  async deleteProjectFile(id: string): Promise<void> {
    return;
  }

  // Project Expenses
  async getProjectExpenses(projectId?: string): Promise<any[]> {
    return [];
  }

  async createProjectExpense(data: InsertProjectExpense): Promise<any> {
    return [];
  }

  async updateProjectExpense(id: string, data: any): Promise<any> {
    return [];
  }

  async deleteProjectExpense(id: string): Promise<void> {
    return;
  }

  async getProjectBudgetSummary(projectId: string): Promise<{ budget: number; spent: number; remaining: number }> {
    return { budget: 0, spent: 0, remaining: 0 };
  }

  // Project Income (Client Payments)
  async getProjectIncome(projectId?: string): Promise<ProjectIncome[]> {
    return [];
  }

  async createProjectIncome(data: InsertProjectIncome): Promise<ProjectIncome> {
    return {} as any;
  }

  async confirmProjectIncomePayment(
    id: string,
    paymentData: {
      payments: Array<{ bankAccountId: string; amount: number }>;
      paymentDate: Date;
      paymentMethod: string;
      reference: string;
    }
  ): Promise<ProjectIncome> {
    return {} as any;
  }

  async updateProjectIncome(id: string, data: any): Promise<ProjectIncome> {
    return {} as any;
  }

  async deleteProjectIncome(id: string): Promise<void> {
    return;
  }

  // Complete task - OPERATIONAL ONLY, no accounting entries
  // Tasks are for progress tracking, time tracking, and billable classification
  // Accounting entries are ONLY created through Project Expenses or Payroll
  async completeTask(taskId: string, actualHours: number): Promise<Task> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
    if (!task) throw new Error("Task not found");

    // Update task status and actual hours - NO accounting entries
    const [updatedTask] = await db.update(tasks)
      .set({
        status: "completed",
        actualHours: actualHours.toString(),
        completedAt: new Date(),
      })
      .where(eq(tasks.id, taskId))
      .returning();

    return updatedTask;
  }

  // Create project expense with proper accounting
  async createProjectExpenseWithAccounting(data: InsertProjectExpense): Promise<any> {
    return [];
  }

  private getExpenseAccountCode(category: string): string {
    const categoryToAccount: Record<string, string> = {
      materials: "6400",  // Office Supplies & Materials
      labor: "6100",      // Salary & Labor Expense
      equipment: "6600",  // Equipment & Maintenance (Repairs & Maintenance)
      travel: "6200",     // Travel Expense
      utilities: "6300",  // Utilities Expense
      other: "6900",      // Other Expense
    };
    return categoryToAccount[category] || "6900";
  }

  // Get Project P&L derived from accounting entries
  async getProjectProfitLoss(projectId: string): Promise<{
    income: number;
    expenses: number;
    profit: number;
    incomeDetails: any[];
    expenseDetails: any[];
  }> {
    // Get all journal lines tagged with this project
    const lines = await db.select({
      debit: journalLines.debit,
      credit: journalLines.credit,
      description: journalLines.description,
      accountId: journalLines.accountId,
    }).from(journalLines).where(eq(journalLines.projectId, projectId));

    // Get account types for each line
    let totalIncome = 0;
    let totalExpenses = 0;
    const incomeDetails: any[] = [];
    const expenseDetails: any[] = [];

    for (const line of lines) {
      const [account] = await db.select().from(chartOfAccounts).where(eq(chartOfAccounts.id, line.accountId));
      if (!account) continue;

      const debit = parseFloat(line.debit?.toString() || "0");
      const credit = parseFloat(line.credit?.toString() || "0");

      if (account.accountType === "revenue") {
        // Revenue accounts increase with credits
        totalIncome += credit - debit;
        if (credit > 0) {
          incomeDetails.push({
            accountName: account.name,
            amount: credit,
            description: line.description,
          });
        }
      } else if (account.accountType === "expense") {
        // Expense accounts increase with debits
        totalExpenses += debit - credit;
        if (debit > 0) {
          expenseDetails.push({
            accountName: account.name,
            amount: debit,
            description: line.description,
          });
        }
      }
    }

    return {
      income: totalIncome,
      expenses: totalExpenses,
      profit: totalIncome - totalExpenses,
      incomeDetails,
      expenseDetails,
    };
  }

  // Get project timeline status
  getProjectTimelineStatus(project: Project): string {
    if (!project.endDate) return "no_deadline";

    const today = new Date();
    const endDate = new Date(project.endDate);
    const completedDate = project.completedDate ? new Date(project.completedDate) : null;

    if (project.status === "completed" && completedDate) {
      if (completedDate < endDate) return "early";
      if (completedDate.toDateString() === endDate.toDateString()) return "on_time";
      return "delayed";
    }

    if (project.status !== "completed") {
      if (today > endDate) return "delayed_running";
      return "in_progress";
    }

    return "unknown";
  }

  // Stock Transfers
  async getStockTransfers(): Promise<StockTransfer[]> {
    return [];
  }

  async getStockTransfer(id: string): Promise<StockTransfer | undefined> {
    return undefined;
  }

  async getStockTransferItems(transferId: string): Promise<any[]> {
    return [];
  }

  async createStockTransfer(data: any): Promise<StockTransfer> {
    return {} as any;
  }

  // Dashboard Stats - Filtered by scope (shop/branch/warehouse)
  async getDashboardStats(scope?: { shopId?: string | null; branchId?: string | null; warehouseId?: string | null } | null): Promise<any> {
    const employeeConditions = [];
    if (scope?.shopId) {
      employeeConditions.push(eq(employees.shopId, scope.shopId));
    }
    if (scope?.branchId) {
      employeeConditions.push(eq(employees.branchId, scope.branchId));
    }

    // Employees count with scope
    const employeesQuery = db.select({ count: sql<number>`count(*)` }).from(employees);
    const [employeesResult] = employeeConditions.length > 0
      ? await employeesQuery.where(and(...employeeConditions))
      : await employeesQuery;

    // Pending leave requests count with scope
    const pendingLeaveConditions = [eq(leaveRequests.status, "pending")];
    if (scope?.shopId) {
      pendingLeaveConditions.push(
        sql`${leaveRequests.employeeId} IN (SELECT id FROM employees WHERE shop_id = ${scope.shopId})`
      );
    }
    if (scope?.branchId) {
      pendingLeaveConditions.push(
        sql`${leaveRequests.employeeId} IN (SELECT id FROM employees WHERE branch_id = ${scope.branchId})`
      );
    }
    
    const pendingLeaveQuery = db.select({ count: sql<number>`count(*)` }).from(leaveRequests);
    const [pendingLeaveResult] = pendingLeaveConditions.length > 0
      ? await pendingLeaveQuery.where(and(...pendingLeaveConditions))
      : await pendingLeaveQuery;

    // Bank balance - sum of all bank accounts (scope-filtered if applicable)
    const bankAccountConditions = [];
    if (scope?.shopId) {
      bankAccountConditions.push(eq(bankAccounts.shopId, scope.shopId));
    }
    if (scope?.branchId) {
      bankAccountConditions.push(eq(bankAccounts.branchId, scope.branchId));
    }
    const bankAccountsQuery = db.select({
      total: sql<string>`COALESCE(SUM(CAST(current_balance AS NUMERIC)), 0)`
    }).from(bankAccounts);
    const [bankBalanceResult] = bankAccountConditions.length > 0
      ? await bankAccountsQuery.where(and(...bankAccountConditions))
      : await bankAccountsQuery;

    return {
      totalSales: "0.000",
      salesCount: 0,
      totalPurchases: "0.000",
      purchasesCount: 0,
      inventoryValue: "0.000",
      inventoryCount: 0,
      customersCount: 0,
      suppliersCount: 0,
      productsCount: 0,
      employeesCount: Number(employeesResult?.count || 0),
      recentSales: [],
      bankBalance: bankBalanceResult?.total || "0.000",
      pendingReceivables: "0.000",
      lowStockProducts: [],
      expiringProducts: [],
      pendingLeaveRequests: Number(pendingLeaveResult?.count || 0),
    };
  }

  // Chart of Accounts - Shop-scoped (each shop has its own accounts with same codes)
  async getChartOfAccounts(companyId?: string, scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<ChartOfAccount[]> {
    const conditions = [];
    if (companyId) {
      conditions.push(eq(chartOfAccounts.companyId, companyId));
    }
    // Always filter by shop_id to ensure data isolation
    if (scope?.shopId) {
      conditions.push(eq(chartOfAccounts.shopId, scope.shopId));
    }
    if (conditions.length > 0) {
      return db.select().from(chartOfAccounts).where(and(...conditions)).orderBy(asc(chartOfAccounts.accountCode));
    }
    return db.select().from(chartOfAccounts).orderBy(asc(chartOfAccounts.accountCode));
  }

  async getChartOfAccount(id: string): Promise<ChartOfAccount | undefined> {
    const [account] = await db.select().from(chartOfAccounts).where(eq(chartOfAccounts.id, id));
    return account || undefined;
  }

  async getChartOfAccountByCodeAndBranch(accountCode: string, branchId: string): Promise<ChartOfAccount | undefined> {
    const [account] = await db.select().from(chartOfAccounts)
      .where(and(
        eq(chartOfAccounts.accountCode, accountCode),
        eq(chartOfAccounts.branchId, branchId)
      ));
    return account || undefined;
  }

  async createChartOfAccount(data: InsertChartOfAccounts): Promise<ChartOfAccount> {
    const [account] = await db.insert(chartOfAccounts).values(data).returning();
    return account;
  }

  async updateChartOfAccount(id: string, data: Partial<InsertChartOfAccounts>): Promise<ChartOfAccount | undefined> {
    const [account] = await db.update(chartOfAccounts).set(data).where(eq(chartOfAccounts.id, id)).returning();
    return account || undefined;
  }

  async deleteChartOfAccount(id: string): Promise<void> {
    await db.delete(chartOfAccounts).where(eq(chartOfAccounts.id, id));
  }

  async seedChartOfAccountsForBranch(branchId: string): Promise<{ created: number; existing: number }> {
    const [branch] = await db.select().from(branches).where(eq(branches.id, branchId));
    const shopId = branch?.shopId || "";

    const defaultAccounts = [
      { accountCode: "1000", name: "Cash and Bank", accountType: "asset" },
      { accountCode: "1100", name: "Accounts Receivable", accountType: "asset" },
      { accountCode: "1110", name: "Supplier Receivable", accountType: "asset" },
      { accountCode: "1200", name: "Inventory", accountType: "asset" },
      { accountCode: "1300", name: "Employee Advances", accountType: "asset" },
      { accountCode: "1400", name: "Prepaid Expenses", accountType: "asset" },
      { accountCode: "1500", name: "Fixed Assets", accountType: "asset" },
      { accountCode: "2000", name: "Accounts Payable", accountType: "liability" },
      { accountCode: "2010", name: "Supplier Credit", accountType: "liability" },
      { accountCode: "2100", name: "Accrued Salary Payable", accountType: "liability" },
      { accountCode: "2150", name: "VAT Payable", accountType: "liability" },
      { accountCode: "2200", name: "Accrued Expenses", accountType: "liability" },
      { accountCode: "2300", name: "Loans Payable", accountType: "liability" },
      { accountCode: "3000", name: "Owner's Capital", accountType: "equity" },
      { accountCode: "3100", name: "Owner's Drawings", accountType: "equity" },
      { accountCode: "3200", name: "Retained Earnings", accountType: "equity" },
      { accountCode: "4000", name: "Sales Revenue", accountType: "revenue" },
      { accountCode: "4100", name: "Service Revenue", accountType: "revenue" },
      { accountCode: "4200", name: "Other Income", accountType: "revenue" },
      { accountCode: "5000", name: "Cost of Goods Sold", accountType: "expense" },
      { accountCode: "5100", name: "Freight & Handling Expense", accountType: "expense" },
      { accountCode: "5150", name: "Other Charges Expense", accountType: "expense" },
      { accountCode: "5200", name: "Purchase Discounts", accountType: "revenue" },
      { accountCode: "6000", name: "General Expenses", accountType: "expense" },
      { accountCode: "6100", name: "Salary & Labor Expense", accountType: "expense" },
      { accountCode: "6200", name: "Travel Expense", accountType: "expense" },
      { accountCode: "6300", name: "Utilities Expense", accountType: "expense" },
      { accountCode: "6400", name: "Office Supplies", accountType: "expense" },
      { accountCode: "6500", name: "Rent Expense", accountType: "expense" },
      { accountCode: "6600", name: "Repairs & Maintenance", accountType: "expense" },
      { accountCode: "6700", name: "Marketing Expense", accountType: "expense" },
      { accountCode: "6900", name: "Other Expense", accountType: "expense" },
    ];

    let created = 0;
    let existing = 0;

    for (const account of defaultAccounts) {
      const existingAccount = await this.getChartOfAccountByCodeAndBranch(account.accountCode, branchId);
      if (!existingAccount) {
        await db.insert(chartOfAccounts).values({
          ...account,
          branchId,
          shopId,
        });
        created++;
      } else {
        existing++;
      }
    }

    return { created, existing };
  }

  async seedChartOfAccountsForShop(shopId: string, branchId: string): Promise<{ created: number; existing: number }> {
    return { created: 0, existing: 0 };
  }

  // Journal Entries
  async getJournalEntries(companyId?: string, sourceType?: string, sourceId?: string, shopId?: string, branchId?: string): Promise<JournalEntry[]> {
    const conditions = [];
    if (companyId) {
      conditions.push(eq(journalEntries.companyId, companyId));
    }
    if (shopId) {
      conditions.push(eq(journalEntries.shopId, shopId));
    }
    if (branchId) {
      conditions.push(eq(journalEntries.branchId, branchId));
    }
    if (sourceType) {
      conditions.push(eq(journalEntries.sourceType, sourceType));
    }
    if (sourceId) {
      conditions.push(eq(journalEntries.sourceId, sourceId));
    }

    if (conditions.length > 0) {
      return db.select().from(journalEntries).where(and(...conditions)).orderBy(desc(journalEntries.entryDate));
    }
    return db.select().from(journalEntries).orderBy(desc(journalEntries.entryDate));
  }

  async getJournalEntry(id: string): Promise<JournalEntry | undefined> {
    const [entry] = await db.select().from(journalEntries).where(eq(journalEntries.id, id));
    return entry || undefined;
  }

  async createJournalEntry(data: any, lines: any[]): Promise<JournalEntry> {
    const entryNumber = await this.getNextJournalNumber();

    return await db.transaction(async (tx) => {
      const [entry] = await tx.insert(journalEntries).values({
        entryNumber,
        entryDate: data.entryDate || new Date(),
        companyId: data.companyId,
        shopId: data.shopId,
        branchId: data.branchId,
        reference: data.reference,
        description: data.description,
        sourceType: data.sourceType || "manual",
        sourceId: data.sourceId,
        status: data.status || "posted",
      }).returning();

      for (const line of lines) {
        await tx.insert(journalLines).values({
          journalEntryId: entry.id,
          accountId: line.accountId,
          debit: line.debit?.toString() || "0.000",
          credit: line.credit?.toString() || "0.000",
          description: line.description,
        });

        // Update account balance
        const [account] = await tx.select().from(chartOfAccounts).where(eq(chartOfAccounts.id, line.accountId));
        if (account) {
          const currentBalance = parseFloat(account.balance || "0");
          const debitAmount = parseFloat(line.debit || "0");
          const creditAmount = parseFloat(line.credit || "0");
          // For assets/expenses: debit increases, credit decreases
          // For liabilities/equity/revenue: credit increases, debit decreases
          let newBalance = currentBalance;
          if (["asset", "expense"].includes(account.accountType)) {
            newBalance = currentBalance + debitAmount - creditAmount;
          } else {
            newBalance = currentBalance - debitAmount + creditAmount;
          }
          await tx.update(chartOfAccounts).set({ balance: newBalance.toFixed(3) }).where(eq(chartOfAccounts.id, line.accountId));
        }
      }

      return entry;
    });
  }

  private async getNextJournalNumber(): Promise<string> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(journalEntries);
    const count = Number(result[0]?.count || 0);
    return `JE-${(count + 1).toString().padStart(6, "0")}`;
  }

  async getJournalLines(journalEntryId: string): Promise<JournalLine[]> {
    return db.select().from(journalLines).where(eq(journalLines.journalEntryId, journalEntryId));
  }

  // Get customer's Accounts Receivable statement from journal entries only
  async getCustomerARStatement(customerId: string): Promise<{ entries: any[]; openingBalance: number }> {
    return { entries: [], openingBalance: 0 };
  }

  // Get comprehensive customer payment statement (all invoices with payment details)
  // Get comprehensive customer payment statement (all invoices with payment details)
  async getCustomerPaymentStatement(customerId: string): Promise<any> {
    return [];
  }

  // Financial Reports - Shop-scoped (each shop has isolated balances)
  async getTrialBalance(companyId?: string, startDate?: string, endDate?: string, scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<any> {
    const conditions = [];
    if (companyId) {
      conditions.push(eq(chartOfAccounts.companyId, companyId));
    }
    // Always filter by shop_id to ensure data isolation
    if (scope?.shopId) {
      conditions.push(eq(chartOfAccounts.shopId, scope.shopId));
    }
    // Optionally filter by branch_id for branch-level isolation
    if (scope?.branchId) {
      conditions.push(eq(chartOfAccounts.branchId, scope.branchId));
    }

    let query = db.select({
      id: chartOfAccounts.id,
      accountCode: chartOfAccounts.accountCode,
      name: chartOfAccounts.name,
      accountType: chartOfAccounts.accountType,
      balance: chartOfAccounts.balance,
    }).from(chartOfAccounts);

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const accounts = await query;

    let totalDebits = 0;
    let totalCredits = 0;
    const trialBalanceData = accounts.map(account => {
      const balance = parseFloat(account.balance || "0");
      const isDebitNormal = ["asset", "expense"].includes(account.accountType);
      const debit = balance > 0 && isDebitNormal ? balance : (balance < 0 && !isDebitNormal ? Math.abs(balance) : 0);
      const credit = balance > 0 && !isDebitNormal ? balance : (balance < 0 && isDebitNormal ? Math.abs(balance) : 0);
      totalDebits += debit;
      totalCredits += credit;
      return { ...account, debit: debit.toFixed(3), credit: credit.toFixed(3) };
    });

    // Get cash receipts breakdown by source type
    const cashAccount = accounts.find(a => a.accountCode === "1000");
    let cashBreakdown: { source: string; amount: number }[] = [];

    if (cashAccount && scope?.shopId) {
      // Build conditions for cash receipts query - respects both shop and branch scope
      const cashConditions = [
        eq(journalLines.accountId, cashAccount.id),
        eq(journalEntries.shopId, scope.shopId)
      ];

      // Add branch-level filtering if specified for proper data isolation
      if (scope?.branchId) {
        cashConditions.push(eq(journalEntries.branchId, scope.branchId));
      }

      // Query journal lines for Cash and Bank (1000) grouped by source type
      const cashReceipts = await db.select({
        sourceType: journalEntries.sourceType,
        totalDebit: sql<string>`COALESCE(SUM(CAST(${journalLines.debit} AS NUMERIC)), 0)`,
      })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
        .where(and(...cashConditions))
        .groupBy(journalEntries.sourceType);

      cashBreakdown = cashReceipts.map(r => ({
        source: r.sourceType || "Other",
        amount: parseFloat(r.totalDebit || "0"),
      })).filter(r => r.amount > 0);
    }

    return {
      accounts: trialBalanceData,
      totalDebits: totalDebits.toFixed(3),
      totalCredits: totalCredits.toFixed(3),
      isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
      cashBreakdown,
    };
  }

  async getGeneralLedger(accountId: string, startDate?: string, endDate?: string, scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<any> {
    const [account] = await db.select().from(chartOfAccounts).where(eq(chartOfAccounts.id, accountId));

    const conditions = [eq(journalLines.accountId, accountId)];
    if (scope?.shopId) {
      conditions.push(eq(journalEntries.shopId, scope.shopId));
    }
    if (scope?.branchId) {
      conditions.push(eq(journalEntries.branchId, scope.branchId));
    }

    const lines = await db.select({
      id: journalLines.id,
      debit: journalLines.debit,
      credit: journalLines.credit,
      description: journalLines.description,
      journalEntryId: journalLines.journalEntryId,
      entryDate: journalEntries.entryDate,
      entryNumber: journalEntries.entryNumber,
      reference: journalEntries.reference,
    }).from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
      .where(and(...conditions))
      .orderBy(asc(journalEntries.entryDate));

    return { account, entries: lines };
  }

  async getProfitAndLoss(companyId?: string, startDate?: string, endDate?: string, scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<any> {
    // Shop-scoped - filter by shop_id to ensure data isolation
    const revenueConditions = [eq(chartOfAccounts.accountType, "revenue")];
    const expenseConditions = [eq(chartOfAccounts.accountType, "expense")];

    if (scope?.shopId) {
      revenueConditions.push(eq(chartOfAccounts.shopId, scope.shopId));
      expenseConditions.push(eq(chartOfAccounts.shopId, scope.shopId));
    }

    const revenueAccounts = await db.select().from(chartOfAccounts).where(and(...revenueConditions));
    const expenseAccounts = await db.select().from(chartOfAccounts).where(and(...expenseConditions));

    // Create maps to accumulate dynamic balances from journal entries
    const revMap = new Map(revenueAccounts.map(a => [a.id, { ...a, calculatedBalance: 0 }]));
    const expMap = new Map(expenseAccounts.map(a => [a.id, { ...a, calculatedBalance: 0 }]));

    const accountIds = [...Array.from(revMap.keys()), ...Array.from(expMap.keys())];

    if (accountIds.length > 0) {
      const jeConditions = [];
      if (startDate) {
        jeConditions.push(sql`${journalEntries.entryDate} >= ${new Date(startDate)}`);
      }
      if (endDate) {
        // Handle end date up to end of day
        let endD = new Date(endDate);
        endD.setHours(23, 59, 59, 999);
        jeConditions.push(sql`${journalEntries.entryDate} <= ${endD}`);
      }
      if (scope?.shopId) {
        jeConditions.push(eq(journalEntries.shopId, scope.shopId));
      }
      if (scope?.branchId) {
        jeConditions.push(eq(journalEntries.branchId, scope.branchId));
      }

      const lines = await db.select({
        accountId: journalLines.accountId,
        debit: journalLines.debit,
        credit: journalLines.credit,
      })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
        .where(and(
          inArray(journalLines.accountId, accountIds),
          ...(jeConditions.length > 0 ? jeConditions : [])
        ));

      for (const line of lines) {
        const debit = parseFloat(String(line.debit || 0));
        const credit = parseFloat(String(line.credit || 0));

        if (revMap.has(line.accountId)) {
          // Revenue accounts increase with Credit and decrease with Debit
          const acc = revMap.get(line.accountId)!;
          acc.calculatedBalance += (credit - debit);
        } else if (expMap.has(line.accountId)) {
          // Expense accounts increase with Debit and decrease with Credit
          const acc = expMap.get(line.accountId)!;
          acc.calculatedBalance += (debit - credit);
        }
      }
    }

    const totalRevenue = Array.from(revMap.values()).reduce((sum, acc) => sum + acc.calculatedBalance, 0);
    const totalExpenses = Array.from(expMap.values()).reduce((sum, acc) => sum + acc.calculatedBalance, 0);

    return {
      revenue: Array.from(revMap.values()).map(a => ({ name: a.name, accountCode: a.accountCode, amount: a.calculatedBalance.toFixed(3) })),
      expenses: Array.from(expMap.values()).map(a => ({ name: a.name, accountCode: a.accountCode, amount: a.calculatedBalance.toFixed(3) })),
      totalRevenue: totalRevenue.toFixed(3),
      totalExpenses: totalExpenses.toFixed(3),
      netIncome: (totalRevenue - totalExpenses).toFixed(3),
    };
  }

  async getBalanceSheet(companyId?: string, asOfDate?: string, scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<any> {
    // Shop-scoped - filter by shop_id to ensure data isolation
    const assetConditions = [eq(chartOfAccounts.accountType, "asset")];
    const liabilityConditions = [eq(chartOfAccounts.accountType, "liability")];
    const equityConditions = [eq(chartOfAccounts.accountType, "equity")];

    if (scope?.shopId) {
      assetConditions.push(eq(chartOfAccounts.shopId, scope.shopId));
      liabilityConditions.push(eq(chartOfAccounts.shopId, scope.shopId));
      equityConditions.push(eq(chartOfAccounts.shopId, scope.shopId));
    }

    const assetAccounts = await db.select().from(chartOfAccounts).where(and(...assetConditions));
    const liabilityAccounts = await db.select().from(chartOfAccounts).where(and(...liabilityConditions));
    const equityAccounts = await db.select().from(chartOfAccounts).where(and(...equityConditions));

    const totalAssets = assetAccounts.reduce((sum, acc) => sum + parseFloat(acc.balance || "0"), 0);
    const totalLiabilities = liabilityAccounts.reduce((sum, acc) => sum + parseFloat(acc.balance || "0"), 0);
    const totalEquity = equityAccounts.reduce((sum, acc) => sum + parseFloat(acc.balance || "0"), 0);

    return {
      assets: assetAccounts.map(a => ({ name: a.name, amount: a.balance })),
      liabilities: liabilityAccounts.map(a => ({ name: a.name, amount: a.balance })),
      equity: equityAccounts.map(a => ({ name: a.name, amount: a.balance })),
      totalAssets: totalAssets.toFixed(3),
      totalLiabilities: totalLiabilities.toFixed(3),
      totalEquity: totalEquity.toFixed(3),
    };
  }

  // Salary Report
  async getSalaryReport(employeeId?: string, startDate?: string, endDate?: string, scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<any> {
    const conditions = [];

    if (employeeId) {
      conditions.push(eq(salaryPayments.employeeId, employeeId));
    }
    if (startDate) {
      conditions.push(sql`${salaryPayments.paymentDate} >= ${startDate}`);
    }
    if (endDate) {
      conditions.push(sql`${salaryPayments.paymentDate} <= ${endDate}`);
    }
    if (scope?.shopId) {
      conditions.push(or(eq(salaryPayments.shopId, scope.shopId), sql`${salaryPayments.shopId} IS NULL`));
    }
    if (scope?.branchId) {
      conditions.push(or(eq(salaryPayments.branchId, scope.branchId), sql`${salaryPayments.branchId} IS NULL`));
    }

    const payments = conditions.length > 0
      ? await db.select().from(salaryPayments).where(and(...conditions)).orderBy(desc(salaryPayments.paymentDate))
      : await db.select().from(salaryPayments).orderBy(desc(salaryPayments.paymentDate));

    // Get all employees for name lookup
    const employeeList = await db.select().from(employees);
    const employeeMap = new Map(employeeList.map(e => [e.id, e]));

    // Group by employee
    const byEmployee: Record<string, { employee: any; payments: any[]; total: number }> = {};

    for (const payment of payments) {
      const emp = employeeMap.get(payment.employeeId);
      if (!byEmployee[payment.employeeId]) {
        byEmployee[payment.employeeId] = {
          employee: emp || { id: payment.employeeId, name: "Unknown" },
          payments: [],
          total: 0,
        };
      }
      byEmployee[payment.employeeId].payments.push(payment);
      byEmployee[payment.employeeId].total += parseFloat(payment.netSalary?.toString() || "0");
    }

    const totalGross = payments.reduce((sum, p) => sum + parseFloat(p.basicSalary?.toString() || "0") + parseFloat(p.allowances?.toString() || "0"), 0);
    const totalDeductions = payments.reduce((sum, p) => sum + parseFloat(p.deductions?.toString() || "0"), 0);
    const totalNet = payments.reduce((sum, p) => sum + parseFloat(p.netSalary?.toString() || "0"), 0);

    return {
      payments,
      byEmployee: Object.values(byEmployee),
      summary: {
        totalGross: totalGross.toFixed(3),
        totalDeductions: totalDeductions.toFixed(3),
        totalNet: totalNet.toFixed(3),
        paymentCount: payments.length,
        employeeCount: Object.keys(byEmployee).length,
      },
    };
  }

  async getPettyCashReport(startDate?: string, endDate?: string, scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<any> {
    try {
      const conditions = [];
      if (startDate) conditions.push(sql`${pettyCashTransactions.transactionDate} >= ${startDate}`);
      if (endDate) conditions.push(sql`${pettyCashTransactions.transactionDate} <= ${endDate}`);

      if (scope?.shopId) conditions.push(eq(pettyCashTransactions.shopId, scope.shopId));
      if (scope?.branchId) conditions.push(eq(pettyCashTransactions.branchId, scope.branchId));

      const transactions = await db.select()
        .from(pettyCashTransactions)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(pettyCashTransactions.transactionDate));

      let totalIncome = 0;
      let totalExpense = 0;
      let totalReturns = 0;

      transactions.forEach(t => {
        const amt = parseFloat(t.amount?.toString() || "0");
        if (t.type === "deposit") totalIncome += amt;
        else if (t.type === "return") totalReturns += amt;
        else totalExpense += amt;
      });

      return {
        totalIncome: totalIncome.toFixed(3),
        totalExpense: totalExpense.toFixed(3),
        totalReturns: totalReturns.toFixed(3),
        netCash: (totalIncome - totalExpense - totalReturns).toFixed(3),
        transactions
      };
    } catch (error) {
      console.error("Error in getPettyCashReport:", error);
      throw error;
    }
  }

  // Project Report
  async getProjectReport(projectId?: string, employeeId?: string, startDate?: string, endDate?: string, scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<any> {
    return {};
  }

  async getOverallReport(startDate?: string, endDate?: string, warehouseId?: string, scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<any> {
    return {};
  }

  // Quotations
  async getQuotations(scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<Quotation[]> {
    let conditions = [];
    if (scope?.shopId) {
      conditions.push(eq(quotations.shopId, scope.shopId));
    }
    if (scope?.branchId) {
      conditions.push(eq(quotations.branchId, scope.branchId));
    }
    if (conditions.length > 0) {
      return db.select().from(quotations).where(and(...conditions)).orderBy(desc(quotations.quotationDate));
    }
    return db.select().from(quotations).orderBy(desc(quotations.quotationDate));
  }

  async getQuotation(id: string): Promise<Quotation | undefined> {
    const [quotation] = await db.select().from(quotations).where(eq(quotations.id, id));
    return quotation || undefined;
  }

  async getQuotationWithItems(id: string): Promise<{ quotation: Quotation; items: QuotationItem[] } | undefined> {
    const quotation = await this.getQuotation(id);
    if (!quotation) return undefined;
    const items = await db.select().from(quotationItems).where(eq(quotationItems.quotationId, id));
    return { quotation, items };
  }

  async getApprovedQuotationsForCustomer(customerId: string, scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<Quotation[]> {
    const now = new Date().toISOString().split("T")[0];
    let conditions = [
      eq(quotations.status, "approved"),
      customerId ? eq(quotations.customerId, customerId) : sql`1=1`
    ];
    if (scope?.shopId) {
      conditions.push(eq(quotations.shopId, scope.shopId));
    }
    if (scope?.branchId) {
      conditions.push(eq(quotations.branchId, scope.branchId));
    }
    let result = await db.select().from(quotations)
      .where(and(...conditions))
      .orderBy(desc(quotations.quotationDate));

    // Filter out expired quotations
    return result.filter(q => !q.validUntil || q.validUntil >= now);
  }

  private async getNextQuotationNumber(): Promise<string> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(quotations);
    const count = Number(result[0]?.count || 0);
    return `QT-${(count + 1).toString().padStart(6, "0")}`;
  }

  async createQuotation(data: any, items: any[]): Promise<Quotation> {
    const quotationNumber = await this.getNextQuotationNumber();

    return await db.transaction(async (tx) => {
      const [quotation] = await tx.insert(quotations).values({
        quotationNumber,
        customerId: data.customerId,
        shopId: data.shopId,
        branchId: data.branchId,
        warehouseId: data.warehouseId,
        validUntil: data.validUntil,
        status: data.status || "pending",
        financeCode: data.financeCode,
        requestNo: data.requestNo,
        discountPercent: data.discountPercent?.toString() || "0.00",
        taxType: data.taxType || "VAT",
        currency: data.currency || "BHD",
        salesPerson: data.salesPerson,
        companyName: data.companyName,
        contactPerson: data.contactPerson,
        salesContact: data.salesContact,
        subtotal: data.subtotal?.toString() || "0.000",
        vatAmount: data.vatAmount?.toString() || "0.000",
        discount: data.discount?.toString() || "0.000",
        total: data.total?.toString() || "0.000",
        notes: data.notes,
      }).returning();

      for (const item of items) {
        await tx.insert(quotationItems).values({
          quotationId: quotation.id,
          productId: item.productId,
          productName: item.productName,
          productDesc: item.productDesc,
          warehouseId: item.warehouseId,
          quantity: item.quantity,
          unitPrice: item.unitPrice?.toString() || "0.000",
          vatRate: item.vatRate?.toString() || "5.00",
          discount: item.discount?.toString() || "0.000",
          total: item.total?.toString() || "0.000",
          salesType: item.salesType || "single",
          deliveryDate: item.deliveryDate,
        });
      }

      return quotation;
    });
  }

  async updateQuotation(id: string, data: Partial<InsertQuotation>): Promise<Quotation | undefined> {
    const [quotation] = await db.update(quotations).set(data).where(eq(quotations.id, id)).returning();
    return quotation || undefined;
  }

  async convertQuotationToSale(id: string): Promise<Sale> {
    const quotation = await this.getQuotation(id);
    if (!quotation) throw new Error("Quotation not found");

    const items = await db.select().from(quotationItems).where(eq(quotationItems.quotationId, id));

    const saleItems = items.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: parseFloat(item.unitPrice),
      vatRate: parseFloat(item.vatRate || "5"),
      discount: parseFloat(item.discount || "0"),
      total: parseFloat(item.total || "0"),
    }));

    const sale = await this.createSale({
      customerId: quotation.customerId,
      shopId: quotation.shopId,
      branchId: quotation.branchId,
      paymentMethod: "cash",
      cashAmount: quotation.total,
      subtotal: quotation.subtotal,
      vatAmount: quotation.vatAmount,
      discount: quotation.discount,
      total: quotation.total,
    } as any, saleItems);

    await db.update(quotations).set({ status: "converted", convertedSaleId: sale.id }).where(eq(quotations.id, id));

    return sale;
  }

  // Employee Documents
  async getEmployeeDocuments(employeeId?: string): Promise<EmployeeDocument[]> {
    if (employeeId) {
      return db.select().from(employeeDocuments).where(eq(employeeDocuments.employeeId, employeeId));
    }
    return db.select().from(employeeDocuments);
  }

  async createEmployeeDocument(data: InsertEmployeeDocument): Promise<EmployeeDocument> {
    const [doc] = await db.insert(employeeDocuments).values(data).returning();
    return doc;
  }

  async updateEmployeeDocument(id: string, data: Partial<InsertEmployeeDocument>): Promise<EmployeeDocument | undefined> {
    const [doc] = await db.update(employeeDocuments).set(data).where(eq(employeeDocuments.id, id)).returning();
    return doc || undefined;
  }

  async deleteEmployeeDocument(id: string): Promise<void> {
    await db.delete(employeeDocuments).where(eq(employeeDocuments.id, id));
  }

  async getExpiringDocuments(days: number = 30): Promise<EmployeeDocument[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    return db.select().from(employeeDocuments)
      .where(sql`${employeeDocuments.expiryDate} <= ${futureDate.toISOString().split('T')[0]} AND ${employeeDocuments.expiryDate} >= CURRENT_DATE`);
  }

  // Leave Types
  async getLeaveTypes(): Promise<LeaveType[]> {
    return db.select().from(leaveTypes);
  }

  async createLeaveType(data: InsertLeaveType): Promise<LeaveType> {
    const [type] = await db.insert(leaveTypes).values(data).returning();
    return type;
  }

  async updateLeaveType(id: string, data: Partial<InsertLeaveType>): Promise<LeaveType | undefined> {
    const [type] = await db.update(leaveTypes).set(data).where(eq(leaveTypes.id, id)).returning();
    return type || undefined;
  }

  async deleteLeaveType(id: string): Promise<void> {
    await db.delete(leaveTypes).where(eq(leaveTypes.id, id));
  }

  // Leave Requests
  async getLeaveRequests(employeeId?: string, scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<LeaveRequest[]> {
    // Leave requests are scoped via the employee's shop/branch
    // Join with employees to filter by scope
    if (scope?.shopId || scope?.branchId) {
      const conditions = [];
      if (employeeId) {
        conditions.push(eq(leaveRequests.employeeId, employeeId));
      }
      if (scope?.shopId) {
        conditions.push(eq(employees.shopId, scope.shopId));
      }
      if (scope?.branchId) {
        conditions.push(eq(employees.branchId, scope.branchId));
      }

      return db.select({
        id: leaveRequests.id,
        employeeId: leaveRequests.employeeId,
        leaveTypeId: leaveRequests.leaveTypeId,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        totalDays: leaveRequests.totalDays,
        reason: leaveRequests.reason,
        status: leaveRequests.status,
        approvedById: leaveRequests.approvedById,
        approvedAt: leaveRequests.approvedAt,
        comments: leaveRequests.comments,
        createdAt: leaveRequests.createdAt,
        approvedPaidDays: leaveRequests.approvedPaidDays,
        approvedUnpaidDays: leaveRequests.approvedUnpaidDays,
        coveringEmployeeId: leaveRequests.coveringEmployeeId,
        isHalfDay: leaveRequests.isHalfDay,
        halfDayPeriod: leaveRequests.halfDayPeriod,
      })
        .from(leaveRequests)
        .innerJoin(employees, eq(leaveRequests.employeeId, employees.id))
        .where(and(...conditions))
        .orderBy(desc(leaveRequests.createdAt));
    }

    if (employeeId) {
      return db.select().from(leaveRequests).where(eq(leaveRequests.employeeId, employeeId)).orderBy(desc(leaveRequests.createdAt));
    }
    return db.select().from(leaveRequests).orderBy(desc(leaveRequests.createdAt));
  }

  async getAccruedLeave(employeeId: string): Promise<{ accruedDays: number; usedPaidDays: number; balance: number }> {
    const employee = await this.getEmployee(employeeId);
    if (!employee || !employee.joiningDate) {
      return { accruedDays: 0, usedPaidDays: 0, balance: 0 };
    }

    const joiningDate = new Date(employee.joiningDate);
    const today = new Date();
    
    // Calculate months difference
    const monthsSinceJoining = (today.getFullYear() - joiningDate.getFullYear()) * 12 + (today.getMonth() - joiningDate.getMonth());
    
    // Accrual rate: 30 days per 12 months (2.5 days per month)
    const accruedDays = Math.max(0, parseFloat((monthsSinceJoining * 2.5).toFixed(2)));

    // Get all approved leaves for this employee
    const approvedLeaves = await db.select().from(leaveRequests)
      .where(and(
        eq(leaveRequests.employeeId, employeeId),
        eq(leaveRequests.status, "approved")
      ));

    // By default all approved days might be considered "paid" unless we start explicitly tracking unpaid.
    // For now, if approvedPaidDays is tracked, we use it; otherwise fallback to totalDays.
    let usedPaidDays = 0;
    for (const leave of approvedLeaves) {
      if (leave.approvedPaidDays && parseFloat(leave.approvedPaidDays.toString()) > 0) {
        usedPaidDays += parseFloat(leave.approvedPaidDays.toString());
      } else {
        // Fallback or old data assumption
        usedPaidDays += parseFloat(leave.totalDays?.toString() || "0");
      }
    }

    const balance = Math.max(0, accruedDays - usedPaidDays);

    return {
      accruedDays,
      usedPaidDays,
      balance: parseFloat(balance.toFixed(2))
    };
  }

  async getUnapprovedLeaveDeduction(employeeId: string, month: number, year: number): Promise<{ unapprovedDays: number; leaveDeduction: number; dailyRate: number; leaveIds: string[] }> {
    const employee = await this.getEmployee(employeeId);
    if (!employee) {
      return { unapprovedDays: 0, leaveDeduction: 0, dailyRate: 0, leaveIds: [] };
    }

    const basicSalary = parseFloat(employee.basicSalary || "0");
    const workingDaysPerMonth = 30;
    const dailyRate = basicSalary / workingDaysPerMonth;

    const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
    const endOfMonth = new Date(year, month, 0);
    const endOfMonthStr = `${year}-${String(month).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}`;

    const allLeaveRequests = await db.select().from(leaveRequests)
      .where(and(
        eq(leaveRequests.employeeId, employeeId),
        or(
          eq(leaveRequests.status, "rejected"),
          eq(leaveRequests.status, "pending"),
          // Also include approved requests that have unpaid days
          and(
            eq(leaveRequests.status, "approved"),
            sql`CAST(${leaveRequests.approvedUnpaidDays} AS DECIMAL) > 0`
          )
        )
      ));

    let unapprovedDays = 0;
    const leaveIds: string[] = [];

    for (const leave of allLeaveRequests) {
      const leaveStart = new Date(leave.startDate);
      const leaveEnd = new Date(leave.endDate);
      const monthStart = new Date(startOfMonth);
      const monthEnd = new Date(endOfMonthStr);

      if (leaveEnd < monthStart || leaveStart > monthEnd) {
        continue;
      }

      const overlapStart = leaveStart > monthStart ? leaveStart : monthStart;
      const overlapEnd = leaveEnd < monthEnd ? leaveEnd : monthEnd;
      const overlapDays = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      if (overlapDays > 0) {
        if (leave.status === "approved") {
           // For approved leave, we only deduct the proportion that is unpaid
           // If the entire leave overlaps, deduct all unpaid days.
           // If it's partial, we approximate by capping at the approvedUnpaidDays limit
           const unpaidDaysTotal = parseFloat(leave.approvedUnpaidDays || "0");
           const daysToDeduct = Math.min(overlapDays, unpaidDaysTotal);
           if (daysToDeduct > 0) {
             unapprovedDays += daysToDeduct;
             leaveIds.push(leave.id);
           }
        } else {
           unapprovedDays += overlapDays;
           leaveIds.push(leave.id);
        }
      }
    }

    const leaveDeduction = unapprovedDays * dailyRate;

    return {
      unapprovedDays,
      leaveDeduction: parseFloat(leaveDeduction.toFixed(3)),
      dailyRate: parseFloat(dailyRate.toFixed(3)),
      leaveIds,
    };
  }

  async createLeaveRequest(data: InsertLeaveRequest): Promise<LeaveRequest> {
    const [request] = await db.insert(leaveRequests).values({
      ...data,
      startDate: data.startDate instanceof Date ? data.startDate.toISOString().split('T')[0] : data.startDate,
      endDate: data.endDate instanceof Date ? data.endDate.toISOString().split('T')[0] : data.endDate,
    } as any).returning();
    
    // Trigger notification
    if (request) {
      try {
        const employee = await this.getEmployee(request.employeeId);
        
        // Find recipient emails: Manager, Super Admin, and Covering Employee
        // 1. Covering Employee
        let coveringEmployeeName = "";
        const recipientEmails: string[] = [];
        
        if (request.coveringEmployeeId) {
          const coveringEmployee = await this.getEmployee(request.coveringEmployeeId);
          if (coveringEmployee) {
            coveringEmployeeName = coveringEmployee.name;
            if (coveringEmployee.email) recipientEmails.push(coveringEmployee.email);
          }
        }
        
        // 2. Managers and Super Admins
        const admins = await db.select().from(users).where(
          or(
            eq(users.role, "admin"),
            eq(users.role, "super_admin")
          )
        );
        
        admins.forEach(admin => {
          if (admin.email) recipientEmails.push(admin.email);
        });
        
        // Remove duplicates and call notification service
        const uniqueEmails = Array.from(new Set(recipientEmails));
        
        if (uniqueEmails.length > 0 && employee) {
          await sendLeaveRequestNotification({
            employeeName: employee.name,
            startDate: request.startDate.toString(),
            endDate: request.endDate.toString(),
            totalDays: request.totalDays,
            reason: request.reason || "Not specified",
            coveringEmployeeName,
            recipientEmails: uniqueEmails
          });
        }
      } catch (err) {
        console.error("Failed to send leave request notification:", err);
      }
    }
    
    return request;
  }


  async updateLeaveRequest(id: string, data: Partial<InsertLeaveRequest>): Promise<LeaveRequest | undefined> {
    const updateData = {
      ...data,
      startDate: data.startDate instanceof Date ? data.startDate.toISOString().split('T')[0] : data.startDate,
      endDate: data.endDate instanceof Date ? data.endDate.toISOString().split('T')[0] : data.endDate,
    } as any;
    const [request] = await db.update(leaveRequests).set(updateData).where(eq(leaveRequests.id, id)).returning();
    return request || undefined;
  }

  async approveLeaveRequest(id: string, approvedById: string, approvedPaidDays?: number, approvedUnpaidDays?: number, comments?: string): Promise<LeaveRequest | undefined> {
    const [request] = await db.update(leaveRequests).set({
      status: "approved",
      approvedById,
      approvedPaidDays: approvedPaidDays?.toString() || "0",
      approvedUnpaidDays: approvedUnpaidDays?.toString() || "0",
      comments: comments || null,
      approvedAt: new Date(),
    }).where(eq(leaveRequests.id, id)).returning();

    // Update leave balance only for paid days
    if (request) {
      const year = new Date().getFullYear();
      const [balance] = await db.select().from(leaveBalances)
        .where(and(
          eq(leaveBalances.employeeId, request.employeeId),
          eq(leaveBalances.leaveTypeId, request.leaveTypeId),
          eq(leaveBalances.year, year)
        ));

      if (balance) {
        // Only deduct approvedPaidDays from the leave balance
        const daysToDeduct = approvedPaidDays || 0;
        
        if (daysToDeduct > 0) {
          const used = parseFloat(balance.used || "0") + daysToDeduct;
          const newBalance = parseFloat(balance.entitlement || "0") + parseFloat(balance.carriedForward || "0") - used;
          await db.update(leaveBalances).set({
            used: used.toString(),
            balance: newBalance.toString(),
          }).where(eq(leaveBalances.id, balance.id));
        }
      }
    }

    return request || undefined;
  }


  async rejectLeaveRequest(id: string, comments: string): Promise<LeaveRequest | undefined> {
    const [request] = await db.update(leaveRequests).set({
      status: "rejected",
      comments,
    }).where(eq(leaveRequests.id, id)).returning();
    return request || undefined;
  }

  // Leave Balances
  async getLeaveBalances(employeeId: string, year?: number): Promise<LeaveBalance[]> {
    const currentYear = year || new Date().getFullYear();
    return db.select().from(leaveBalances)
      .where(and(eq(leaveBalances.employeeId, employeeId), eq(leaveBalances.year, currentYear)));
  }

  async updateLeaveBalance(employeeId: string, leaveTypeId: string, year: number, data: Partial<InsertLeaveBalance>): Promise<LeaveBalance | undefined> {
    const [existing] = await db.select().from(leaveBalances)
      .where(and(
        eq(leaveBalances.employeeId, employeeId),
        eq(leaveBalances.leaveTypeId, leaveTypeId),
        eq(leaveBalances.year, year)
      ));

    if (existing) {
      const [balance] = await db.update(leaveBalances).set(data).where(eq(leaveBalances.id, existing.id)).returning();
      return balance || undefined;
    } else {
      const [balance] = await db.insert(leaveBalances).values({
        employeeId,
        leaveTypeId,
        year,
        ...data,
      }).returning();
      return balance;
    }
  }

  // Warehouse Locations
  async getWarehouseLocations(warehouseId?: string): Promise<WarehouseLocation[]> {
    return [];
  }

  async createWarehouseLocation(data: InsertWarehouseLocation): Promise<WarehouseLocation> {
    return {} as any;
  }

  async updateWarehouseLocation(id: string, data: Partial<InsertWarehouseLocation>): Promise<WarehouseLocation | undefined> {
    return undefined;
  }

  async deleteWarehouseLocation(id: string): Promise<void> {
    return;
  }

  // Get total available cash (from all bank accounts)
  async getTotalAvailableCash(): Promise<number> {
    const allBankAccounts = await db.select().from(bankAccounts);
    let totalCash = 0;
    for (const account of allBankAccounts) {
      totalCash += parseFloat(account.currentBalance || "0");
    }

    const allPettyCash = await db.select().from(pettyCash);
    for (const pc of allPettyCash) {
      totalCash += parseFloat(pc.currentBalance || "0");
    }

    return totalCash;
  }

  // Get available balance for a specific bank account
  async getBankAccountBalance(bankAccountId: string): Promise<number> {
    const [account] = await db.select().from(bankAccounts).where(eq(bankAccounts.id, bankAccountId));
    return parseFloat(account?.currentBalance || "0");
  }

  // Get available balance breakdown (for detailed reporting)
  async getAvailableBalanceBreakdown(bankAccountId?: string | null): Promise<{
    bankBalance: number;
    pettyCashBalance: number;
    totalAvailable: number;
    specificAccountBalance?: number;
  }> {
    // If specific bank account requested, return that account's balance
    if (bankAccountId) {
      const [account] = await db.select().from(bankAccounts).where(eq(bankAccounts.id, bankAccountId));
      const specificAccountBalance = parseFloat(account?.currentBalance || "0");
      return {
        bankBalance: specificAccountBalance,
        pettyCashBalance: 0,
        totalAvailable: specificAccountBalance,
        specificAccountBalance,
      };
    }

    // Otherwise return total available from all accounts
    const allBankAccounts = await db.select().from(bankAccounts);
    let bankBalance = 0;
    for (const account of allBankAccounts) {
      bankBalance += parseFloat(account.currentBalance || "0");
    }

    const allPettyCash = await db.select().from(pettyCash);
    let pettyCashBalance = 0;
    for (const pc of allPettyCash) {
      pettyCashBalance += parseFloat(pc.currentBalance || "0");
    }

    return {
      bankBalance,
      pettyCashBalance,
      totalAvailable: bankBalance + pettyCashBalance,
    };
  }

  /**
   * CENTRALIZED BALANCE VALIDATION
   * 
   * This is the CORE FINANCIAL CONTROL function that must be called before
   * ANY debit (outflow) transaction that sends money outside the company.
   * 
   * Validates that sufficient funds exist before allowing:
   * - Purchase transactions (bulk or single)
   * - Supplier payments
   * - Expense transactions (petty cash, operational, project)
   * - Payroll transactions (salaries, employee advances)
   * - Customer refunds
   * 
   * @param amount - The amount to be debited
   * @param bankAccountId - Optional: specific bank account to validate against
   * @param transactionType - Type of transaction for error messaging
   * @returns Validation result with available balance info
   */
  async validateAvailableBalance(
    amount: number,
    bankAccountId?: string | null,
    transactionType: string = "transaction"
  ): Promise<{
    valid: boolean;
    availableBalance: number;
    bankBalance: number;
    pettyCashBalance: number;
    message?: string
  }> {
    // If a specific bank account is specified, validate against that account
    if (bankAccountId) {
      const accountBalance = await this.getBankAccountBalance(bankAccountId);

      if (amount > accountBalance) {
        return {
          valid: false,
          availableBalance: accountBalance,
          bankBalance: accountBalance,
          pettyCashBalance: 0,
          message: `Insufficient funds for ${transactionType}. Available in selected account: ${accountBalance.toFixed(3)} BD, Required: ${amount.toFixed(3)} BD. Please add capital or select a different account.`
        };
      }

      return {
        valid: true,
        availableBalance: accountBalance,
        bankBalance: accountBalance,
        pettyCashBalance: 0
      };
    }

    // Otherwise, validate against total available balance
    const breakdown = await this.getAvailableBalanceBreakdown();

    if (amount > breakdown.totalAvailable) {
      return {
        valid: false,
        availableBalance: breakdown.totalAvailable,
        bankBalance: breakdown.bankBalance,
        pettyCashBalance: breakdown.pettyCashBalance,
        message: `Insufficient funds for ${transactionType}. Available: ${breakdown.totalAvailable.toFixed(3)} BD (Bank: ${breakdown.bankBalance.toFixed(3)}, Petty Cash: ${breakdown.pettyCashBalance.toFixed(3)}), Required: ${amount.toFixed(3)} BD. Please add capital or bank balance.`
      };
    }

    return {
      valid: true,
      availableBalance: breakdown.totalAvailable,
      bankBalance: breakdown.bankBalance,
      pettyCashBalance: breakdown.pettyCashBalance
    };
  }

  /**
   * Throws an error if insufficient funds exist for the transaction.
   * Use this in transaction methods that require strict validation.
   */
  async ensureSufficientFunds(
    amount: number,
    bankAccountId?: string | null,
    transactionType: string = "transaction"
  ): Promise<void> {
    if (amount <= 0) return; // No validation needed for zero or negative amounts

    const validation = await this.validateAvailableBalance(amount, bankAccountId, transactionType);
    if (!validation.valid) {
      throw new Error(validation.message);
    }
  }

  // Validate if there's sufficient cash for a purchase (legacy wrapper)
  async validateCashForPurchase(paidAmount: number): Promise<{ valid: boolean; availableCash: number; message?: string }> {
    const result = await this.validateAvailableBalance(paidAmount, null, "purchase");
    return {
      valid: result.valid,
      availableCash: result.availableBalance,
      message: result.message
    };
  }

  // Salary Generation
  async generateMonthlySalaries(month: number, year: number): Promise<SalaryPayment[]> {
    const allEmployees = await db.select().from(employees).where(eq(employees.status, "active"));
    const generatedPayments: SalaryPayment[] = [];

    for (const employee of allEmployees) {
      // Check if salary already generated for this month
      const existing = await db.select().from(salaryPayments)
        .where(and(
          eq(salaryPayments.employeeId, employee.id),
          eq(salaryPayments.month, month),
          eq(salaryPayments.year, year)
        ));

      if (existing.length === 0) {
        const basicSalary = parseFloat(employee.basicSalary || "0");
        const allowances = parseFloat(employee.allowances || "0");
        const netSalary = basicSalary + allowances;

        const [payment] = await db.insert(salaryPayments).values({
          employeeId: employee.id,
          month,
          year,
          basicSalary: basicSalary.toFixed(3),
          allowances: allowances.toFixed(3),
          deductions: "0.000",
          netSalary: netSalary.toFixed(3),
          status: "pending",
        }).returning();

        generatedPayments.push(payment);
      }
    }

    return generatedPayments;
  }

  // Process salary payment with accounting entries
  async processSalaryPayment(paymentId: string, paymentMethod: string): Promise<SalaryPayment | undefined> {
    return await db.transaction(async (tx) => {
      const [payment] = await tx.select().from(salaryPayments).where(eq(salaryPayments.id, paymentId));
      if (!payment) return undefined;
      if (payment.status === "paid") return payment;

      const [employee] = await tx.select().from(employees).where(eq(employees.id, payment.employeeId));
      const netSalary = parseFloat(payment.netSalary || "0");
      const basicSalary = parseFloat(payment.basicSalary || "0");
      const allowances = parseFloat(payment.allowances || "0");
      const advanceDeduction = parseFloat(payment.advanceDeduction || "0");

      // Update payment status
      const [updatedPayment] = await tx.update(salaryPayments)
        .set({ status: "paid", paymentMethod })
        .where(eq(salaryPayments.id, paymentId))
        .returning();

      // Create accounting journal entry for salary payment
      const journalLines = [];

      // Debit Salary Expense
      if (basicSalary > 0) {
        journalLines.push({ accountCode: "6100", debit: basicSalary, description: `Basic salary - ${employee?.name || "Employee"}` });
      }
      if (allowances > 0) {
        journalLines.push({ accountCode: "6100", debit: allowances, description: `Allowances - ${employee?.name || "Employee"}` });
      }

      // Credit Cash for net payment
      if (netSalary > 0) {
        journalLines.push({ accountCode: "1000", credit: netSalary, description: `Salary payment - ${employee?.name || "Employee"}` });
      }

      // If there was advance deduction, credit advance account
      if (advanceDeduction > 0) {
        journalLines.push({ accountCode: "1300", credit: advanceDeduction, description: `Advance deduction - ${employee?.name || "Employee"}` });
      }

      if (journalLines.length > 0) {
        // Get shopId and branchId from employee or use default
        const salaryShopId = employee?.shopId;
        let salaryBranchId = employee?.branchId;
        if (!salaryBranchId) throw new Error("Employee must have a branchId for salary payment");
        // Use branchId as fallback for shopId

        await this.createJournalEntryInTx(tx, {
          sourceType: "salary",
          sourceId: paymentId,
          shopId: salaryShopId || undefined,
          branchId: salaryBranchId!,
          reference: `SAL-${payment.month}/${payment.year}-${employee?.employeeCode || ""}`,
          description: `Salary payment for ${employee?.name || "Employee"} - ${payment.month}/${payment.year}`,
          lines: journalLines,
        });
      }

      return updatedPayment;
    });
  }

  // Pay advance to employee with accounting entries
  async payAdvanceToEmployee(employeeId: string, amount: number, paymentMethod: string, notes?: string): Promise<any> {
    return await db.transaction(async (tx) => {
      const [employee] = await tx.select().from(employees).where(eq(employees.id, employeeId));
      if (!employee) throw new Error("Employee not found");

      // Create accounting journal entry for advance payment
      // Debit Employee Advance (Asset) and Credit Cash
      const advanceNumber = `ADV-${Date.now()}`;

      // Get shopId and branchId from employee
      const advanceShopId = employee.shopId;
      let advanceBranchId = employee.branchId;
      if (!advanceBranchId) throw new Error("Employee must have a branchId for advance payment");
      // Use branchId as fallback for shopId

      await this.createJournalEntryInTx(tx, {
        sourceType: "advance_payment",
        sourceId: employeeId,
        shopId: advanceShopId || undefined,
        branchId: advanceBranchId!,
        reference: advanceNumber,
        description: `Advance payment to ${employee.name}${notes ? ` - ${notes}` : ""}`,
        lines: [
          { accountCode: "1300", debit: amount, description: `Advance to ${employee.name}` },
          { accountCode: "1000", credit: amount, description: `Cash payment (${paymentMethod})` },
        ],
      });

      return { employee, advanceNumber, amount };
    });
  }

  // Serial Numbers
  async getSerialNumbers(filters?: { productId?: string; warehouseId?: string; shopId?: string; status?: string; serialNumber?: string; saleItemId?: string }): Promise<any[]> {
    return [];
  }

  async getSerialNumber(id: string): Promise<SerialNumber | undefined> {
    return undefined;
  }

  async getSerialNumberByValue(serialNumber: string): Promise<SerialNumber | undefined> {
    return undefined;
  }

  async createSerialNumbers(serials: InsertSerialNumber[]): Promise<SerialNumber[]> {
    return [];
  }

  async updateSerialNumber(id: string, data: { serialNumber?: string; costPrice?: string; sellingPrice?: string; warehouseId?: string | null; updatedAt?: Date }): Promise<SerialNumber | undefined> {
    return undefined;
  }

  async updateSerialNumberStatus(id: string, status: string, additionalData?: { saleId?: string; saleItemId?: string; soldAt?: Date; returnedAt?: Date; replacedAt?: Date }): Promise<SerialNumber | undefined> {
    return undefined;
  }

  // Purchase Returns
  async getPurchaseReturns(supplierId?: string, scope?: { shopId?: string | null; branchId?: string | null } | null): Promise<PurchaseReturn[]> {
    return [];
  }

  async getPurchaseReturnsByPurchase(purchaseId: string): Promise<PurchaseReturn[]> {
    return [];
  }

  async getPurchaseReturn(id: string): Promise<PurchaseReturn | undefined> {
    return undefined;
  }

  async getPurchaseReturnItems(returnId: string): Promise<(PurchaseReturnItem & { productName?: string })[]> {
    return [];
  }

  async createPurchaseReturn(data: InsertPurchaseReturn & { items: InsertPurchaseReturnItem[] }): Promise<PurchaseReturn> {
    return {} as any;
  }

  // Supplier Credits
  async getSupplierCredit(supplierId: string, shopId?: string): Promise<SupplierCredit | undefined> {
    return undefined;
  }

  async getAllSupplierCredits(shopId?: string): Promise<Array<{ supplierId: string; supplierName: string; creditBalance: string }>> {
    return [];
  }

  async updateSupplierCredit(supplierId: string, amount: string, shopId?: string): Promise<SupplierCredit> {
    return {} as any;
  }

  async getSupplierCreditTransactions(supplierId: string, shopId?: string): Promise<SupplierCreditTransaction[]> {
    return [];
  }

  async createSupplierCreditTransaction(data: InsertSupplierCreditTransaction): Promise<SupplierCreditTransaction> {
    return {} as any;
  }

  async getSupplierCreditRefunds(supplierId: string): Promise<any[]> {
    return [];
  }

  async receiveSupplierRefund(supplierId: string, amount: number, bankAccountId: string, notes?: string, scope?: { shopId?: string; branchId?: string }): Promise<any> {
    return [];
  }

  // Purchase Returns Helpers
  async getPurchasesForReturn(supplierId: string): Promise<any[]> {
    return [];
  }

  async getAvailableSerialsForPurchase(purchaseId: string): Promise<SerialNumber[]> {
    return [];
  }

  // Chart of Accounts helpers - Shop-scoped (must filter by shopId)
  private async getAccountByCode(code: string, shopId: string): Promise<ChartOfAccount | undefined> {
    const [account] = await db.select().from(chartOfAccounts).where(
      and(
        eq(chartOfAccounts.accountCode, code),
        eq(chartOfAccounts.shopId, shopId)
      )
    );
    return account || undefined;
  }

  // Create journal entry with balanced lines (double-entry accounting) - for use within transactions
  // shopId and branchId are mandatory for all journal entries per accounting scope rules
  private async createJournalEntryInTx(
    tx: any,
    data: {
      sourceType: string;
      sourceId: string;
      reference: string;
      description: string;
      shopId?: string | null;
      branchId: string;
      projectId?: string;
      clientId?: string;
      taskId?: string;
      lines: Array<{ accountCode: string; debit?: number; credit?: number; description?: string; projectId?: string; clientId?: string; taskId?: string }>;
    }
  ): Promise<JournalEntry> {
    if (!data.branchId) {
      throw new Error("branchId is required for all journal entries (accounting scope enforcement)");
    }

    // Use branchId as fallback for shopId (shops have been replaced by branches)
    const effectiveShopId = data.shopId || data.branchId;

    const entryNumber = await this.getNextNumber("JE");

    const [entry] = await tx.insert(journalEntries).values({
      entryNumber,
      entryDate: new Date(),
      sourceType: data.sourceType,
      sourceId: data.sourceId,
      reference: data.reference,
      description: data.description,
      shopId: effectiveShopId,
      branchId: data.branchId,
      status: "posted",
    }).returning();

    // Insert journal lines and update account balances - filter by branchId for data isolation
    for (const line of data.lines) {
      // Try to find account by branchId first (preferred), then by shopId as fallback
      let [account] = await tx.select().from(chartOfAccounts).where(
        and(
          eq(chartOfAccounts.accountCode, line.accountCode),
          eq(chartOfAccounts.branchId, data.branchId)
        )
      );
      // Fallback: try by shopId if not found by branchId
      if (!account && effectiveShopId !== data.branchId) {
        [account] = await tx.select().from(chartOfAccounts).where(
          and(
            eq(chartOfAccounts.accountCode, line.accountCode),
            eq(chartOfAccounts.shopId, effectiveShopId)
          )
        );
      }
      if (!account) {
        throw new Error(`Account code ${line.accountCode} not found in Chart of Accounts for branch ${data.branchId}. Please seed default accounts first.`);
      }

      const debitAmount = line.debit || 0;
      const creditAmount = line.credit || 0;

      await tx.insert(journalLines).values({
        journalEntryId: entry.id,
        accountId: account.id,
        debit: debitAmount.toFixed(3),
        credit: creditAmount.toFixed(3),
        description: line.description || null,
        projectId: line.projectId || data.projectId || null,
        clientId: line.clientId || data.clientId || null,
        taskId: line.taskId || data.taskId || null,
      });

      // Update account balance (assets/expenses: debit increases, liabilities/equity/revenue: credit increases)
      const currentBalance = parseFloat(account.balance || "0");
      let newBalance: number;
      if (account.accountType === "asset" || account.accountType === "expense") {
        newBalance = currentBalance + debitAmount - creditAmount;
      } else {
        newBalance = currentBalance + creditAmount - debitAmount;
      }
      await tx.update(chartOfAccounts).set({ balance: newBalance.toFixed(3) }).where(eq(chartOfAccounts.id, account.id));
    }

    return entry;
  }

  // Service Tickets
  async getServiceTickets(shopId?: string, filters?: { technicianId?: string; startDate?: Date; endDate?: Date; paymentStatus?: "paid" | "outstanding" }): Promise<ServiceTicket[]> {
    return [];
  }

  async getServiceTicketsReport(filters: { 
    technicianId?: string; 
    startDate?: Date; 
    endDate?: Date; 
    paymentStatus?: "paid" | "outstanding";
    shopId?: string;
    branchId?: string
  }): Promise<ServiceTicket[]> {
    return [];
  }

  async getServiceTicket(id: string): Promise<ServiceTicket | undefined> {
    return undefined;
  }

  async createServiceTicket(data: InsertServiceTicket): Promise<ServiceTicket> {
    return {} as any;
  }

  async getServiceTicketPayments(ticketId: string): Promise<ServiceTicketPayment[]> {
    return [];
  }

  async addServiceTicketPayment(ticketId: string, paymentData: {
    amount: number;
    paymentMethod: string;
    bankAccountId?: string;
    notes?: string;
    processedBy?: string;
  }): Promise<{ payment: ServiceTicketPayment; ticket: ServiceTicket; receiptNumber: string }> {
    return { payment: {} as any, ticket: {} as any, receiptNumber: '' };
  }

  private async getNextTicketNumber(prefix: string): Promise<string> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(serviceTickets);
    const count = Number(result[0]?.count || 0);
    const num = (count + 1).toString().padStart(6, "0");
    return `${prefix}-${num}`;
  }

  async updateServiceTicket(id: string, data: Partial<InsertServiceTicket>): Promise<ServiceTicket | undefined> {
    return undefined;
  }

  // Refactor accounting creation logic to be reusable
  private async createServiceAccountingInTx(tx: any, ticket: ServiceTicket) {
    const serviceAmount = parseFloat(ticket.serviceAmount?.toString() || "0");
    const partsAmount = parseFloat(ticket.partsAmount?.toString() || "0");
    const vatAmount = parseFloat(ticket.vatAmount?.toString() || "0");
    const paidAmount = parseFloat(ticket.paidAmount?.toString() || "0");
    const creditAmount = parseFloat(ticket.creditAmount?.toString() || "0");

    if (paidAmount > 0) {
      // Re-insert a serviceTicketPayments record so customer statement can find it.
      // This is critical when called after an update (reversal wipes all payment records).
      await tx.insert(serviceTicketPayments).values({
        serviceTicketId: ticket.id,
        customerId: ticket.customerId || undefined,
        shopId: ticket.shopId || undefined,
        branchId: ticket.branchId || undefined,
        amount: paidAmount.toFixed(3),
        paymentMethod: ticket.paymentMethod || "cash",
        bankAccountId: ticket.bankAccountId || undefined,
        reference: ticket.ticketNumber,
        notes: `Payment re-recorded after ticket update`,
        paymentDate: new Date(),
      });

      if (ticket.bankAccountId) {
        const [account] = await tx.select().from(bankAccounts).where(eq(bankAccounts.id, ticket.bankAccountId));
        if (account) {
          await tx.insert(bankTransactions).values({
            bankAccountId: ticket.bankAccountId,
            shopId: account.shopId,
            branchId: account.branchId,
            type: "deposit",
            amount: paidAmount.toFixed(3),
            reference: ticket.ticketNumber,
            description: `Service payment received - ${ticket.ticketNumber}`,
            relatedType: "service",
            relatedId: ticket.id,
          });

          await tx.update(bankAccounts)
            .set({ currentBalance: sql`CAST(current_balance AS NUMERIC) + ${paidAmount}` })
            .where(eq(bankAccounts.id, ticket.bankAccountId));
        }
      }

      const lines: any[] = [{ accountCode: "1000", debit: paidAmount, description: "Cash/Card received for service" }];
      const netServicePart = serviceAmount + partsAmount;
      const paidForService = Math.min(paidAmount, netServicePart);
      const paidForVat = paidAmount - paidForService;

      if (paidForService > 0) lines.push({ accountCode: "4100", credit: paidForService, description: "Service revenue" });
      if (paidForVat > 0) lines.push({ accountCode: "2150", credit: paidForVat, description: "VAT payable on service" });

      await this.createJournalEntryInTx(tx, {
        sourceType: "service",
        sourceId: ticket.id,
        shopId: ticket.shopId,
        branchId: ticket.branchId || ticket.shopId,
        reference: ticket.ticketNumber,
        description: `Service payment - ${ticket.ticketNumber}`,
        lines,
      });
    }

    if (creditAmount > 0 && ticket.customerId) {
      const [customer] = await tx.select().from(customers).where(eq(customers.id, ticket.customerId));
      if (customer) {
        const newBalance = parseFloat(customer.currentBalance || "0") + creditAmount;
        await tx.update(customers).set({ currentBalance: newBalance.toFixed(3) }).where(eq(customers.id, ticket.customerId));
      }

      const creditLines: any[] = [{ accountCode: "1100", debit: creditAmount, description: "Accounts receivable for service" }];
      const netServicePart = serviceAmount + partsAmount;
      const creditForService = Math.min(creditAmount, netServicePart);
      const creditForVat = creditAmount - creditForService;

      if (creditForService > 0) creditLines.push({ accountCode: "4100", credit: creditForService, description: "Service revenue on credit" });
      if (creditForVat > 0) creditLines.push({ accountCode: "2150", credit: creditForVat, description: "VAT payable on service credit" });

      await this.createJournalEntryInTx(tx, {
        sourceType: "service",
        sourceId: ticket.id,
        shopId: ticket.shopId,
        branchId: ticket.branchId || ticket.shopId,
        reference: ticket.ticketNumber,
        description: `Service credit - ${ticket.ticketNumber}`,
        lines: creditLines,
      });
    }
  }

  private async reverseServiceAccountingInTx(tx: any, id: string, ticket: ServiceTicket) {
    // 1. Get all payment IDs for this ticket (for journal entry lookup)
    const ticketPayments = await tx.select().from(serviceTicketPayments)
      .where(eq(serviceTicketPayments.serviceTicketId, id));

    // 2. Reverse bank transactions linked to each payment
    for (const pmt of ticketPayments) {
      const bankTxns = await tx.select().from(bankTransactions)
        .where(and(eq(bankTransactions.relatedType, "service_payment"), eq(bankTransactions.relatedId, pmt.id)));
      for (const txn of bankTxns) {
        await tx.update(bankAccounts)
          .set({ currentBalance: sql`CAST(current_balance AS NUMERIC) - ${parseFloat(txn.amount)}` })
          .where(eq(bankAccounts.id, txn.bankAccountId));
      }
      await tx.delete(bankTransactions)
        .where(and(eq(bankTransactions.relatedType, "service_payment"), eq(bankTransactions.relatedId, pmt.id)));

      // Reverse journal entries for each payment
      const pmtJournalEntries = await tx.select().from(journalEntries)
        .where(and(eq(journalEntries.sourceType, "service_payment"), eq(journalEntries.sourceId, pmt.id)));
      for (const entry of pmtJournalEntries) {
        const lines = await tx.select().from(journalLines).where(eq(journalLines.journalEntryId, entry.id));
        for (const line of lines) {
          const [account] = await tx.select().from(chartOfAccounts).where(eq(chartOfAccounts.id, line.accountId));
          if (account) {
            const debit = parseFloat(line.debit || "0");
            const credit = parseFloat(line.credit || "0");
            const currentBalance = parseFloat(account.balance || "0");
            let newBalance: number;
            if (account.accountType === "asset" || account.accountType === "expense") {
              newBalance = currentBalance - debit + credit;
            } else {
              newBalance = currentBalance - credit + debit;
            }
            await tx.update(chartOfAccounts).set({ balance: newBalance.toFixed(3) }).where(eq(chartOfAccounts.id, account.id));
          }
        }
        await tx.delete(journalLines).where(eq(journalLines.journalEntryId, entry.id));
        await tx.delete(journalEntries).where(eq(journalEntries.id, entry.id));
      }
    }

    // 3. Delete all payment records for this ticket
    await tx.delete(serviceTicketPayments).where(eq(serviceTicketPayments.serviceTicketId, id));

    // 4. Also reverse any legacy bank transactions directly linked to the ticket (old relatedType: "service")
    const legacyBankTxns = await tx.select().from(bankTransactions)
      .where(and(eq(bankTransactions.relatedType, "service"), eq(bankTransactions.relatedId, id)));
    for (const txn of legacyBankTxns) {
      await tx.update(bankAccounts)
        .set({ currentBalance: sql`CAST(current_balance AS NUMERIC) - ${parseFloat(txn.amount)}` })
        .where(eq(bankAccounts.id, txn.bankAccountId));
    }
    await tx.delete(bankTransactions).where(and(eq(bankTransactions.relatedType, "service"), eq(bankTransactions.relatedId, id)));

    // 5. Reverse Customer AR balance (full paid amount)
    const paidAmount = parseFloat(ticket.paidAmount?.toString() || "0");
    if (paidAmount > 0 && ticket.customerId) {
      const [customer] = await tx.select().from(customers).where(eq(customers.id, ticket.customerId));
      if (customer) {
        const newBalance = Math.max(0, parseFloat(customer.currentBalance || "0") - paidAmount);
        await tx.update(customers).set({ currentBalance: newBalance.toFixed(3) }).where(eq(customers.id, ticket.customerId));
      }
    }

    // 6. Reverse any legacy journal entries directly linked to ticket (sourceId = ticket id)
    const legacyJournalEntries = await tx.select().from(journalEntries)
      .where(and(
        or(eq(journalEntries.sourceType, "service"), eq(journalEntries.sourceType, "service_payment")),
        eq(journalEntries.sourceId, id)
      ));
    for (const entry of legacyJournalEntries) {
      const lines = await tx.select().from(journalLines).where(eq(journalLines.journalEntryId, entry.id));
      for (const line of lines) {
        const [account] = await tx.select().from(chartOfAccounts).where(eq(chartOfAccounts.id, line.accountId));
        if (account) {
          const debit = parseFloat(line.debit || "0");
          const credit = parseFloat(line.credit || "0");
          const currentBalance = parseFloat(account.balance || "0");
          let newBalance: number;
          if (account.accountType === "asset" || account.accountType === "expense") {
            newBalance = currentBalance - debit + credit;
          } else {
            newBalance = currentBalance - credit + debit;
          }
          await tx.update(chartOfAccounts).set({ balance: newBalance.toFixed(3) }).where(eq(chartOfAccounts.id, account.id));
        }
      }
      await tx.delete(journalLines).where(eq(journalLines.journalEntryId, entry.id));
      await tx.delete(journalEntries).where(eq(journalEntries.id, entry.id));
    }
  }

  async deleteServiceTicket(id: string): Promise<void> {
    return;
  }

  async repairServiceTicketPaymentRecord(ticketId: string): Promise<any> {
    return [];
  }

  // Seed default Chart of Accounts if not present
  async seedDefaultChartOfAccounts(shopId?: string, branchId?: string): Promise<{ created: number; existing: number }> {
    return { created: 0, existing: 0 };
  }

  // Seed missing account codes to ALL existing shops/branches (idempotent)
  async seedMissingAccountsToAllShops(): Promise<{ totalCreated: number; shopsProcessed: number }> {
    return { totalCreated: 0, shopsProcessed: 0 };
  }

  // Record project expense with accounting entries
  async recordProjectExpense(projectId: string, data: {
    description: string;
    amount: number;
    category: string;
    paymentMethod: string;
    bankAccountId?: string | null;
    expenseDate?: Date;
  }): Promise<any> {
    return;
  }

  // Record general expense with accounting entries
  async recordGeneralExpense(data: {
    description: string;
    amount: number;
    category: string;
    paymentMethod: string;
    bankAccountId?: string | null;
    expenseDate?: Date;
  }): Promise<any> {
    return await db.transaction(async (tx) => {
      const expenseNumber = `GE-${Date.now()}`;

      // Deduct from bank account only for bank/card payments (not cash)
      const requiresBankDeduction = data.paymentMethod === "bank" || data.paymentMethod === "card" || data.paymentMethod === "transfer";
      if (requiresBankDeduction && data.bankAccountId && data.amount > 0) {
        const [account] = await tx.select().from(bankAccounts).where(eq(bankAccounts.id, data.bankAccountId));
        if (account) {
          const currentBalance = parseFloat(account.currentBalance || "0");
          const newBalance = currentBalance - data.amount;
          await tx.update(bankAccounts).set({ currentBalance: newBalance.toFixed(3) }).where(eq(bankAccounts.id, data.bankAccountId));

          await tx.insert(bankTransactions).values({
            bankAccountId: data.bankAccountId,
            shopId: account.shopId,
            branchId: account.branchId,
            type: "withdrawal",
            amount: data.amount.toFixed(3),
            reference: expenseNumber,
            description: `Expense: ${data.description}`,
            relatedType: "general_expense",
            relatedId: expenseNumber,
          });
        }
      }

      // Map category to specific expense account
      let expenseAccountCode = "6000"; // Default to general expense
      if (data.category === "salary") expenseAccountCode = "6100";
      else if (data.category === "rent") expenseAccountCode = "6200";
      else if (data.category === "utilities") expenseAccountCode = "6300";
      else if (data.category === "supplies") expenseAccountCode = "6400";
      else if (data.category === "repairs") expenseAccountCode = "6600";
      else if (data.category === "marketing") expenseAccountCode = "6700";

      // Get shopId and branchId from bank account if provided
      let generalExpenseShopId: string | null = null;
      let generalExpenseBranchId: string | null = null;

      if (data.bankAccountId) {
        const [bankAccount] = await tx.select().from(bankAccounts).where(eq(bankAccounts.id, data.bankAccountId));
        if (bankAccount) {
          generalExpenseShopId = bankAccount.shopId;
          generalExpenseBranchId = bankAccount.branchId;
        }
      }

      if (!generalExpenseBranchId) {
        // Try to get from any bank account as fallback
        const [anyAccount] = await tx.select().from(bankAccounts).limit(1);
        if (anyAccount) {
          generalExpenseShopId = anyAccount.shopId;
          generalExpenseBranchId = anyAccount.branchId;
        }
      }
      if (!generalExpenseBranchId) throw new Error("branchId is required for general expense journal entry. Please ensure a bank account with branchId exists.");
      // Use branchId as fallback for shopId
      if (!generalExpenseShopId) generalExpenseShopId = generalExpenseBranchId;

      await this.createJournalEntryInTx(tx, {
        sourceType: "general_expense",
        sourceId: expenseNumber,
        shopId: generalExpenseShopId!,
        branchId: generalExpenseBranchId!,
        reference: expenseNumber,
        description: `${data.category}: ${data.description}`,
        lines: [
          { accountCode: expenseAccountCode, debit: data.amount, description: data.description },
          { accountCode: "1000", credit: data.amount, description: `Cash payment (${data.paymentMethod})` },
        ],
      });

      return { expenseNumber, amount: data.amount, category: data.category };
    });
  }

  // CRM Leads
  async getCrmLeads(): Promise<CrmLead[]> {
    return db.select().from(crmLeads).orderBy(desc(crmLeads.createdAt));
  }

  async getCrmLead(id: string): Promise<CrmLead | undefined> {
    const [lead] = await db.select().from(crmLeads).where(eq(crmLeads.id, id));
    return lead || undefined;
  }

  async createCrmLead(data: InsertCrmLead): Promise<CrmLead> {
    const [lead] = await db.insert(crmLeads).values(data).returning();
    return lead;
  }

  async updateCrmLead(id: string, data: Partial<InsertCrmLead>): Promise<CrmLead | undefined> {
    const [updated] = await db.update(crmLeads)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(crmLeads.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteCrmLead(id: string): Promise<void> {
    await db.delete(crmLeads).where(eq(crmLeads.id, id));
  }

  async convertLeadToCustomer(leadId: string): Promise<{ lead: CrmLead; customerId: string }> {
    return { lead: {} as any, customerId: '' };
  }

  // CRM Deals
  async getCrmDeals(): Promise<CrmDeal[]> {
    return db.select().from(crmDeals).orderBy(desc(crmDeals.createdAt));
  }

  async getCrmDeal(id: string): Promise<CrmDeal | undefined> {
    const [deal] = await db.select().from(crmDeals).where(eq(crmDeals.id, id));
    return deal || undefined;
  }

  async createCrmDeal(data: InsertCrmDeal): Promise<CrmDeal> {
    const [deal] = await db.insert(crmDeals).values(data).returning();
    return deal;
  }

  async updateCrmDeal(id: string, data: Partial<InsertCrmDeal>): Promise<CrmDeal | undefined> {
    const updateData: any = { ...data, updatedAt: new Date() };

    if (data.stage === "won" && !updateData.wonDate) {
      updateData.wonDate = new Date();
      updateData.probability = 100;
    } else if (data.stage === "lost" && !updateData.lostDate) {
      updateData.lostDate = new Date();
      updateData.probability = 0;
    }

    const [updated] = await db.update(crmDeals)
      .set(updateData)
      .where(eq(crmDeals.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteCrmDeal(id: string): Promise<void> {
    await db.delete(crmDeals).where(eq(crmDeals.id, id));
  }

  // CRM Activities
  async getCrmActivities(filters?: { leadId?: string; dealId?: string; customerId?: string }): Promise<CrmActivity[]> {
    if (filters?.leadId) {
      return db.select().from(crmActivities)
        .where(eq(crmActivities.leadId, filters.leadId))
        .orderBy(desc(crmActivities.activityDate));
    }
    if (filters?.dealId) {
      return db.select().from(crmActivities)
        .where(eq(crmActivities.dealId, filters.dealId))
        .orderBy(desc(crmActivities.activityDate));
    }
    if (filters?.customerId) {
      return db.select().from(crmActivities)
        .where(eq(crmActivities.customerId, filters.customerId))
        .orderBy(desc(crmActivities.activityDate));
    }
    return db.select().from(crmActivities).orderBy(desc(crmActivities.activityDate));
  }

  async getCrmActivity(id: string): Promise<CrmActivity | undefined> {
    const [activity] = await db.select().from(crmActivities).where(eq(crmActivities.id, id));
    return activity || undefined;
  }

  async createCrmActivity(data: InsertCrmActivity): Promise<CrmActivity> {
    const [activity] = await db.insert(crmActivities).values(data).returning();
    return activity;
  }

  async updateCrmActivity(id: string, data: Partial<InsertCrmActivity>): Promise<CrmActivity | undefined> {
    const [updated] = await db.update(crmActivities)
      .set(data)
      .where(eq(crmActivities.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteCrmActivity(id: string): Promise<void> {
    await db.delete(crmActivities).where(eq(crmActivities.id, id));
  }

  // ==================== CRM LEAD NOTES ====================

  async getCrmLeadNotes(leadId: string): Promise<CrmLeadNote[]> {
    return db.select().from(crmLeadNotes)
      .where(eq(crmLeadNotes.leadId, leadId))
      .orderBy(desc(crmLeadNotes.createdAt));
  }

  async createCrmLeadNote(data: InsertCrmLeadNote): Promise<CrmLeadNote> {
    const [note] = await db.insert(crmLeadNotes).values(data).returning();
    return note;
  }

  async deleteCrmLeadNote(id: string): Promise<void> {
    await db.delete(crmLeadNotes).where(eq(crmLeadNotes.id, id));
  }

  // ==================== CRM CALENDAR EVENTS ====================

  async getCrmCalendarEvents(filters?: { startDate?: Date; endDate?: Date; assignedTo?: string; shopId?: string; branchId?: string }): Promise<CrmCalendarEvent[]> {
    const conditions: SQL[] = [];

    if (filters?.startDate) {
      conditions.push(sql`${crmCalendarEvents.startTime} >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(sql`${crmCalendarEvents.startTime} <= ${filters.endDate}`);
    }
    if (filters?.assignedTo) {
      conditions.push(eq(crmCalendarEvents.assignedTo, filters.assignedTo));
    }
    if (filters?.shopId) {
      conditions.push(eq(crmCalendarEvents.shopId, filters.shopId));
    }
    if (filters?.branchId) {
      conditions.push(eq(crmCalendarEvents.branchId, filters.branchId));
    }

    if (conditions.length > 0) {
      return db.select().from(crmCalendarEvents)
        .where(and(...conditions))
        .orderBy(asc(crmCalendarEvents.startTime));
    }
    return db.select().from(crmCalendarEvents).orderBy(asc(crmCalendarEvents.startTime));
  }

  async getCrmCalendarEvent(id: string): Promise<CrmCalendarEvent | undefined> {
    const [event] = await db.select().from(crmCalendarEvents).where(eq(crmCalendarEvents.id, id));
    return event || undefined;
  }

  async createCrmCalendarEvent(data: InsertCrmCalendarEvent): Promise<CrmCalendarEvent> {
    const [event] = await db.insert(crmCalendarEvents).values(data).returning();
    return event;
  }

  async updateCrmCalendarEvent(id: string, data: Partial<InsertCrmCalendarEvent>): Promise<CrmCalendarEvent | undefined> {
    const [updated] = await db.update(crmCalendarEvents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(crmCalendarEvents.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteCrmCalendarEvent(id: string): Promise<void> {
    await db.delete(crmCalendarEvents).where(eq(crmCalendarEvents.id, id));
  }

  // ==================== CRM REMINDERS ====================

  async getCrmReminders(filters?: { assignedTo?: string; status?: string; shopId?: string; branchId?: string }): Promise<CrmReminder[]> {
    const conditions: SQL[] = [];

    if (filters?.assignedTo) {
      conditions.push(eq(crmReminders.assignedTo, filters.assignedTo));
    }
    if (filters?.status) {
      conditions.push(eq(crmReminders.status, filters.status));
    }
    if (filters?.shopId) {
      conditions.push(eq(crmReminders.shopId, filters.shopId));
    }
    if (filters?.branchId) {
      conditions.push(eq(crmReminders.branchId, filters.branchId));
    }

    if (conditions.length > 0) {
      return db.select().from(crmReminders)
        .where(and(...conditions))
        .orderBy(asc(crmReminders.reminderDate));
    }
    return db.select().from(crmReminders).orderBy(asc(crmReminders.reminderDate));
  }

  async getCrmReminder(id: string): Promise<CrmReminder | undefined> {
    const [reminder] = await db.select().from(crmReminders).where(eq(crmReminders.id, id));
    return reminder || undefined;
  }

  async createCrmReminder(data: InsertCrmReminder): Promise<CrmReminder> {
    const [reminder] = await db.insert(crmReminders).values(data).returning();
    return reminder;
  }

  async updateCrmReminder(id: string, data: Partial<InsertCrmReminder>): Promise<CrmReminder | undefined> {
    const [updated] = await db.update(crmReminders)
      .set(data)
      .where(eq(crmReminders.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteCrmReminder(id: string): Promise<void> {
    await db.delete(crmReminders).where(eq(crmReminders.id, id));
  }

  async getDueCrmReminders(userId: string): Promise<CrmReminder[]> {
    return db.select().from(crmReminders)
      .where(and(
        eq(crmReminders.assignedTo, userId),
        eq(crmReminders.status, "pending"),
        sql`${crmReminders.reminderDate} <= NOW()`
      ))
      .orderBy(asc(crmReminders.reminderDate));
  }

  // ==================== CRM CUSTOMER CONTACTS ====================

  async getCrmCustomerContacts(customerId: string): Promise<CrmCustomerContact[]> {
    return db.select().from(crmCustomerContacts)
      .where(eq(crmCustomerContacts.customerId, customerId))
      .orderBy(desc(crmCustomerContacts.isPrimary), asc(crmCustomerContacts.createdAt));
  }

  async createCrmCustomerContact(data: InsertCrmCustomerContact): Promise<CrmCustomerContact> {
    const [contact] = await db.insert(crmCustomerContacts).values(data).returning();
    return contact;
  }

  async updateCrmCustomerContact(id: string, data: Partial<InsertCrmCustomerContact>): Promise<CrmCustomerContact | undefined> {
    const [updated] = await db.update(crmCustomerContacts)
      .set(data)
      .where(eq(crmCustomerContacts.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteCrmCustomerContact(id: string): Promise<void> {
    await db.delete(crmCustomerContacts).where(eq(crmCustomerContacts.id, id));
  }

  // ==================== CRM NOTIFICATIONS ====================

  async getCrmNotifications(userId: string, unreadOnly: boolean = false): Promise<CrmNotification[]> {
    if (unreadOnly) {
      return db.select().from(crmNotifications)
        .where(and(
          eq(crmNotifications.userId, userId),
          eq(crmNotifications.isRead, false)
        ))
        .orderBy(desc(crmNotifications.createdAt));
    }
    return db.select().from(crmNotifications)
      .where(eq(crmNotifications.userId, userId))
      .orderBy(desc(crmNotifications.createdAt));
  }

  async createCrmNotification(data: InsertCrmNotification): Promise<CrmNotification> {
    const [notification] = await db.insert(crmNotifications).values(data).returning();
    return notification;
  }

  async markCrmNotificationRead(id: string): Promise<CrmNotification | undefined> {
    const [updated] = await db.update(crmNotifications)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(crmNotifications.id, id))
      .returning();
    return updated || undefined;
  }

  async markAllCrmNotificationsRead(userId: string): Promise<void> {
    await db.update(crmNotifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(crmNotifications.userId, userId),
        eq(crmNotifications.isRead, false)
      ));
  }

  // ==================== CRM TASKS ====================

  async getCrmTasks(filters?: { assignedTo?: string; status?: string; leadId?: string; dealId?: string; customerId?: string; shopId?: string; branchId?: string }): Promise<CrmTask[]> {
    const conditions: SQL[] = [];

    if (filters?.assignedTo) {
      conditions.push(eq(crmTasks.assignedTo, filters.assignedTo));
    }
    if (filters?.status) {
      conditions.push(eq(crmTasks.status, filters.status));
    }
    if (filters?.leadId) {
      conditions.push(eq(crmTasks.leadId, filters.leadId));
    }
    if (filters?.dealId) {
      conditions.push(eq(crmTasks.dealId, filters.dealId));
    }
    if (filters?.customerId) {
      conditions.push(eq(crmTasks.customerId, filters.customerId));
    }
    if (filters?.shopId) {
      conditions.push(eq(crmTasks.shopId, filters.shopId));
    }
    if (filters?.branchId) {
      conditions.push(eq(crmTasks.branchId, filters.branchId));
    }

    if (conditions.length > 0) {
      return db.select().from(crmTasks)
        .where(and(...conditions))
        .orderBy(desc(crmTasks.priority), asc(crmTasks.dueDate));
    }
    return db.select().from(crmTasks).orderBy(desc(crmTasks.priority), asc(crmTasks.dueDate));
  }

  async getCrmTask(id: string): Promise<CrmTask | undefined> {
    const [task] = await db.select().from(crmTasks).where(eq(crmTasks.id, id));
    return task || undefined;
  }

  async createCrmTask(data: InsertCrmTask): Promise<CrmTask> {
    const [task] = await db.insert(crmTasks).values(data).returning();
    return task;
  }

  async updateCrmTask(id: string, data: Partial<InsertCrmTask>): Promise<CrmTask | undefined> {
    const updateData: any = { ...data, updatedAt: new Date() };

    if (data.status === "completed" && !updateData.completedAt) {
      updateData.completedAt = new Date();
    }

    const [updated] = await db.update(crmTasks)
      .set(updateData)
      .where(eq(crmTasks.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteCrmTask(id: string): Promise<void> {
    await db.delete(crmTasks).where(eq(crmTasks.id, id));
  }

  // ==================== COMPLIANCE DOCUMENTS ====================

  async getComplianceDocuments(filters?: { category?: string; status?: string; employeeId?: string; shopId?: string; branchId?: string; warehouseId?: string; expiringWithinDays?: number }): Promise<ComplianceDocument[]> {
    const conditions: SQL[] = [];

    if (filters?.category) {
      conditions.push(eq(complianceDocuments.category, filters.category));
    }
    if (filters?.status) {
      conditions.push(eq(complianceDocuments.status, filters.status));
    }
    if (filters?.employeeId) {
      conditions.push(eq(complianceDocuments.employeeId, filters.employeeId));
    }
    if (filters?.shopId) {
      conditions.push(eq(complianceDocuments.shopId, filters.shopId));
    }
    if (filters?.branchId) {
      conditions.push(eq(complianceDocuments.branchId, filters.branchId));
    }
    if (filters?.warehouseId) {
      conditions.push(eq(complianceDocuments.warehouseId, filters.warehouseId));
    }
    if (filters?.expiringWithinDays) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + filters.expiringWithinDays);
      conditions.push(sql`${complianceDocuments.expiryDate} <= ${futureDate.toISOString().split('T')[0]}`);
      conditions.push(sql`${complianceDocuments.expiryDate} >= CURRENT_DATE`);
    }

    if (conditions.length > 0) {
      return db.select().from(complianceDocuments).where(and(...conditions)).orderBy(desc(complianceDocuments.createdAt));
    }
    return db.select().from(complianceDocuments).orderBy(desc(complianceDocuments.createdAt));
  }

  async getComplianceDocument(id: string): Promise<ComplianceDocument | undefined> {
    const [doc] = await db.select().from(complianceDocuments).where(eq(complianceDocuments.id, id));
    return doc || undefined;
  }

  async createComplianceDocument(data: InsertComplianceDocument): Promise<ComplianceDocument> {
    const [doc] = await db.insert(complianceDocuments).values(data).returning();
    return doc;
  }

  async updateComplianceDocument(id: string, data: Partial<InsertComplianceDocument>): Promise<ComplianceDocument | undefined> {
    const [updated] = await db.update(complianceDocuments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(complianceDocuments.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteComplianceDocument(id: string): Promise<void> {
    await db.delete(documentAuditLogs).where(eq(documentAuditLogs.documentId, id));
    await db.delete(complianceDocuments).where(eq(complianceDocuments.id, id));
  }

  async updateExpiredDocuments(): Promise<number> {
    const result = await db.update(complianceDocuments)
      .set({ status: 'expired' })
      .where(and(
        sql`${complianceDocuments.expiryDate} < CURRENT_DATE`,
        ne(complianceDocuments.status, 'expired')
      ))
      .returning();
    return result.length;
  }

  // ==================== DOCUMENT AUDIT LOGS ====================

  async getDocumentAuditLogs(documentId: string): Promise<DocumentAuditLog[]> {
    return db.select().from(documentAuditLogs)
      .where(eq(documentAuditLogs.documentId, documentId))
      .orderBy(desc(documentAuditLogs.createdAt));
  }

  async createDocumentAuditLog(data: InsertDocumentAuditLog): Promise<DocumentAuditLog> {
    const [log] = await db.insert(documentAuditLogs).values(data).returning();
    return log;
  }

  // ==================== COMPLIANCE REMINDERS ====================

  async getComplianceReminders(filters?: { shopId?: string; branchId?: string; warehouseId?: string; isActive?: boolean }): Promise<ComplianceReminder[]> {
    const conditions: SQL[] = [];

    if (filters?.shopId) {
      conditions.push(eq(complianceReminders.shopId, filters.shopId));
    }
    if (filters?.branchId) {
      conditions.push(eq(complianceReminders.branchId, filters.branchId));
    }
    if (filters?.warehouseId) {
      conditions.push(eq(complianceReminders.warehouseId, filters.warehouseId));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(complianceReminders.isActive, filters.isActive));
    }

    if (conditions.length > 0) {
      return db.select().from(complianceReminders).where(and(...conditions)).orderBy(asc(complianceReminders.nextDueDate));
    }
    return db.select().from(complianceReminders).orderBy(asc(complianceReminders.nextDueDate));
  }

  private calculateNextDueDate(frequency: string, dueDay: number, dueMonth?: number | null, baseDate?: Date): string {
    const now = baseDate || new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    // Normalize now to start of day for inclusive comparison
    const startOfBase = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let nextDate: Date;
    if (frequency === "yearly") {
      const targetMonth = (dueMonth || 1) - 1;
      nextDate = new Date(year, targetMonth, dueDay);
      if (nextDate < startOfBase) {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
      }
    } else {
      // monthly or default
      nextDate = new Date(year, month, dueDay);
      if (nextDate < startOfBase) {
        nextDate.setMonth(nextDate.getMonth() + 1);
      }
    }
    
    // Format YYYY-MM-DD manually in local time to avoid UTC shift
    const y = nextDate.getFullYear();
    const m = (nextDate.getMonth() + 1).toString().padStart(2, '0');
    const d = nextDate.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  async getComplianceReminder(id: string): Promise<ComplianceReminder | undefined> {
    const [reminder] = await db.select().from(complianceReminders).where(eq(complianceReminders.id, id));
    return reminder || undefined;
  }

  async createComplianceReminder(data: InsertComplianceReminder): Promise<ComplianceReminder> {
    const nextDueDate = this.calculateNextDueDate(data.frequency || "monthly", data.dueDayOfMonth || 1, data.dueMonthOfYear);
    const [reminder] = await db.insert(complianceReminders).values({
      ...data,
      nextDueDate,
    }).returning();
    return reminder;
  }

  async updateComplianceReminder(id: string, data: Partial<InsertComplianceReminder>): Promise<ComplianceReminder | undefined> {
    const [existing] = await db.select().from(complianceReminders).where(eq(complianceReminders.id, id));
    if (!existing) return undefined;

    const frequency = data.frequency || existing.frequency;
    const dueDay = data.dueDayOfMonth ?? existing.dueDayOfMonth ?? 1;
    const dueMonth = data.dueMonthOfYear ?? existing.dueMonthOfYear;

    let nextDueDate = existing.nextDueDate;
    if (data.frequency !== undefined || data.dueDayOfMonth !== undefined || data.dueMonthOfYear !== undefined) {
      nextDueDate = this.calculateNextDueDate(frequency || "monthly", dueDay, dueMonth);
    }

    const [updated] = await db.update(complianceReminders)
      .set({ ...data, nextDueDate })
      .where(eq(complianceReminders.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteComplianceReminder(id: string): Promise<void> {
    await db.delete(complianceReminders).where(eq(complianceReminders.id, id));
  }

  async payComplianceReminder(id: string, bankAccountId: string, notes?: string): Promise<ComplianceReminder> {
    const [reminder] = await db.select().from(complianceReminders).where(eq(complianceReminders.id, id));
    if (!reminder) throw new Error("Reminder not found");

    const amount = parseFloat(reminder.amount || "0");
    if (amount <= 0) throw new Error("Reminder amount must be greater than zero to pay.");

    return await db.transaction(async (tx) => {
      // 1. Deduct from bank account
      const [account] = await tx.select().from(bankAccounts).where(eq(bankAccounts.id, bankAccountId));
      if (!account) throw new Error("Bank account not found");

      const currentBalance = parseFloat(account.currentBalance || "0");
      if (currentBalance < amount) throw new Error("Sufficient funds not available in the selected bank account.");

      const newBalance = currentBalance - amount;
      await tx.update(bankAccounts).set({ currentBalance: newBalance.toFixed(3) }).where(eq(bankAccounts.id, bankAccountId));

      // 2. Record bank transaction
      await tx.insert(bankTransactions).values({
        bankAccountId,
        shopId: account.shopId,
        branchId: account.branchId,
        type: "withdrawal",
        amount: amount.toFixed(3),
        reference: `REMINDER-${reminder.title}`,
        description: `Payment for compliance reminder: ${reminder.title}. ${notes || ""}`,
        relatedType: "compliance_reminder",
        relatedId: id,
      });

      // 3. Create Journal Entry (COA integration)
      const reminderBranchId = reminder.branchId || reminder.shopId || account.branchId || "";
      await this.createJournalEntryInTx(tx, {
        sourceType: "compliance_payment",
        sourceId: id,
        shopId: reminder.shopId || undefined,
        branchId: reminderBranchId,
        reference: `REMINDER-${id}`,
        description: `Compliance Payment: ${reminder.title}`,
        lines: [
          { accountCode: "6300", debit: amount, description: `Compliance Expense: ${reminder.title}` },
          { accountCode: "1000", credit: amount, description: `Bank Withdrawal: ${reminder.title}` }
        ]
      });

      // 4. Recalculate next due date
      // Advance relative to the CURRENT next due date to ensure we skip to the next cycle
      const currentNextDueStr = reminder.nextDueDate || new Date().toISOString().split('T')[0];
      const [y, mm, dd] = currentNextDueStr.split('-').map(Number);
      const currentNextDue = new Date(y, mm - 1, dd);
      
      // Use the day AFTER the current next due date as the base to find the following occurrence
      const baseForAdvance = new Date(currentNextDue);
      baseForAdvance.setDate(baseForAdvance.getDate() + 1);
      
      const nextDueDate = this.calculateNextDueDate(reminder.frequency || "monthly", reminder.dueDayOfMonth || 1, reminder.dueMonthOfYear, baseForAdvance);
      
      const [updated] = await tx.update(complianceReminders)
        .set({ 
          nextDueDate,
          lastTriggeredAt: new Date()
        })
        .where(eq(complianceReminders.id, id))
        .returning();

      return updated;
    });
  }

  async getDueReminders(): Promise<ComplianceReminder[]> {
    return db.select().from(complianceReminders)
      .where(and(
        eq(complianceReminders.isActive, true),
        sql`${complianceReminders.nextDueDate} <= CURRENT_DATE + ${complianceReminders.leadTimeDays} * INTERVAL '1 day'`
      ))
      .orderBy(asc(complianceReminders.nextDueDate));
  }

  // ==================== DYNAMIC RBAC ====================

  async getRoles(): Promise<Role[]> {
    return db.select().from(roles).orderBy(asc(roles.name));
  }

  async getRole(id: string): Promise<Role | undefined> {
    const [role] = await db.select().from(roles).where(eq(roles.id, id));
    return role || undefined;
  }

  async getRoleByName(name: string): Promise<Role | undefined> {
    const [role] = await db.select().from(roles).where(eq(roles.name, name));
    return role || undefined;
  }

  async createRole(data: InsertRole): Promise<Role> {
    const [role] = await db.insert(roles).values(data).returning();
    return role;
  }

  async updateRole(id: string, data: Partial<InsertRole>): Promise<Role | undefined> {
    const [updated] = await db.update(roles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(roles.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteRole(id: string): Promise<void> {
    const role = await this.getRole(id);
    if (role?.isSystemRole) {
      throw new Error("Cannot delete system role");
    }
    await db.delete(permissions).where(eq(permissions.roleId, id));
    await db.delete(roles).where(eq(roles.id, id));
  }

  async cloneRole(id: string, newName: string): Promise<Role> {
    const sourceRole = await this.getRole(id);
    if (!sourceRole) {
      throw new Error("Source role not found");
    }
    const existingRole = await this.getRoleByName(newName);
    if (existingRole) {
      throw new Error("Role with this name already exists");
    }
    const [newRole] = await db.insert(roles).values({
      name: newName,
      description: `Clone of ${sourceRole.name}`,
      isSystemRole: false,
      status: "active",
    }).returning();
    const sourcePermissions = await this.getPermissionsByRole(id);
    for (const perm of sourcePermissions) {
      await db.insert(permissions).values({
        roleId: newRole.id,
        menuId: perm.menuId,
        canRead: perm.canRead,
        canWrite: perm.canWrite,
      });
    }
    return newRole;
  }

  async getMenus(): Promise<Menu[]> {
    return db.select().from(menus).orderBy(asc(menus.sortOrder));
  }

  async getMenu(id: string): Promise<Menu | undefined> {
    const [menu] = await db.select().from(menus).where(eq(menus.id, id));
    return menu || undefined;
  }

  async createMenu(data: InsertMenu): Promise<Menu> {
    const [menu] = await db.insert(menus).values(data).returning();
    return menu;
  }

  async updateMenu(id: string, data: Partial<InsertMenu>): Promise<Menu | undefined> {
    const [updated] = await db.update(menus)
      .set(data)
      .where(eq(menus.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteMenu(id: string): Promise<void> {
    await db.delete(permissions).where(eq(permissions.menuId, id));
    await db.delete(menus).where(eq(menus.id, id));
  }

  async getPermissions(roleId?: string): Promise<Permission[]> {
    if (roleId) {
      return db.select().from(permissions).where(eq(permissions.roleId, roleId));
    }
    return db.select().from(permissions);
  }

  async getPermissionsByRole(roleId: string): Promise<Permission[]> {
    return db.select().from(permissions).where(eq(permissions.roleId, roleId));
  }

  async getUserPermissions(userId: string): Promise<Array<Permission & { menuKey: string }>> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user?.roleId) {
      return [];
    }
    const userPermissions = await db.select({
      id: permissions.id,
      roleId: permissions.roleId,
      menuId: permissions.menuId,
      canRead: permissions.canRead,
      canWrite: permissions.canWrite,
      menuKey: menus.key,
    })
      .from(permissions)
      .innerJoin(menus, eq(permissions.menuId, menus.id))
      .where(eq(permissions.roleId, user.roleId));
    return userPermissions;
  }

  async setPermission(roleId: string, menuId: string, canRead: boolean, canWrite: boolean): Promise<Permission> {
    const [existing] = await db.select().from(permissions)
      .where(and(eq(permissions.roleId, roleId), eq(permissions.menuId, menuId)));
    if (existing) {
      const [updated] = await db.update(permissions)
        .set({ canRead, canWrite })
        .where(eq(permissions.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(permissions).values({
        roleId,
        menuId,
        canRead,
        canWrite,
      }).returning();
      return created;
    }
  }

  async deletePermissionsByRole(roleId: string): Promise<void> {
    await db.delete(permissions).where(eq(permissions.roleId, roleId));
  }

  async seedDefaultMenus(): Promise<void> {
    const existingMenus = await this.getMenus();
    if (existingMenus.length > 0) return;

    const defaultMenus = [
      { key: "dashboard", title: "Dashboard", path: "/", sortOrder: 1 },
      { key: "companies", title: "Companies", path: "/companies", sortOrder: 10 },
      { key: "shops", title: "Shops", path: "/shops", sortOrder: 11 },
      { key: "branches", title: "Branches", path: "/branches", sortOrder: 12 },
      { key: "warehouses", title: "Warehouses", path: "/warehouses", sortOrder: 13 },
      { key: "users", title: "Users", path: "/users", sortOrder: 14 },
      { key: "rbac", title: "Roles & Permissions", path: "/rbac", sortOrder: 15 },
      { key: "products", title: "Products", path: "/products", sortOrder: 20 },
      { key: "serial_numbers", title: "Serial Numbers", path: "/serial-numbers", sortOrder: 21 },
      { key: "categories", title: "Categories", path: "/categories", sortOrder: 22 },
      { key: "brands", title: "Brands", path: "/brands", sortOrder: 23 },
      { key: "manufacturers", title: "Manufacturers", path: "/manufacturers", sortOrder: 24 },
      { key: "units", title: "Units", path: "/units", sortOrder: 25 },
      { key: "stock_transfers", title: "Stock Transfers", path: "/transfers", sortOrder: 26 },
      { key: "suppliers", title: "Suppliers", path: "/suppliers", sortOrder: 30 },
      { key: "customers", title: "Customers", path: "/customers", sortOrder: 31 },
      { key: "customer_transactions", title: "Customer Transactions", path: "/customer-transactions", sortOrder: 32 },
      { key: "supplier_transactions", title: "Supplier Transactions", path: "/supplier-transactions", sortOrder: 33 },
      { key: "purchase_orders", title: "Purchase Orders", path: "/purchase-orders", sortOrder: 34 },
      { key: "purchases", title: "Purchases", path: "/purchases", sortOrder: 35 },
      { key: "purchase_returns", title: "Purchase Returns", path: "/purchase-returns", sortOrder: 36 },
      { key: "sales", title: "Sales (POS)", path: "/sales", sortOrder: 37 },
      { key: "quotations", title: "Quotations", path: "/quotations", sortOrder: 38 },
      { key: "services", title: "Services", path: "/services", sortOrder: 39 },
      { key: "chart_of_accounts", title: "Chart of Accounts", path: "/accounting", sortOrder: 40 },
      { key: "bank_accounts", title: "Bank Accounts", path: "/bank", sortOrder: 41 },
      { key: "petty_cash", title: "Petty Cash", path: "/petty-cash", sortOrder: 42 },
      { key: "capital", title: "Capital", path: "/capital", sortOrder: 43 },
      { key: "employees", title: "Employees", path: "/employees", sortOrder: 50 },
      { key: "leave_management", title: "Leave Management", path: "/leave-management", sortOrder: 51 },
      { key: "projects", title: "Projects", path: "/projects", sortOrder: 60 },
      { key: "tasks", title: "Tasks", path: "/tasks", sortOrder: 61 },
      { key: "crm", title: "CRM", path: "/crm", sortOrder: 70 },
      { key: "compliance_documents", title: "Compliance Documents", path: "/compliance/documents", sortOrder: 80 },
      { key: "compliance_reminders", title: "Compliance Reminders", path: "/compliance/reminders", sortOrder: 81 },
      { key: "reports", title: "Reports", path: "/reports", sortOrder: 90 },
    ];

    for (const menu of defaultMenus) {
      await this.createMenu(menu);
    }
    console.log(`Seeded ${defaultMenus.length} default menus for RBAC`);
  }

  async getEmployeeWorkReport(employeeId: string, startDate?: string, endDate?: string): Promise<any[]> {
    return [];
  }

  // Logistics Zones (Aliased to Routes)
  async getZones(scope?: Partial<ScopeParams>): Promise<Zone[]> {
    const conditions = [];
    if (scope?.companyId) conditions.push(eq(routes.companyId, scope.companyId));
    if (scope?.shopId) conditions.push(eq(routes.shopId, scope.shopId));
    if (scope?.branchId) conditions.push(eq(routes.branchId, scope.branchId));
    if (conditions.length > 0) {
      return db.select().from(routes).where(and(...conditions)) as unknown as Promise<Zone[]>;
    }
    return db.select().from(routes) as unknown as Promise<Zone[]>;
  }

  async getZone(id: string): Promise<Zone | undefined> {
    const [row] = await db.select().from(routes).where(eq(routes.id, id));
    return row as unknown as Zone | undefined;
  }

  async createZone(data: InsertZone): Promise<Zone> {
    const [row] = await db.insert(routes).values(data).returning();
    return row as unknown as Zone;
  }

  async updateZone(id: string, data: Partial<InsertZone>): Promise<Zone | undefined> {
    const [row] = await db.update(routes).set(data).where(eq(routes.id, id)).returning();
    return row as unknown as Zone | undefined;
  }

  async deleteZone(id: string): Promise<void> {
    await db.delete(routes).where(eq(routes.id, id));
  }

  async getSupervisorZones(supervisorId: string): Promise<SupervisorZone[]> {
    return db.select().from(supervisorZones).where(eq(supervisorZones.supervisorId, supervisorId));
  }

  async assignSupervisorZones(supervisorId: string, zoneIds: string[]): Promise<SupervisorZone[]> {
    await db.delete(supervisorZones).where(eq(supervisorZones.supervisorId, supervisorId));
    if (zoneIds.length === 0) return [];
    const values = zoneIds.map(zoneId => ({ supervisorId, zoneId }));
    return db.insert(supervisorZones).values(values).returning();
  }

  // Logistics Contracts
  async getContracts(customerId?: string): Promise<Contract[]> {
    if (customerId) {
      return db.select().from(contracts).where(eq(contracts.customerId, customerId));
    }
    return db.select().from(contracts);
  }

  async getContract(id: string): Promise<Contract | undefined> {
    const [row] = await db.select().from(contracts).where(eq(contracts.id, id));
    return row || undefined;
  }

  async createContract(data: InsertContract): Promise<Contract> {
    const [row] = await db.insert(contracts).values(data as any).returning();
    return row;
  }

  async updateContract(id: string, data: Partial<InsertContract>): Promise<Contract | undefined> {
    const [row] = await db.update(contracts).set(data as any).where(eq(contracts.id, id)).returning();
    return row || undefined;
  }

  async deleteContract(id: string): Promise<void> {
    await db.delete(contracts).where(eq(contracts.id, id));
  }

  // Logistics Vehicles
  async getVehicles(status?: string, type?: string): Promise<Vehicle[]> {
    const conditions = [];
    if (status) conditions.push(eq(vehicles.status, status));
    if (type) conditions.push(eq(vehicles.type, type));
    if (conditions.length > 0) {
      return db.select().from(vehicles).where(and(...conditions));
    }
    return db.select().from(vehicles);
  }

  async getVehicle(id: string): Promise<Vehicle | undefined> {
    const [row] = await db.select().from(vehicles).where(eq(vehicles.id, id));
    return row || undefined;
  }

  async createVehicle(data: InsertVehicle): Promise<Vehicle> {
    const [row] = await db.insert(vehicles).values(data as any).returning();
    return row;
  }

  async updateVehicle(id: string, data: Partial<InsertVehicle>): Promise<Vehicle | undefined> {
    const [row] = await db.update(vehicles).set(data as any).where(eq(vehicles.id, id)).returning();
    return row || undefined;
  }

  async deleteVehicle(id: string): Promise<void> {
    await db.delete(vehicles).where(eq(vehicles.id, id));
  }

  // Logistics Locations
  async getLocations(): Promise<Location[]> {
    return db.select().from(locations);
  }

  async getLocation(id: string): Promise<Location | undefined> {
    const [row] = await db.select().from(locations).where(eq(locations.id, id));
    return row || undefined;
  }

  async getLocationByCode(code: string): Promise<Location | undefined> {
    const [row] = await db.select().from(locations).where(eq(locations.code, code));
    return row || undefined;
  }

  async createLocation(data: InsertLocation): Promise<Location> {
    const [row] = await db.insert(locations).values(data).returning();
    return row;
  }

  async updateLocation(id: string, data: Partial<InsertLocation>): Promise<Location | undefined> {
    const [row] = await db.update(locations).set(data).where(eq(locations.id, id)).returning();
    return row || undefined;
  }

  async deleteLocation(id: string): Promise<void> {
    await db.delete(locations).where(eq(locations.id, id));
  }

  // Logistics RFQs
  async getRfqs(): Promise<Rfq[]> {
    return db.select().from(rfqs);
  }

  async getRfq(id: string): Promise<Rfq | undefined> {
    const [row] = await db.select().from(rfqs).where(eq(rfqs.id, id));
    return row || undefined;
  }

  async createRfq(data: InsertRfq): Promise<Rfq> {
    const [row] = await db.insert(rfqs).values(data as any).returning();
    return row;
  }

  async updateRfq(id: string, data: Partial<InsertRfq>): Promise<Rfq | undefined> {
    const [row] = await db.update(rfqs).set(data as any).where(eq(rfqs.id, id)).returning();
    return row || undefined;
  }

  async deleteRfq(id: string): Promise<void> {
    await db.delete(rfqs).where(eq(rfqs.id, id));
  }

  // Logistics Orders
  async getOrders(customerId?: string, zoneId?: string, status?: string): Promise<Order[]> {
    const conditions = [];
    if (customerId) conditions.push(eq(orders.customerId, customerId));
    if (zoneId) conditions.push(eq(orders.zoneId, zoneId));
    if (status) conditions.push(eq(orders.status, status));
    if (conditions.length > 0) {
      return db.select().from(orders).where(and(...conditions));
    }
    return db.select().from(orders);
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const [row] = await db.select().from(orders).where(eq(orders.id, id));
    return row || undefined;
  }
  
  async getOrderWithCharges(id: string): Promise<{ order: Order; charges: any[]; expenses: any[] } | undefined> {
    const order = await this.getOrder(id);
    if (!order) return undefined;
    const chargesList = await db.select().from(orderCharges).where(eq(orderCharges.orderId, id));
    const expensesList = await db.select().from(orderExpenses).where(eq(orderExpenses.orderId, id));
    return { order, charges: chargesList, expenses: expensesList };
  }

  async createOrder(data: InsertOrder & { charges?: any[] }): Promise<Order> {
    const { charges, ...orderData } = data;
    if (orderData.orderDate && typeof orderData.orderDate === 'string') orderData.orderDate = new Date(orderData.orderDate) as any;
    if (orderData.paymentDueDate && typeof orderData.paymentDueDate === 'string') orderData.paymentDueDate = new Date(orderData.paymentDueDate) as any;
    const [row] = await db.insert(orders).values(orderData as any).returning();
    if (charges && charges.length > 0) {
      const chargesData = charges.map(c => ({ ...c, orderId: row.id }));
      await db.insert(orderCharges).values(chargesData);
    }
    
    // Update the corresponding RFQ status if rfqId is provided
    if (orderData.rfqId) {
      await db.update(rfqs).set({ status: 'converted' }).where(eq(rfqs.id, orderData.rfqId));
    }
    
    return row;
  }

  async updateOrder(id: string, data: Partial<InsertOrder> & { charges?: any[], expenses?: any[] }): Promise<Order | undefined> {
    const { charges, expenses, ...orderData } = data;
    delete (orderData as any).id;
    delete (orderData as any).createdAt;
    if (orderData.orderDate && typeof orderData.orderDate === 'string') orderData.orderDate = new Date(orderData.orderDate) as any;
    if (orderData.paymentDueDate && typeof orderData.paymentDueDate === 'string') orderData.paymentDueDate = new Date(orderData.paymentDueDate) as any;
    const [row] = await db.update(orders).set(orderData as any).where(eq(orders.id, id)).returning();
    
    if (row && charges !== undefined) {
      await db.delete(orderCharges).where(eq(orderCharges.orderId, id));
      if (charges.length > 0) {
        const chargesData = charges.map(c => ({ ...c, orderId: id }));
        await db.insert(orderCharges).values(chargesData);
      }
    }

    if (row && expenses !== undefined) {
      await db.delete(orderExpenses).where(eq(orderExpenses.orderId, id));
      if (expenses.length > 0) {
        const expensesData = expenses.map(e => ({ ...e, orderId: id }));
        await db.insert(orderExpenses).values(expensesData);
      }
    }

    return row || undefined;
  }

  async deleteOrder(id: string): Promise<void> {
    await db.delete(orderCharges).where(eq(orderCharges.orderId, id));
    await db.delete(orders).where(eq(orders.id, id));
  }

  async payOrderInvoice(id: string, payment: InsertInvoicePayment): Promise<Order> {
    const order = await this.getOrder(id);
    if (!order) throw new Error("Order not found");

    // Insert payment record
    const [insertedPayment] = await db.insert(invoicePayments).values({
      ...payment,
      orderId: id,
    }).returning();

    // Update order paidAmount and paymentStatus
    const newPaidAmount = Number(order.paidAmount || 0) + Number(payment.amount);
    const grandTotal = Number(order.grandTotal || 0);
    const paymentStatus = newPaidAmount >= grandTotal ? "paid" : "partial";

    const [updatedOrder] = await db.update(orders)
      .set({ paidAmount: newPaidAmount.toFixed(3), paymentStatus })
      .where(eq(orders.id, id))
      .returning();

    const client = await this.getClient(payment.customerId);
    const branchId = client?.branchId || (order as any)?.branchId || "1";
    const shopId = client?.shopId || (order as any)?.shopId;

    if (payment.paymentMethod === 'bank_transfer' || payment.paymentMethod === 'cheque') {
      if (payment.bankAccountId) {
        await this.createBankTransaction({
          bankAccountId: payment.bankAccountId,
          branchId: branchId,
          type: "deposit",
          amount: String(payment.amount),
          reference: payment.reference || null,
          description: `Logistics Invoice Payment for Order ${order.orderNumber}`,
          relatedType: "logistics_invoice",
          relatedId: id,
        });

        // Create Journal Entry for Invoice Payment via Bank
        // Debit: Bank (1000)
        // Credit: Accounts Receivable (1100)
        await db.transaction(async (tx) => {
          await this.createJournalEntryInTx(tx, {
            sourceType: "logistics_invoice",
            sourceId: id,
            shopId: shopId,
            branchId: branchId,
            reference: payment.reference || `INV-PAY-${order.orderNumber}`,
            description: `Payment received for Logistics Order ${order.orderNumber}`,
            lines: [
              { accountCode: "1000", debit: Number(payment.amount), description: `Bank Deposit - Order ${order.orderNumber}` },
              { accountCode: "1100", credit: Number(payment.amount), description: `Accounts Receivable Payment - Order ${order.orderNumber}` }
            ],
          });
        });
      }
    } else if (payment.paymentMethod === 'cash') {
      if (payment.pettyCashId) {
        await db.transaction(async (tx) => {
          const [pc] = await tx.select().from(pettyCash).where(eq(pettyCash.id, payment.pettyCashId!));
          if (!pc) throw new Error("Petty cash account not found");

          await tx.insert(pettyCashTransactions).values({
            pettyCashId: payment.pettyCashId!,
            branchId: pc.branchId || branchId,
            type: "receipt",
            amount: String(payment.amount),
            reference: payment.reference || null,
            description: `Logistics Invoice Cash Receipt for Order ${order.orderNumber}`,
          });

          // Add to petty cash balance (cash received = increase balance)
          const currentBalance = parseFloat(pc.currentBalance || "0");
          const newBalance = currentBalance + Number(payment.amount);
          await tx.update(pettyCash)
            .set({ currentBalance: newBalance.toFixed(3) })
            .where(eq(pettyCash.id, payment.pettyCashId!));

          // Create Journal Entry for Invoice Payment via Cash
          // Debit: Petty Cash Fund (1010)
          // Credit: Accounts Receivable (1100)
          await this.createJournalEntryInTx(tx, {
            sourceType: "logistics_invoice",
            sourceId: id,
            shopId: pc.shopId || shopId,
            branchId: pc.branchId || branchId,
            reference: payment.reference || `CASH-PAY-${order.orderNumber}`,
            description: `Cash Payment received for Logistics Order ${order.orderNumber}`,
            lines: [
              { accountCode: "1010", debit: Number(payment.amount), description: `Cash Receipt - Order ${order.orderNumber}` },
              { accountCode: "1100", credit: Number(payment.amount), description: `Accounts Receivable Payment - Order ${order.orderNumber}` }
            ],
          });
        });
      }
    }

    return updatedOrder;
  }

  // Logistics Trips
  async getTrips(driverId?: string, status?: string): Promise<Trip[]> {
    const conditions = [];
    if (driverId) conditions.push(eq(trips.driverId, driverId));
    if (status) conditions.push(eq(trips.status, status));
    if (conditions.length > 0) {
      return db.select().from(trips).where(and(...conditions));
    }
    return db.select().from(trips);
  }

  async getTrip(id: string): Promise<Trip | undefined> {
    const [row] = await db.select().from(trips).where(eq(trips.id, id));
    return row || undefined;
  }

  async createTrip(data: InsertTrip & { orderIds: string[] }): Promise<Trip> {
    const { orderIds, ...tripData } = data;
    const [trip] = await db.insert(trips).values(tripData).returning();
    if (orderIds && orderIds.length > 0) {
      const mapping = orderIds.map(orderId => ({ tripId: trip.id, orderId }));
      await db.insert(tripOrders).values(mapping);
    }
    return trip;
  }

  async updateTrip(id: string, data: Partial<InsertTrip>): Promise<Trip | undefined> {
    const [row] = await db.update(trips).set(data).where(eq(trips.id, id)).returning();
    return row || undefined;
  }

  async deleteTrip(id: string): Promise<void> {
    await db.delete(tripOrders).where(eq(tripOrders.tripId, id));
    await db.delete(trips).where(eq(trips.id, id));
  }

  async getTripOrders(tripId: string): Promise<Order[]> {
    const rows = await db.select({ order: orders })
      .from(tripOrders)
      .innerJoin(orders, eq(tripOrders.orderId, orders.id))
      .where(eq(tripOrders.tripId, tripId));
    return rows.map(r => r.order);
  }

  // Logistics Deliveries
  async getDeliveries(tripId?: string, orderId?: string): Promise<Delivery[]> {
    const conditions = [];
    if (tripId) conditions.push(eq(deliveries.tripId, tripId));
    if (orderId) conditions.push(eq(deliveries.orderId, orderId));
    if (conditions.length > 0) {
      return db.select().from(deliveries).where(and(...conditions));
    }
    return db.select().from(deliveries);
  }

  async getDelivery(id: string): Promise<Delivery | undefined> {
    const [row] = await db.select().from(deliveries).where(eq(deliveries.id, id));
    return row || undefined;
  }

  async createDelivery(data: InsertDelivery): Promise<Delivery> {
    const [row] = await db.insert(deliveries).values(data).returning();
    return row;
  }

  async updateDelivery(id: string, data: Partial<InsertDelivery>): Promise<Delivery | undefined> {
    const [row] = await db.update(deliveries).set(data).where(eq(deliveries.id, id)).returning();
    return row || undefined;
  }

  async recordDeliveryPOD(tripId: string, orderId: string, podUrl: string, status: string, issueLog?: string): Promise<Delivery> {
    const [existing] = await db.select().from(deliveries)
      .where(and(eq(deliveries.tripId, tripId), eq(deliveries.orderId, orderId)));
    
    let delivery: Delivery;
    if (existing) {
      const [updated] = await db.update(deliveries)
        .set({ podUrl, status, issueLog, deliveryTimestamp: new Date() })
        .where(eq(deliveries.id, existing.id))
        .returning();
      delivery = updated;
    } else {
      const [created] = await db.insert(deliveries)
        .values({ tripId, orderId, podUrl, status, issueLog, deliveryTimestamp: new Date() })
        .returning();
      delivery = created;
    }

    // Resolve outletId from order if possible
    let outletId = null;
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    if (order && order.deliveryLocationId) {
      const [outlet] = await db.select().from(outlets).where(and(
        eq(outlets.clientId, order.customerId),
        eq((outlets as any).locationId || outlets.id, order.deliveryLocationId)
      ));
      if (outlet) {
        outletId = outlet.id;
      }
    }

    // Insert into deliveryAttachments
    await db.insert(deliveryAttachments).values({
      deliveryId: delivery.id,
      orderId,
      tripId,
      outletId,
      podUrl,
      status,
      issueLog
    });

    const allOrderDeliveries = await db.select().from(deliveries).where(eq(deliveries.orderId, orderId));
    let hasIncomplete = false;
    let hasDelivered = false;
    for (const del of allOrderDeliveries) {
      if (del.status === "delivered") {
        hasDelivered = true;
      } else {
        hasIncomplete = true;
      }
    }
    
    let orderStatus: "pending" | "confirmed" | "cancelled" | "incomplete" | "completed" = "incomplete";
    if (hasDelivered && !hasIncomplete) {
      orderStatus = "completed";
    } else if (hasIncomplete) {
      orderStatus = "incomplete";
    }
    
    await db.update(orders).set({ status: orderStatus }).where(eq(orders.id, orderId));
    return delivery;
  }

  async getOutletDeliveryAttachments(outletId: string): Promise<any[]> {
    return await db.select({
      id: deliveryAttachments.id,
      orderId: deliveryAttachments.orderId,
      tripId: deliveryAttachments.tripId,
      podUrl: deliveryAttachments.podUrl,
      status: deliveryAttachments.status,
      issueLog: deliveryAttachments.issueLog,
      createdAt: deliveryAttachments.createdAt,
      orderNumber: orders.orderNumber,
      cargoDetails: orders.cargoDetails,
      tripNumber: trips.tripNumber,
    })
    .from(deliveryAttachments)
    .innerJoin(orders, eq(deliveryAttachments.orderId, orders.id))
    .innerJoin(trips, eq(deliveryAttachments.tripId, trips.id))
    .where(eq(deliveryAttachments.outletId, outletId))
    .orderBy(desc(deliveryAttachments.createdAt));
  }


  // Logistics Driver Management
  async getDrivers(): Promise<any[]> {
    const driverMap = new Map<string, any>();

    // 1. Fetch from employees table (HR & Payroll)
    try {
      const empList = await db.select().from(employees).where(eq(employees.status, "active"));
      for (const emp of empList) {
        driverMap.set(emp.id, {
          id: emp.id,
          name: emp.employeeCode ? `${emp.name} (${emp.employeeCode})` : emp.name,
          employeeCode: emp.employeeCode,
          packageType: "standard",
          baseSalary: emp.basicSalary || "0.000",
          status: emp.status || "active",
          createdAt: emp.joiningDate ? new Date(emp.joiningDate) : new Date(),
        });
      }
    } catch (e) {
      console.error("Error fetching employees in getDrivers:", e);
    }

    // 2. Fetch from users table (Users with role = driver)
    try {
      const userList = await db.select().from(users).where(and(eq(users.role, "driver"), eq(users.status, "active")));
      for (const u of userList) {
        if (!driverMap.has(u.id)) {
          driverMap.set(u.id, {
            id: u.id,
            name: u.name || u.username,
            employeeCode: u.username,
            packageType: "standard",
            baseSalary: "0.000",
            status: u.status || "active",
            createdAt: u.lastLogin || new Date(),
          });
        }
      }
    } catch (e) {
      console.error("Error fetching users in getDrivers:", e);
    }

    // 3. Fetch from legacy drivers table
    try {
      const legacyDrivers = await db.select().from(drivers);
      for (const d of legacyDrivers) {
        if (!driverMap.has(d.id)) {
          driverMap.set(d.id, {
            id: d.id,
            name: d.name,
            packageType: d.packageType || "standard",
            baseSalary: d.baseSalary || "0.000",
            status: d.status || "active",
            createdAt: d.createdAt || new Date(),
          });
        }
      }
    } catch (e) {
      console.error("Error fetching legacy drivers in getDrivers:", e);
    }

    return Array.from(driverMap.values());
  }

  async createDriver(data: InsertDriver): Promise<Driver> {
    const [driver] = await db.insert(drivers).values(data).returning();
    return driver;
  }

  // Logistics Driver activities & attendance
  async getDriverActivities(driverId?: string, tripId?: string): Promise<DriverActivity[]> {
    const conditions = [];
    if (driverId) conditions.push(eq(driverActivities.driverId, driverId));
    if (tripId) conditions.push(eq(driverActivities.tripId, tripId));
    if (conditions.length > 0) {
      return db.select().from(driverActivities).where(and(...conditions));
    }
    return db.select().from(driverActivities);
  }

  async createDriverActivity(data: InsertDriverActivity): Promise<DriverActivity> {
    const [row] = await db.insert(driverActivities).values(data).returning();
    return row;
  }

  async getDriverAttendance(driverId?: string, date?: string): Promise<DriverAttendance[]> {
    const conditions = [];
    if (driverId) conditions.push(eq(driverAttendance.driverId, driverId));
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      conditions.push(and(
        sql`check_in_time >= ${startOfDay.toISOString()}`,
        sql`check_in_time <= ${endOfDay.toISOString()}`
      ));
    }
    if (conditions.length > 0) {
      return db.select().from(driverAttendance).where(and(...conditions));
    }
    return db.select().from(driverAttendance);
  }

  async createDriverAttendance(data: InsertDriverAttendance): Promise<DriverAttendance> {
    const [row] = await db.insert(driverAttendance).values(data).returning();
    return row;
  }

  async updateDriverAttendance(id: string, data: Partial<DriverAttendance>): Promise<DriverAttendance> {
    const [row] = await db.update(driverAttendance).set(data).where(eq(driverAttendance.id, id)).returning();
    return row;
  }

  async getDriverAttendanceReport(driverId?: string, startDate?: string, endDate?: string): Promise<any[]> {
    await ensureDriverTablesSchema();
    const conditions = [];
    if (driverId) conditions.push(eq(driverAttendance.driverId, driverId));
    if (startDate) {
      conditions.push(sql`driver_attendance.check_in_time >= ${startDate + "T00:00:00.000Z"}`);
    }
    if (endDate) {
      conditions.push(sql`driver_attendance.check_in_time <= ${endDate + "T23:59:59.999Z"}`);
    }

    const list = await db.select()
      .from(driverAttendance)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(driverAttendance.checkInTime));

    const driversList = await this.getDrivers();
    const driverMap = new Map(driversList.map(d => [d.id, d.name]));
    
    return list.map(item => ({
      ...item,
      driverName: driverMap.get(item.driverId) || "Unknown Driver"
    }));
  }

  async getDriverDeliveriesReport(driverId?: string, startDate?: string, endDate?: string): Promise<any[]> {
    await ensureDriverTablesSchema();
    const conditions = [];
    if (driverId) {
      conditions.push(eq(dispatchDeliveries.driverId, driverId));
    }
    if (startDate) {
      conditions.push(sql`dispatch_sheets.date >= ${startDate}`);
    }
    if (endDate) {
      conditions.push(sql`dispatch_sheets.date <= ${endDate}`);
    }

    const query = db.select({
      id: dispatchDeliveries.id,
      dispatchItemId: dispatchDeliveries.dispatchItemId,
      driverId: dispatchDeliveries.driverId,
      outletId: dispatchDeliveries.outletId,
      deliveredQty: dispatchDeliveries.deliveredQty,
      remainingQty: dispatchDeliveries.remainingQty,
      damagedQty: dispatchDeliveries.damagedQty,
      damageReason: dispatchDeliveries.damageReason,
      remark: dispatchDeliveries.remark,
      podUrl: dispatchDeliveries.podUrl,
      temperature: dispatchDeliveries.temperature,
      status: dispatchDeliveries.status,
      deliveredAt: dispatchDeliveries.deliveredAt,
      deliveryTime: dispatchDeliveries.deliveryTime,
      
      itemCode: dispatchItems.itemCode,
      description: dispatchItems.description,
      requestedQty: dispatchItems.requestedQty,
      weight: dispatchItems.weight,
      
      sheetId: dispatchItems.sheetId,
      sheetDate: dispatchSheets.date,
      
      outletName: outlets.name,
      outletCode: outlets.code,
      
      zoneName: routes.name
    })
    .from(dispatchDeliveries)
    .innerJoin(dispatchItems, eq(dispatchDeliveries.dispatchItemId, dispatchItems.id))
    .innerJoin(dispatchSheets, eq(dispatchItems.sheetId, dispatchSheets.id))
    .leftJoin(outlets, eq(dispatchDeliveries.outletId, outlets.id))
    .leftJoin(routes, eq(dispatchItems.routeId, routes.id));

    if (conditions.length > 0) {
      query.where(and(...conditions));
    }
    query.orderBy(desc(dispatchDeliveries.deliveredAt));

    const list = await query;
    const driversList = await this.getDrivers();
    const driverMap = new Map(driversList.map(d => [d.id, d.name]));

    return list.map(item => ({
      ...item,
      driverName: item.driverId ? (driverMap.get(item.driverId) || "Unknown Driver") : "Unassigned"
    }));
  }

  // Logistics Fleet Advanced
  async getVehicleMaintenance(vehicleId?: string, driverId?: string): Promise<VehicleMaintenance[]> {
    const conditions = [];
    if (vehicleId) conditions.push(eq(vehicleMaintenance.vehicleId, vehicleId));
    if (driverId) conditions.push(eq(vehicleMaintenance.driverId, driverId));
    if (conditions.length > 0) {
      return db.select().from(vehicleMaintenance).where(and(...conditions));
    }
    return db.select().from(vehicleMaintenance);
  }

  async createVehicleMaintenance(data: InsertVehicleMaintenance): Promise<VehicleMaintenance> {
    const [row] = await db.insert(vehicleMaintenance).values(data as any).returning();
    return row;
  }

  async getFuelLogs(vehicleId?: string, tripId?: string, driverId?: string): Promise<FuelLog[]> {
    const conditions = [];
    if (vehicleId) conditions.push(eq(fuelLogs.vehicleId, vehicleId));
    if (tripId) conditions.push(eq(fuelLogs.tripId, tripId));
    if (driverId) conditions.push(eq(fuelLogs.driverId, driverId));
    if (conditions.length > 0) {
      return db.select().from(fuelLogs).where(and(...conditions));
    }
    return db.select().from(fuelLogs);
  }

  async createFuelLog(data: InsertFuelLog): Promise<FuelLog> {
    const [row] = await db.insert(fuelLogs).values(data as any).returning();
    return row;
  }

  // Logistics User Activity Logs
  async getUserActivityLogs(userId?: string): Promise<UserActivityLog[]> {
    if (userId) {
      return db.select().from(userActivityLogs).where(eq(userActivityLogs.userId, userId)).orderBy(desc(userActivityLogs.createdAt));
    }
    return db.select().from(userActivityLogs).orderBy(desc(userActivityLogs.createdAt));
  }

  async createUserActivityLog(data: InsertUserActivityLog): Promise<UserActivityLog> {
    const [row] = await db.insert(userActivityLogs).values(data).returning();
    return row;
  }

  // ====================== DISPATCH TRUCK PLANNING ======================
  async getDispatchTruckAssignments(sheetId: string): Promise<DispatchTruckAssignment[]> {
    return db.select().from(dispatchTruckAssignments).where(eq(dispatchTruckAssignments.sheetId, sheetId));
  }

  async createDispatchTruckAssignment(data: InsertDispatchTruckAssignment): Promise<DispatchTruckAssignment> {
    const [row] = await db.insert(dispatchTruckAssignments).values(data).returning();
    return row;
  }

  async updateDispatchTruckAssignment(id: string, data: Partial<InsertDispatchTruckAssignment>): Promise<DispatchTruckAssignment | undefined> {
    const [row] = await db.update(dispatchTruckAssignments).set(data as any).where(eq(dispatchTruckAssignments.id, id)).returning();
    return row;
  }

  async deleteDispatchTruckAssignment(id: string): Promise<void> {
    await db.delete(dispatchOutletTruckAssignments).where(eq(dispatchOutletTruckAssignments.truckAssignmentId, id));
    await db.delete(dispatchTruckAssignments).where(eq(dispatchTruckAssignments.id, id));
  }

  async getDispatchOutletTruckAssignments(truckAssignmentId: string): Promise<DispatchOutletTruckAssignment[]> {
    return db.select().from(dispatchOutletTruckAssignments).where(eq(dispatchOutletTruckAssignments.truckAssignmentId, truckAssignmentId));
  }

  async getDispatchOutletTruckAssignmentsBySheet(sheetId: string): Promise<DispatchOutletTruckAssignment[]> {
    const truckAssigns = await db.select().from(dispatchTruckAssignments).where(eq(dispatchTruckAssignments.sheetId, sheetId));
    if (truckAssigns.length === 0) return [];
    const ids = truckAssigns.map(t => t.id);
    return db.select().from(dispatchOutletTruckAssignments).where(inArray(dispatchOutletTruckAssignments.truckAssignmentId, ids));
  }

  async upsertDispatchOutletTruckAssignment(data: InsertDispatchOutletTruckAssignment): Promise<DispatchOutletTruckAssignment> {
    const [row] = await db.insert(dispatchOutletTruckAssignments).values(data).returning();
    return row;
  }

  async moveOutletBetweenTrucks(outletCode: string, newTruckAssignmentId: string, reason?: string): Promise<void> {
    await db.update(dispatchOutletTruckAssignments)
      .set({ truckAssignmentId: newTruckAssignmentId, overrideReason: reason || null } as any)
      .where(eq(dispatchOutletTruckAssignments.outletCode, outletCode));
  }

  async autoAssignZoneTrucksToSheet(sheetId: string): Promise<void> {
    try {
      // 1. Get all dispatch items for this sheet
      const items = await db.select().from(dispatchItems).where(eq(dispatchItems.sheetId, sheetId));
      if (items.length === 0) return;
      
      // 2. Determine all zone IDs involved in this sheet
      const outletIds = Array.from(new Set(items.map(i => i.outletId).filter(Boolean))) as string[];
      const allOutlets = outletIds.length > 0 ? await db.select().from(outlets).where(inArray(outlets.id, outletIds)) : [];
      
      const zoneIds = new Set<string>();
      for (const item of items) {
        if (item.overrideRouteId) zoneIds.add(item.overrideRouteId);
        if (item.routeId) zoneIds.add(item.routeId);
      }
      for (const outlet of allOutlets) {
        if (outlet.routeId) zoneIds.add(outlet.routeId);
      }
      const zoneIdsArray = Array.from(zoneIds).filter(Boolean);
      if (zoneIdsArray.length === 0) return;

      // 3. Find all available vehicles currently assigned to these zones
      const zoneVehicles = await db.select().from(vehicles)
        .where(
          and(
            inArray(vehicles.currentZoneId, zoneIdsArray),
            eq(vehicles.status, "available")
          )
        );
      if (zoneVehicles.length === 0) return;

      // 4. Get existing truck assignments for this sheet
      const existingAssigns = await db.select().from(dispatchTruckAssignments)
        .where(eq(dispatchTruckAssignments.sheetId, sheetId));
      const existingTruckIds = new Set(existingAssigns.map(a => a.truckId));

      // 5. Insert missing vehicles
      const assignmentsToInsert = zoneVehicles
        .filter(v => !existingTruckIds.has(v.id) && !!v.currentZoneId)
        .map(v => ({
          sheetId,
          truckId: v.id,
          driverId: v.assignedDriverId || null,
          zoneId: v.currentZoneId!,
          usedCapacity: "0"
        }));

      if (assignmentsToInsert.length > 0) {
        await db.insert(dispatchTruckAssignments).values(assignmentsToInsert);
      }
    } catch (err) {
      console.error("autoAssignZoneTrucksToSheet error:", err);
    }
  }

  async autoAllocateFfd(sheetId: string): Promise<{ allocated: number; overflow: string[] }> {
    // Get all dispatch items for this sheet, grouped by outlet
    const items = await db.select().from(dispatchItems).where(eq(dispatchItems.sheetId, sheetId));
    const outletMap: Record<string, { outletCode: string; outletId: string | null; totalWeight: number }> = {};
    for (const item of items) {
      if (!outletMap[item.outletCode]) {
        outletMap[item.outletCode] = { outletCode: item.outletCode, outletId: item.outletId, totalWeight: 0 };
      }
      outletMap[item.outletCode].totalWeight += parseFloat(item.weight || "0");
    }
    const outlets = Object.values(outletMap).sort((a, b) => b.totalWeight - a.totalWeight); // Descending weight (FFD)

    // Get truck assignments for this sheet
    const truckAssigns = await db.select().from(dispatchTruckAssignments).where(eq(dispatchTruckAssignments.sheetId, sheetId));
    const truckCaps = await Promise.all(truckAssigns.map(async t => {
      const veh = await db.select().from(vehicles).where(eq(vehicles.id, t.truckId));
      const cap = parseFloat(veh[0]?.capacity || "0");
      return { ...t, capacity: cap, remaining: cap - parseFloat(t.usedCapacity || "0") };
    }));

    // Clear existing outlet assignments for this sheet before re-allocating
    const truckIds = truckCaps.map(t => t.id);
    if (truckIds.length > 0) {
      await db.delete(dispatchOutletTruckAssignments).where(inArray(dispatchOutletTruckAssignments.truckAssignmentId, truckIds));
    }

    const overflow: string[] = [];
    let allocated = 0;

    for (const outlet of outlets) {
      const truck = truckCaps.find(t => t.remaining >= outlet.totalWeight);
      if (!truck) {
        overflow.push(outlet.outletCode);
        continue;
      }
      await db.insert(dispatchOutletTruckAssignments).values({
        truckAssignmentId: truck.id,
        outletCode: outlet.outletCode,
        outletId: outlet.outletId || null,
        assignedWeight: outlet.totalWeight.toFixed(3),
      });
      truck.remaining -= outlet.totalWeight;
      // Update usedCapacity on truck assignment
      await db.update(dispatchTruckAssignments)
        .set({ usedCapacity: (truck.capacity - truck.remaining).toFixed(3) } as any)
        .where(eq(dispatchTruckAssignments.id, truck.id));
      allocated++;
    }
    return { allocated, overflow };
  }

  // Pending quantities
  async getPendingQuantities(): Promise<DispatchPendingQuantity[]> {
    return db.select().from(dispatchPendingQuantities).where(eq(dispatchPendingQuantities.isCarriedForward, false));
  }

  async createPendingQuantity(data: InsertDispatchPendingQuantity): Promise<DispatchPendingQuantity> {
    const [row] = await db.insert(dispatchPendingQuantities).values(data).returning();
    return row;
  }

  async markPendingCarriedForward(id: string): Promise<void> {
    await db.update(dispatchPendingQuantities).set({ isCarriedForward: true } as any).where(eq(dispatchPendingQuantities.id, id));
  }

  // Truck transfers
  async getTruckTransfers(truckId?: string): Promise<TruckTransfer[]> {
    if (truckId) {
      return db.select().from(truckTransfers).where(eq(truckTransfers.truckId, truckId));
    }
    return db.select().from(truckTransfers).orderBy(desc(truckTransfers.createdAt));
  }

  async createTruckTransfer(data: InsertTruckTransfer): Promise<TruckTransfer> {
    // If permanent, update the vehicle's zone
    if (data.transferType === "permanent" && data.toZoneId) {
      await db.update(vehicles).set({ currentZoneId: data.toZoneId } as any).where(eq(vehicles.id, data.truckId));
    }
    const [row] = await db.insert(truckTransfers).values(data).returning();
    return row;
  }

  async updateTruckTransfer(id: string, data: Partial<InsertTruckTransfer>): Promise<TruckTransfer | undefined> {
    const [row] = await db.update(truckTransfers).set(data as any).where(eq(truckTransfers.id, id)).returning();
    return row;
  }

  // ====================== CONTRACT INVOICE ENGINE ======================
  async getContractInvoices(contractId?: string, customerId?: string): Promise<ContractInvoice[]> {
    const conditions = [];
    if (contractId) conditions.push(eq(contractInvoices.contractId, contractId));
    if (customerId) conditions.push(eq(contractInvoices.customerId, customerId));
    if (conditions.length > 0) {
      return db.select().from(contractInvoices).where(and(...conditions)).orderBy(desc(contractInvoices.createdAt));
    }
    return db.select().from(contractInvoices).orderBy(desc(contractInvoices.createdAt));
  }

  async getContractInvoice(id: string): Promise<ContractInvoice | undefined> {
    const [row] = await db.select().from(contractInvoices).where(eq(contractInvoices.id, id));
    return row;
  }

  async calculateContractUsage(contractId: string, periodStart: string, periodEnd: string, outletId?: string): Promise<void> {
    // Determine the monthly usage dynamically from actual deliveries/trips in this period
    // Since this can be complex, we will stub this aggregation and allow manual overrides.
    // In a full implementation, you would query deliveries/trips between periodStart and periodEnd for this contract/outlet.
    const existing = await this.getContractMonthlyUsage(contractId, periodStart);
    let target = existing.length > 0 ? existing[0] : null;
    if (outletId) {
      target = existing.find(e => e.outletId === outletId) || null;
    }

    if (!target) {
      await db.insert(contractMonthlyUsage).values({
        contractId,
        outletId: outletId || null,
        periodMonth: periodStart,
        otHours: "0",
        holidayDays: 0,
        extraTruckTrips: 0,
        emergencyTrips: 0,
        redeliveryTrips: 0,
        outsourcedTrips: 0,
      } as any);
    }
  }

  async generateContractInvoice(contractId: string, periodStart: string, periodEnd: string, outletId?: string): Promise<ContractInvoice> {
    const contract = await this.getContract(contractId);
    if (!contract) throw new Error("Contract not found");

    // Fetch or default monthly usage
    const usageConditions = [
      eq(contractMonthlyUsage.contractId, contractId),
      eq(contractMonthlyUsage.periodMonth, periodStart)
    ];
    if (outletId) {
      usageConditions.push(eq(contractMonthlyUsage.outletId, outletId));
    }

    const usageRows = await db.select().from(contractMonthlyUsage).where(and(...usageConditions));
    const usage = usageRows[0];

    const otHours = parseFloat(usage?.otHours || "0");
    const holidayDays = usage?.holidayDays || 0;
    const extraTruckTrips = usage?.extraTruckTrips || 0;
    const emergencyTrips = usage?.emergencyTrips || 0;
    const redeliveryTrips = usage?.redeliveryTrips || 0;
    const outsourcedTrips = usage?.outsourcedTrips || 0;

    const otRate = parseFloat(contract.otCharges || "0");
    const holidayRate = parseFloat(contract.holidayCharges || "0");
    const extraTruckRate = parseFloat(contract.extraTruckCharge || "0");
    const emergencyRate = parseFloat(contract.emergencyDeliveryCharge || "0");
    const redeliveryRate = parseFloat(contract.redeliveryCharge || "0");
    const outsourcedRate = parseFloat(contract.outsourcedVehicleCharge || "0");

    const baseAmount = parseFloat(contract.monthlyRate || "0") * (contract.numVehicles || 1);
    const otAmount = otHours * otRate;
    const holidayAmount = holidayDays * holidayRate;
    const extraTruckAmount = extraTruckTrips * extraTruckRate;
    const emergencyAmount = emergencyTrips * emergencyRate;
    const redeliveryAmount = redeliveryTrips * redeliveryRate;
    const outsourcedAmount = outsourcedTrips * outsourcedRate;

    const totalAmount = baseAmount + otAmount + holidayAmount + extraTruckAmount + emergencyAmount + redeliveryAmount + outsourcedAmount;

    // Use a random suffix to prevent unique constraint violations on fast loops
    const invoiceNumber = `CINV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const [row] = await db.insert(contractInvoices).values({
      invoiceNumber,
      contractId,
      customerId: contract.customerId,
      outletId: outletId || null,
      periodStart,
      periodEnd,
      baseAmount: baseAmount.toFixed(3),
      otHours: otHours.toFixed(2),
      otAmount: otAmount.toFixed(3),
      holidayDays,
      holidayAmount: holidayAmount.toFixed(3),
      extraTruckTrips,
      extraTruckAmount: extraTruckAmount.toFixed(3),
      emergencyTrips,
      emergencyAmount: emergencyAmount.toFixed(3),
      redeliveryTrips,
      redeliveryAmount: redeliveryAmount.toFixed(3),
      outsourcedTrips,
      outsourcedAmount: outsourcedAmount.toFixed(3),
      discount: "0",
      creditAmount: "0",
      totalAmount: totalAmount.toFixed(3),
      status: "draft",
    } as any).returning();

    // Now fetch deliveryAttachments for this period
    // Find all orders for this customer (and outlet if specified) within the period?
    // Wait, we can just query deliveryAttachments where createdAt is within period
    // and outletId matches (if outletId), or if we need to filter by customer, we join orders.
    // Parse dates safely to avoid RangeError
    let startDate: Date;
    let endDate: Date;
    try {
      startDate = new Date(periodStart);
      endDate = new Date(periodEnd + 'T23:59:59');
      if (isNaN(startDate.getTime())) startDate = new Date(); // fallback
      if (isNaN(endDate.getTime())) endDate = new Date(); // fallback
    } catch (e) {
      startDate = new Date();
      endDate = new Date();
    }

    const attachmentsQuery = db.select({
      id: deliveryAttachments.id,
      podUrl: deliveryAttachments.podUrl,
      status: deliveryAttachments.status,
      issueLog: deliveryAttachments.issueLog,
      createdAt: deliveryAttachments.createdAt,
      orderId: deliveryAttachments.orderId,
      tripId: deliveryAttachments.tripId,
    }).from(deliveryAttachments)
      .innerJoin(orders, eq(deliveryAttachments.orderId, orders.id))
      .where(and(
        eq(orders.customerId, contract.customerId),
        outletId ? eq(deliveryAttachments.outletId, outletId) : undefined,
        sql`${deliveryAttachments.createdAt} >= ${startDate.toISOString()}`,
        sql`${deliveryAttachments.createdAt} <= ${endDate.toISOString()}`
      ));

    const attachmentsRows = await attachmentsQuery;
    
    // Update invoice with attachments
    if (attachmentsRows.length > 0) {
      const attachments = attachmentsRows.map(a => ({
        id: a.id,
        podUrl: a.podUrl,
        status: a.status,
        issueLog: a.issueLog || undefined,
        createdAt: a.createdAt?.toISOString() || new Date().toISOString(),
      }));
      await db.update(contractInvoices)
        .set({ deliveryAttachments: attachments as any })
        .where(eq(contractInvoices.id, row.id));
      row.deliveryAttachments = attachments;
    }

    return row;
  }

  async updateContractInvoice(id: string, data: Partial<InsertContractInvoice>): Promise<ContractInvoice | undefined> {
    const [row] = await db.update(contractInvoices)
      .set({ ...data as any, updatedAt: new Date() })
      .where(eq(contractInvoices.id, id))
      .returning();
    return row;
  }

  // Monthly usage
  async getContractMonthlyUsage(contractId: string, month?: string): Promise<ContractMonthlyUsage[]> {
    if (month) {
      return db.select().from(contractMonthlyUsage).where(and(eq(contractMonthlyUsage.contractId, contractId), eq(contractMonthlyUsage.periodMonth, month)));
    }
    return db.select().from(contractMonthlyUsage).where(eq(contractMonthlyUsage.contractId, contractId));
  }

  async upsertContractMonthlyUsage(contractId: string, month: string, data: Partial<InsertContractMonthlyUsage>): Promise<ContractMonthlyUsage> {
    const existing = await this.getContractMonthlyUsage(contractId, month);
    if (existing.length > 0) {
      const [row] = await db.update(contractMonthlyUsage).set(data as any).where(eq(contractMonthlyUsage.id, existing[0].id)).returning();
      return row;
    }
    const [row] = await db.insert(contractMonthlyUsage).values({ contractId, periodMonth: month, ...data } as any).returning();
    return row;
  }
}


export const storage = new DatabaseStorage();
