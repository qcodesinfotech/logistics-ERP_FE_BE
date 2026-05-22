import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, boolean, timestamp, date, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ==================== ORGANIZATION MODULE ====================

export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  legalName: text("legal_name"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  vatNumber: text("vat_number"),
  logo: text("logo"),
  status: text("status").notNull().default("active"),
});

export const shops = pgTable("shops", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  name: text("name").notNull(),
  address: text("address"),
  phone: text("phone"),
  vatNumber: text("vat_number"),
  logo: text("logo"),
  status: text("status").notNull().default("active"),
});

export const branches = pgTable("branches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shopId: varchar("shop_id"),
  name: text("name").notNull(),
  address: text("address"),
  phone: text("phone"),
  status: text("status").notNull().default("active"),
});

export const warehouses = pgTable("warehouses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shopId: varchar("shop_id").notNull(),
  branchId: varchar("branch_id"),
  name: text("name").notNull(),
  address: text("address"),
  status: text("status").notNull().default("active"),
});

// ==================== PRODUCT & INVENTORY MODULE ====================

export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  parentId: varchar("parent_id"),
});

export const brands = pgTable("brands", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
});

export const manufacturers = pgTable("manufacturers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
});

export const units = pgTable("units", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  abbreviation: text("abbreviation"),
  status: text("status").notNull().default("active"),
});

export const suppliers = pgTable("suppliers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  companyName: text("company_name"),
  address: text("address"),
  address1: text("address1"),
  address2: text("address2"),
  address3: text("address3"),
  phone: text("phone"),
  email: text("email"),
  vatNumber: text("vat_number"),
  remarks: text("remarks"),
  companyId: varchar("company_id"),
  shopId: varchar("shop_id"),
  branchId: varchar("branch_id"),
  postalCode: text("postal_code"),
  openingBalance: decimal("opening_balance", { precision: 12, scale: 3 }).default("0.000"),
  currentBalance: decimal("current_balance", { precision: 12, scale: 3 }).default("0.000"),
  status: text("status").notNull().default("active"),
  createDate: timestamp("create_date").defaultNow(),
  updateDate: timestamp("update_date").defaultNow(),
  createdBy: varchar("created_by"),
});

export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  sku: text("sku"),
  barcode: text("barcode"),
  categoryId: varchar("category_id"),
  subcatId: varchar("subcat_id"),
  brandId: varchar("brand_id"),
  supplierId: varchar("supplier_id"),
  manufacturerId: varchar("manufacturer_id"),
  productImage: text("product_image"),
  descriptions: text("descriptions"),
  productCode: text("product_code"),
  taxCommodity: text("tax_commodity"),
  wareId: varchar("ware_id"),
  storageType: text("storage_type"),
  boxQty: text("box_qty"),
  boxBarCode: text("box_bar_code"),
  boxSalesCost: decimal("box_sales_cost", { precision: 12, scale: 3 }),
  companyId: varchar("company_id"),
  shopId: varchar("shop_id"),
  branchId: varchar("branch_id"),
  reorderPoint: text("reorder_point"),
  productQty: integer("product_qty").default(0),
  purchasePrice: decimal("purchase_price", { precision: 12, scale: 3 }).notNull().default("0.000"),
  sellingPrice: decimal("selling_price", { precision: 12, scale: 3 }).notNull().default("0.000"),
  bulkQuantity: integer("bulk_quantity"),
  bulkPrice: decimal("bulk_price", { precision: 12, scale: 3 }),
  purchaseUnitId: varchar("purchase_unit_id"),
  salesUnitId: varchar("sales_unit_id"),
  manufacturerDate: date("manufacturer_date"),
  expiryDate: date("expiry_date"),
  warrantyMonths: integer("warranty_months"),
  warrantyDays: integer("warranty_days"),
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }).default("5.00"),
  status: text("status").notNull().default("active"),
  createDate: timestamp("create_date").defaultNow(),
  updatedDate: timestamp("updated_date").defaultNow(),
  createdBy: varchar("created_by"),
});

export const inventory = pgTable("inventory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull(),
  warehouseId: varchar("warehouse_id").notNull(),
  companyId: varchar("company_id"),
  shopId: varchar("shop_id"),
  branchId: varchar("branch_id"),
  quantity: integer("quantity").notNull().default(0),
  batchNumber: text("batch_number"),
  manufacturingDate: date("manufacturing_date"),
  expiryDate: date("expiry_date"),
  serialNumbers: text("serial_numbers"),
  costPrice: decimal("cost_price", { precision: 12, scale: 3 }).notNull(),
  receivedDate: timestamp("received_date").defaultNow(),
});

// ==================== CUSTOMERS MODULE ====================

export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  contactEmail: text("contact_email"),
  customersLogo: text("customers_logo"),
  phone: text("phone"),
  companyId: varchar("company_id"),
  shopId: varchar("shop_id"),
  branchId: varchar("branch_id"),
  status: text("status").default("0"),
  trnNo: text("trn_no"),
  openingBalance: decimal("opening_balance", { precision: 12, scale: 3 }).default("0.000"),
  currentBalance: decimal("current_balance", { precision: 12, scale: 3 }).default("0.000"),
  crDr: text("cr_dr"),
  country: text("country"),
  branch: text("branch"),
  additionalDetails: text("additional_details"),
  createDate: timestamp("create_date").defaultNow(),
  updateDate: timestamp("update_date").defaultNow(),
  createdBy: varchar("created_by"),
});

// ==================== PURCHASE MODULE ====================

export const purchaseOrders = pgTable("purchase_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderNumber: text("order_number").notNull(),
  supplierId: varchar("supplier_id").notNull(),
  companyId: varchar("company_id"),
  shopId: varchar("shop_id").notNull(),
  branchId: varchar("branch_id"),
  warehouseId: varchar("warehouse_id"),
  orderDate: timestamp("order_date").defaultNow(),
  expectedDate: date("expected_date"),
  status: text("status").notNull().default("pending"),
  subtotal: decimal("subtotal", { precision: 12, scale: 3 }).default("0.000"),
  vatAmount: decimal("vat_amount", { precision: 12, scale: 3 }).default("0.000"),
  discount: decimal("discount", { precision: 12, scale: 3 }).default("0.000"),
  freight: decimal("freight", { precision: 12, scale: 3 }).default("0.000"),
  total: decimal("total", { precision: 12, scale: 3 }).default("0.000"),
  notes: text("notes"),
});

export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  purchaseOrderId: varchar("purchase_order_id").notNull(),
  productId: varchar("product_id").notNull(),
  warehouseId: varchar("warehouse_id"),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 12, scale: 3 }).notNull(),
  salesRate: decimal("sales_rate", { precision: 12, scale: 3 }),
  boxSalesRate: decimal("box_sales_rate", { precision: 12, scale: 3 }),
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }).default("5.00"),
  discount: decimal("discount", { precision: 12, scale: 3 }).default("0.000"),
  total: decimal("total", { precision: 12, scale: 3 }).notNull(),
  manufacturingDate: date("manufacturing_date"),
  expiryDate: date("expiry_date"),
  warrantyMonths: integer("warranty_months"),
  storageType: text("storage_type"),
});

export const purchases = pgTable("purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  purchaseNumber: text("purchase_number").notNull(),
  po: text("po"),
  date: text("date"),
  purchaseOrderId: varchar("purchase_order_id"),
  supplierId: varchar("supplier_id").notNull(),
  userId: varchar("user_id"),
  productId: varchar("product_id"),
  companyId: varchar("company_id"),
  shopId: varchar("shop_id").notNull(),
  branchId: varchar("branch_id"),
  warehouseId: varchar("warehouse_id"),
  wareId: varchar("ware_id"),
  purchaseDate: timestamp("purchase_date").defaultNow(),
  paymentStatus: text("payment_status").default("pending"),
  status: text("status").default("pending"),
  paymentMethod: text("payment_method"),
  bankAccountId: varchar("bank_account_id"),
  paidAmount: decimal("paid_amount", { precision: 12, scale: 3 }).default("0.000"),
  creditApplied: decimal("credit_applied", { precision: 12, scale: 3 }).default("0.000"),
  subtotal: decimal("subtotal", { precision: 12, scale: 3 }).default("0.000"),
  subTotal: text("sub_total"),
  vatAmount: decimal("vat_amount", { precision: 12, scale: 3 }).default("0.000"),
  vat: text("vat"),
  discount: decimal("discount", { precision: 12, scale: 3 }).default("0.000"),
  freight: decimal("freight", { precision: 12, scale: 3 }).default("0.000"),
  freightCharges: text("freight_charges"),
  otherCharges: text("other_charges"),
  total: decimal("total", { precision: 12, scale: 3 }).default("0.000"),
  roundOff: text("round_off"),
  grandTotal: text("grand_total"),
  amount: text("amount"),
  remaining: text("remaining"),
  extras: text("extras"),
  file: text("file"),
  master: text("master").default("0"),
  lpoNo: text("lpo_no"),
  purchaseUnit: text("purchase_unit").default("1"),
  notes: text("notes"),
  createDate: timestamp("create_date").defaultNow(),
  updateDate: timestamp("update_date").defaultNow(),
  createdBy: varchar("created_by"),
});

export const purchaseItems = pgTable("purchase_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  purchaseId: varchar("purchase_id").notNull(),
  productId: varchar("product_id").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 12, scale: 3 }).notNull(),
  salesRate: decimal("sales_rate", { precision: 12, scale: 3 }),
  boxSalesRate: decimal("box_sales_rate", { precision: 12, scale: 3 }),
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }).default("5.00"),
  discount: decimal("discount", { precision: 12, scale: 3 }).default("0.000"),
  total: decimal("total", { precision: 12, scale: 3 }).notNull(),
  batchNumber: text("batch_number"),
  manufacturingDate: date("manufacturing_date"),
  expiryDate: date("expiry_date"),
  warrantyMonths: integer("warranty_months"),
  storageType: text("storage_type"),
  serialNumber: varchar("serial_number"),
  serialNumbers: text("serial_numbers"),
});

export const purchasePayments = pgTable("purchase_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  purchaseId: varchar("purchase_id").notNull(),
  supplierId: varchar("supplier_id").notNull(),
  companyId: varchar("company_id"),
  shopId: varchar("shop_id"),
  branchId: varchar("branch_id"),
  amount: decimal("amount", { precision: 12, scale: 3 }).notNull(),
  paymentMethod: text("payment_method"),
  bankAccountId: varchar("bank_account_id"),
  reference: text("reference"),
  notes: text("notes"),
  paidAt: timestamp("paid_at").defaultNow(),
  createdBy: varchar("created_by"),
});

export const serialNumbers = pgTable("serial_numbers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serialNumber: text("serial_number").notNull().unique(),
  productId: varchar("product_id").notNull(),
  purchaseItemId: varchar("purchase_item_id"),
  purchaseId: varchar("purchase_id"),
  saleItemId: varchar("sale_item_id"),
  saleId: varchar("sale_id"),
  companyId: varchar("company_id"),
  shopId: varchar("shop_id"),
  branchId: varchar("branch_id"),
  warehouseId: varchar("warehouse_id"),
  costPrice: decimal("cost_price", { precision: 12, scale: 3 }),
  sellingPrice: decimal("selling_price", { precision: 12, scale: 3 }),
  status: text("status").notNull().default("available"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  soldAt: timestamp("sold_at"),
  returnedAt: timestamp("returned_at"),
  replacedAt: timestamp("replaced_at"),
});

// ==================== SALES MODULE ====================

export const sales = pgTable("sales", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  saleNumber: text("sale_number").notNull(),
  customerId: varchar("customer_id"),
  companyId: varchar("company_id"),
  shopId: varchar("shop_id").notNull(),
  branchId: varchar("branch_id"),
  saleDate: timestamp("sale_date").defaultNow(),
  paymentStatus: text("payment_status").notNull().default("paid"),
  paymentMethod: text("payment_method"),
  bankAccountId: varchar("bank_account_id"),
  cashAmount: decimal("cash_amount", { precision: 12, scale: 3 }).default("0.000"),
  cardAmount: decimal("card_amount", { precision: 12, scale: 3 }).default("0.000"),
  creditAmount: decimal("credit_amount", { precision: 12, scale: 3 }).default("0.000"),
  subtotal: decimal("subtotal", { precision: 12, scale: 3 }).default("0.000"),
  vatAmount: decimal("vat_amount", { precision: 12, scale: 3 }).default("0.000"),
  discount: decimal("discount", { precision: 12, scale: 3 }).default("0.000"),
  total: decimal("total", { precision: 12, scale: 3 }).default("0.000"),
  notes: text("notes"),
  soldBy: varchar("sold_by"),
});

export const saleItems = pgTable("sale_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  saleId: varchar("sale_id").notNull(),
  productId: varchar("product_id").notNull(),
  inventoryId: varchar("inventory_id"),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 12, scale: 3 }).notNull(),
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }).default("5.00"),
  discount: decimal("discount", { precision: 12, scale: 3 }).default("0.000"),
  total: decimal("total", { precision: 12, scale: 3 }).notNull(),
  serialNumber: text("serial_number"),
});

export const saleReturns = pgTable("sale_returns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  returnNumber: text("return_number").notNull(),
  saleId: varchar("sale_id").notNull(),
  customerId: varchar("customer_id"),
  companyId: varchar("company_id"),
  shopId: varchar("shop_id"),
  branchId: varchar("branch_id"),
  returnDate: timestamp("return_date").defaultNow(),
  returnType: text("return_type").default("refund"),
  refundMethod: text("refund_method"),
  refundAmount: decimal("refund_amount", { precision: 12, scale: 3 }).default("0.000"),
  creditAmount: decimal("credit_amount", { precision: 12, scale: 3 }).default("0.000"),
  reason: text("reason"),
  status: text("status").notNull().default("pending"),
  processedBy: varchar("processed_by"),
});

export const saleReturnItems = pgTable("sale_return_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  returnId: varchar("return_id").notNull(),
  saleItemId: varchar("sale_item_id").notNull(),
  productId: varchar("product_id").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 12, scale: 3 }).notNull(),
  total: decimal("total", { precision: 12, scale: 3 }).notNull(),
  reason: text("reason"),
  warrantyStatus: text("warranty_status"),
  serialNumber: text("serial_number"),
});

export const saleReplacements = pgTable("sale_replacements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  replacementNumber: text("replacement_number").notNull(),
  saleId: varchar("sale_id").notNull(),
  saleItemId: varchar("sale_item_id"),
  customerId: varchar("customer_id"),
  companyId: varchar("company_id"),
  shopId: varchar("shop_id"),
  branchId: varchar("branch_id"),
  replacementDate: timestamp("replacement_date").defaultNow(),
  originalProductId: varchar("original_product_id").notNull(),
  replacementProductId: varchar("replacement_product_id").notNull(),
  originalSerialNumberId: varchar("original_serial_number_id"),
  replacementSerialNumberId: varchar("replacement_serial_number_id"),
  originalSerialNumber: text("original_serial_number"),
  replacementSerialNumber: text("replacement_serial_number"),
  originalQuantity: integer("original_quantity").notNull(),
  replacementQuantity: integer("replacement_quantity").notNull(),
  originalPrice: decimal("original_price", { precision: 12, scale: 3 }).default("0.000"),
  replacementPrice: decimal("replacement_price", { precision: 12, scale: 3 }).default("0.000"),
  priceDifference: decimal("price_difference", { precision: 12, scale: 3 }).default("0.000"),
  replacementType: text("replacement_type").default("same_item"),
  paymentMethod: text("payment_method"),
  bankAccountId: varchar("bank_account_id"),
  reason: text("reason"),
  warrantyStatus: text("warranty_status"),
  status: text("status").notNull().default("completed"),
  processedBy: varchar("processed_by"),
});

export const salePayments = pgTable("sale_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  saleId: varchar("sale_id").notNull(),
  customerId: varchar("customer_id"),
  companyId: varchar("company_id"),
  shopId: varchar("shop_id"),
  branchId: varchar("branch_id"),
  paymentDate: timestamp("payment_date").defaultNow(),
  paymentMethod: text("payment_method").notNull(),
  bankAccountId: varchar("bank_account_id"),
  amount: decimal("amount", { precision: 12, scale: 3 }).notNull(),
  reference: text("reference"),
  notes: text("notes"),
  processedBy: varchar("processed_by"),
});

// ==================== PURCHASE RETURNS MODULE ====================

export const purchaseReturns = pgTable("purchase_returns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  returnNumber: text("return_number").notNull(),
  purchaseId: varchar("purchase_id").notNull(),
  supplierId: varchar("supplier_id").notNull(),
  companyId: varchar("company_id"),
  shopId: varchar("shop_id"),
  branchId: varchar("branch_id"),
  warehouseId: varchar("warehouse_id"),
  returnDate: timestamp("return_date").defaultNow(),
  returnType: text("return_type").notNull().default("credit"),
  refundMethod: text("refund_method"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 3 }).default("0.000"),
  creditApplied: decimal("credit_applied", { precision: 12, scale: 3 }).default("0.000"),
  refundAmount: decimal("refund_amount", { precision: 12, scale: 3 }).default("0.000"),
  reason: text("reason"),
  status: text("status").notNull().default("completed"),
  processedBy: varchar("processed_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const purchaseReturnItems = pgTable("purchase_return_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  returnId: varchar("return_id").notNull(),
  purchaseItemId: varchar("purchase_item_id"),
  productId: varchar("product_id").notNull(),
  serialNumber: text("serial_number"),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 12, scale: 3 }).notNull(),
  total: decimal("total", { precision: 12, scale: 3 }).notNull(),
});

export const supplierCredits = pgTable("supplier_credits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  supplierId: varchar("supplier_id").notNull(),
  companyId: varchar("company_id"),
  shopId: varchar("shop_id"),
  branchId: varchar("branch_id"),
  creditBalance: decimal("credit_balance", { precision: 12, scale: 3 }).default("0.000"),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const supplierCreditTransactions = pgTable("supplier_credit_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  supplierId: varchar("supplier_id").notNull(),
  companyId: varchar("company_id"),
  shopId: varchar("shop_id"),
  branchId: varchar("branch_id"),
  purchaseId: varchar("purchase_id"),
  purchaseReturnId: varchar("purchase_return_id"),
  transactionType: text("transaction_type").notNull(),
  amount: decimal("amount", { precision: 12, scale: 3 }).notNull(),
  balanceAfter: decimal("balance_after", { precision: 12, scale: 3 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const supplierRefunds = pgTable("supplier_refunds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  refundNumber: text("refund_number").notNull(),
  supplierId: varchar("supplier_id").notNull(),
  purchaseId: varchar("purchase_id"),
  purchaseReturnId: varchar("purchase_return_id"),
  companyId: varchar("company_id"),
  shopId: varchar("shop_id"),
  branchId: varchar("branch_id"),
  refundDate: timestamp("refund_date").defaultNow(),
  amount: decimal("amount", { precision: 12, scale: 3 }).notNull(),
  bankAccountId: varchar("bank_account_id"),
  paymentMethod: text("payment_method"),
  reference: text("reference"),
  notes: text("notes"),
  processedBy: varchar("processed_by"),
});

// ==================== ACCOUNTING MODULE ====================

export const bankAccounts = pgTable("bank_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  accountNumber: text("account_number"),
  bankName: text("bank_name"),
  companyId: varchar("company_id"), // Company-level banking
  shopId: varchar("shop_id").notNull(), // Shop-level banking - mandatory
  branchId: varchar("branch_id").notNull(), // Branch-level banking - mandatory
  openingBalance: decimal("opening_balance", { precision: 12, scale: 3 }).default("0.000"),
  currentBalance: decimal("current_balance", { precision: 12, scale: 3 }).default("0.000"),
  status: text("status").notNull().default("active"),
});

export const bankTransactions = pgTable("bank_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bankAccountId: varchar("bank_account_id").notNull(),
  companyId: varchar("company_id"), // Company-level transaction
  shopId: varchar("shop_id").notNull(), // Shop-level transaction - mandatory
  branchId: varchar("branch_id").notNull(), // Branch-level transaction - mandatory
  transactionDate: timestamp("transaction_date").defaultNow(),
  type: text("type").notNull(),
  amount: decimal("amount", { precision: 12, scale: 3 }).notNull(),
  reference: text("reference"),
  description: text("description"),
  relatedType: text("related_type"),
  relatedId: varchar("related_id"),
});

export const pettyCash = pgTable("petty_cash", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  companyId: varchar("company_id"),
  shopId: varchar("shop_id").notNull(),
  branchId: varchar("branch_id"),
  openingBalance: decimal("opening_balance", { precision: 12, scale: 3 }).default("0.000"),
  currentBalance: decimal("current_balance", { precision: 12, scale: 3 }).default("0.000"),
});

export const pettyCashTransactions = pgTable("petty_cash_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pettyCashId: varchar("petty_cash_id").notNull(),
  shopId: varchar("shop_id"),
  branchId: varchar("branch_id"),
  bankAccountId: varchar("bank_account_id"),
  transactionDate: timestamp("transaction_date").defaultNow(),
  type: text("type").notNull(),
  amount: decimal("amount", { precision: 12, scale: 3 }).notNull(),
  description: text("description"),
  reference: text("reference"),
});

export const capital = pgTable("capital", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id"), // Company-level capital
  shopId: varchar("shop_id").notNull(), // Shop-level capital - mandatory
  branchId: varchar("branch_id").notNull(), // Branch-level capital - mandatory
  bankAccountId: varchar("bank_account_id"),
  amount: decimal("amount", { precision: 12, scale: 3 }).notNull(),
  type: text("type").notNull(),
  description: text("description"),
  transactionDate: timestamp("transaction_date").defaultNow(),
});

// ==================== HR & PAYROLL MODULE ====================

export const employees = pgTable("employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeCode: text("employee_code").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  position: text("position"),
  department: text("department"),
  companyId: varchar("company_id"),
  shopId: varchar("shop_id"),
  branchId: varchar("branch_id"),
  joiningDate: date("joining_date"),
  basicSalary: decimal("basic_salary", { precision: 12, scale: 3 }).default("0.000"),
  allowances: decimal("allowances", { precision: 12, scale: 3 }).default("0.000"),
  photoUrl: text("photo_url"),
  status: text("status").notNull().default("active"),
});

export const salaryPayments = pgTable("salary_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull(),
  companyId: varchar("company_id"),
  shopId: varchar("shop_id"),
  branchId: varchar("branch_id"),
  bankAccountId: varchar("bank_account_id"),
  paymentDate: timestamp("payment_date").defaultNow(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  basicSalary: decimal("basic_salary", { precision: 12, scale: 3 }).notNull(),
  allowances: decimal("allowances", { precision: 12, scale: 3 }).default("0.000"),
  deductions: decimal("deductions", { precision: 12, scale: 3 }).default("0.000"),
  advanceDeduction: decimal("advance_deduction", { precision: 12, scale: 3 }).default("0.000"),
  leaveDeduction: decimal("leave_deduction", { precision: 12, scale: 3 }).default("0.000"),
  unapprovedLeaveDays: decimal("unapproved_leave_days", { precision: 5, scale: 1 }).default("0"),
  netSalary: decimal("net_salary", { precision: 12, scale: 3 }).notNull(),
  paymentMethod: text("payment_method"),
  notes: text("notes"),
  status: text("status").notNull().default("pending"),
});

export const salaryAdvances = pgTable("salary_advances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull(),
  companyId: varchar("company_id"),
  shopId: varchar("shop_id"),
  branchId: varchar("branch_id"),
  bankAccountId: varchar("bank_account_id"),
  advanceDate: timestamp("advance_date").defaultNow(),
  amount: decimal("amount", { precision: 12, scale: 3 }).notNull(),
  repaidAmount: decimal("repaid_amount", { precision: 12, scale: 3 }).default("0.000"),
  remainingAmount: decimal("remaining_amount", { precision: 12, scale: 3 }).notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("pending"), // pending, partial, repaid
  createdAt: timestamp("created_at").defaultNow(),
});

// ==================== CLIENT MODULE ====================

export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  companyName: text("company_name"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  contactPerson: text("contact_person"),
  notes: text("notes"),
  erpCompanyId: varchar("erp_company_id"),
  shopId: varchar("shop_id"),
  branchId: varchar("branch_id"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ==================== PROJECT MODULE ====================

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id"),
  companyId: varchar("company_id"), // Company-level project
  shopId: varchar("shop_id"), // Shop-level project - optional for global scope
  branchId: varchar("branch_id"), // Branch-level project - optional for global scope
  name: text("name").notNull(),
  description: text("description"),
  clientName: text("client_name"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  budget: decimal("budget", { precision: 12, scale: 3 }).default("0.000"),
  status: text("status").notNull().default("planned"), // planned, active, completed, on_hold
  priority: text("priority").default("medium"),
  completedDate: date("completed_date"),
  createdAt: timestamp("created_at").defaultNow(),
  // Extended project management fields
  hourlyRate: decimal("hourly_rate", { precision: 12, scale: 3 }).default("0.000"),
  totalCost: decimal("total_cost", { precision: 12, scale: 3 }).default("0.000"),
  totalHours: decimal("total_hours", { precision: 12, scale: 3 }).default("0.000"),
  isBillable: boolean("is_billable").default(false),
  projectType: integer("project_type").default(1), // 1 = Fixed Cost, 2 = Hourly
  projectStatus: integer("project_status").default(0), // 0 = Yet to start, 1 = In Progress, 2 = Completed, 3 = Cancelled
  departId: varchar("depart_id"),
  subdeptId: varchar("subdept_id"),
  manager: text("manager"), // comma-separated user/employee IDs
  team: text("team"), // comma-separated user/employee IDs
});

export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id"),
  companyId: varchar("company_id"),
  shopId: varchar("shop_id"),
  branchId: varchar("branch_id"),
  title: text("title").notNull(),
  description: text("description"),
  assigneeId: text("assignee_id"), // Comma-separated or multiple IDs
  startDate: date("start_date"),
  dueDate: date("due_date"),
  priority: text("priority").default("medium"),
  status: text("status").notNull().default("todo"), // todo, in_progress, completed
  billable: boolean("billable").default(true),
  estimatedHours: decimal("estimated_hours", { precision: 8, scale: 2 }).default("0.00"),
  actualHours: decimal("actual_hours", { precision: 8, scale: 2 }).default("0.00"),
  hourlyRate: decimal("hourly_rate", { precision: 12, scale: 3 }).default("0.000"),
   completedAt: timestamp("completed_at"),
  notified: boolean("notified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const taskComments = pgTable("task_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull(),
  employeeId: varchar("employee_id").notNull(),
  comment: text("comment").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const taskAttachments = pgTable("task_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull(),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  uploadedBy: varchar("uploaded_by"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const taskTimerSessions = pgTable("task_timer_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull(),
  userId: varchar("user_id").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  status: text("status").notNull().default("running"), // running, paused, completed
  totalPauseDuration: integer("total_pause_duration").default(0), // in seconds
  lastPauseTime: timestamp("last_pause_time"),
});

export const timesheets = pgTable("timesheets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id"),
  projectId: varchar("project_id"),
  userId: varchar("user_id"),
  hours: decimal("hours", { precision: 10, scale: 2 }).notNull(),
  date: date("date").default(sql`CURRENT_DATE`),
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  source: text("source").notNull(), // timer, manual
  description: text("description"),
});

export const projectFiles = pgTable("project_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  description: text("description"),
  uploadedBy: varchar("uploaded_by"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const projectExpenses = pgTable("project_expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id"),
  taskId: varchar("task_id"),
  employeeId: varchar("employee_id"),
  bankAccountId: varchar("bank_account_id"),
  shopId: varchar("shop_id"),
  branchId: varchar("branch_id"), // Branch is required for proper accounting
  title: text("title"),
  expenseType: text("expense_type"), // employee, project
  amount: decimal("amount", { precision: 12, scale: 3 }).notNull(),
  description: text("description"),
  category: text("category"), // materials, labor, equipment, travel, utilities, other
  expenseDate: timestamp("expense_date").defaultNow(),
  attachmentUrl: text("attachment_url"),
  accountCode: text("account_code"), // expense account code for journal entry
  status: text("status").notNull().default("posted"),
});

export const projectIncome = pgTable("project_income", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  clientId: varchar("client_id"),
  bankAccountId: varchar("bank_account_id"),
  title: text("title"),
  fromDate: timestamp("from_date"),
  toDate: timestamp("to_date"),
  amount: decimal("amount", { precision: 12, scale: 3 }).notNull(),
  paidAmount: decimal("paid_amount", { precision: 12, scale: 3 }).notNull().default("0"),
  description: text("description"),
  paymentDate: timestamp("payment_date").defaultNow(),
  paymentMethod: text("payment_method"), // cash, bank, receivable
  reference: text("reference"),
  paymentStatus: text("payment_status").notNull().default("pending"), // pending, partial, paid
  invoiceNo: text("invoice_no"),
  attachmentUrl: text("attachment_url"),
  companyId: varchar("company_id"),
  shopId: varchar("shop_id"),
  branchId: varchar("branch_id"),
  status: text("status").default("active"),
});

// ==================== STOCK TRANSFERS ====================

export const stockTransfers = pgTable("stock_transfers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transferNumber: text("transfer_number").notNull(),
  fromWarehouseId: varchar("from_warehouse_id").notNull(),
  toWarehouseId: varchar("to_warehouse_id").notNull(),
  companyId: varchar("company_id"),
  shopId: varchar("shop_id"),
  fromBranchId: varchar("from_branch_id"),
  toBranchId: varchar("to_branch_id"),
  transferDate: timestamp("transfer_date").defaultNow(),
  status: text("status").notNull().default("pending"),
  bankAccountId: varchar("bank_account_id"),
  notes: text("notes"),
});

export const stockTransferItems = pgTable("stock_transfer_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stockTransferId: varchar("stock_transfer_id").notNull(),
  productId: varchar("product_id").notNull(),
  inventoryId: varchar("inventory_id").notNull(),
  quantity: integer("quantity").notNull(),
  serialNumbers: text("serial_numbers"),
});

// ==================== USERS ====================

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name"),
  email: text("email"),
  role: text("role").notNull().default("staff"), // Legacy field - kept for backward compatibility
  roleId: varchar("role_id"), // Dynamic RBAC role reference
  employeeId: varchar("employee_id"),
  companyId: varchar("company_id"),
  shopId: varchar("shop_id"),
  branchId: varchar("branch_id"),
  warehouseId: varchar("warehouse_id"),
  refreshToken: text("refresh_token"),
  lastLogin: timestamp("last_login"),
  status: text("status").notNull().default("active"),
});

// ==================== DYNAMIC RBAC ====================

// User multi-scope assignments (a user can be assigned to multiple companies/shops/branches)
export const userScopes = pgTable("user_scopes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  companyId: varchar("company_id"),
  shopId: varchar("shop_id"),
  branchId: varchar("branch_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type UserScope = typeof userScopes.$inferSelect;

export const roles = pgTable("roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  isSystemRole: boolean("is_system_role").default(false), // Cannot be deleted
  status: text("status").notNull().default("active"), // active, disabled
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const menus = pgTable("menus", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(), // dashboard, sales, purchases, inventory, etc.
  title: text("title").notNull(),
  icon: text("icon"), // Lucide icon name
  path: text("path"), // Route path
  parentId: varchar("parent_id"), // For submenus
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
});

export const permissions = pgTable("permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleId: varchar("role_id").notNull(),
  menuId: varchar("menu_id").notNull(),
  canRead: boolean("can_read").default(false),
  canWrite: boolean("can_write").default(false),
});

export const insertRoleSchema = createInsertSchema(roles).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMenuSchema = createInsertSchema(menus).omit({ id: true });
export const insertPermissionSchema = createInsertSchema(permissions).omit({ id: true });

export type Role = typeof roles.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type Menu = typeof menus.$inferSelect;
export type InsertMenu = z.infer<typeof insertMenuSchema>;
export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;

// ==================== ACCOUNTING MODULE ====================

export const chartOfAccounts = pgTable("chart_of_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountCode: text("account_code").notNull(),
  name: text("name").notNull(),
  accountType: text("account_type").notNull(), // asset, liability, equity, revenue, expense
  parentId: varchar("parent_id"),
  companyId: varchar("company_id"), // Company-level accounting
  shopId: varchar("shop_id").notNull(), // Shop-level accounting - mandatory
  branchId: varchar("branch_id").notNull(), // Branch-level accounting - mandatory
  description: text("description"),
  isActive: boolean("is_active").default(true),
  balance: decimal("balance", { precision: 12, scale: 3 }).default("0.000"),
});

export const journalEntries = pgTable("journal_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entryNumber: text("entry_number").notNull(),
  entryDate: timestamp("entry_date").defaultNow(),
  companyId: varchar("company_id"), // Company-level accounting
  shopId: varchar("shop_id").notNull(), // Shop-level accounting - mandatory
  branchId: varchar("branch_id").notNull(), // Branch-level accounting - mandatory
  reference: text("reference"),
  description: text("description"),
  sourceType: text("source_type"), // purchase, sale, bank_transaction, manual
  sourceId: varchar("source_id"),
  status: text("status").notNull().default("posted"), // draft, posted, reversed
  createdAt: timestamp("created_at").defaultNow(),
});

export const journalLines = pgTable("journal_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  journalEntryId: varchar("journal_entry_id").notNull(),
  accountId: varchar("account_id").notNull(),
  debit: decimal("debit", { precision: 12, scale: 3 }).default("0.000"),
  credit: decimal("credit", { precision: 12, scale: 3 }).default("0.000"),
  description: text("description"),
  projectId: varchar("project_id"),
  clientId: varchar("client_id"),
  taskId: varchar("task_id"),
});

// ==================== QUOTATIONS MODULE ====================

export const quotations = pgTable("quotations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quotationNumber: text("quotation_number").notNull(),
  customerId: varchar("customer_id"),
  companyId: varchar("company_id"),
  shopId: varchar("shop_id").notNull(),
  branchId: varchar("branch_id"),
  warehouseId: varchar("warehouse_id"),
  quotationDate: timestamp("quotation_date").defaultNow(),
  validUntil: date("valid_until"),
  status: text("status").notNull().default("pending"), // pending, approved, rejected, converted
  financeCode: text("finance_code"),
  requestNo: text("request_no"),
  discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }).default("0.00"),
  taxType: text("tax_type").default("VAT"), // VAT, NO_VAT
  currency: text("currency").default("OMR"),
  salesPerson: text("sales_person"),
  companyName: text("company_name"),
  contactPerson: text("contact_person"),
  salesContact: text("sales_contact"),
  subtotal: decimal("subtotal", { precision: 12, scale: 3 }).default("0.000"),
  vatAmount: decimal("vat_amount", { precision: 12, scale: 3 }).default("0.000"),
  discount: decimal("discount", { precision: 12, scale: 3 }).default("0.000"),
  total: decimal("total", { precision: 12, scale: 3 }).default("0.000"),
  notes: text("notes"),
  attachmentUrl: text("attachment_url"),
  managerSignature: text("manager_signature"),
  companyStamp: text("company_stamp"),
  convertedSaleId: varchar("converted_sale_id"),
});

export const quotationItems = pgTable("quotation_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quotationId: varchar("quotation_id").notNull(),
  productId: varchar("product_id"),
  productName: text("product_name"),
  productDesc: text("product_desc"),
  warehouseId: varchar("warehouse_id"),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 12, scale: 3 }).notNull(),
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }).default("5.00"),
  discount: decimal("discount", { precision: 12, scale: 3 }).default("0.000"),
  total: decimal("total", { precision: 12, scale: 3 }).default("0.000"),
  salesType: text("sales_type").default("single"), // single, box
  deliveryDate: date("delivery_date"),
});

// ==================== EMPLOYEE DOCUMENTS MODULE ====================

export const employeeDocuments = pgTable("employee_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull(),
  documentType: text("document_type").notNull(), // passport, visa, workPermit, residency, drivingLicense, medicalCard
  documentNumber: text("document_number"),
  issueDate: date("issue_date"),
  expiryDate: date("expiry_date"),
  issuingAuthority: text("issuing_authority"),
  notificationDays: integer("notification_days").default(30),
  status: text("status").notNull().default("active"), // active, expired, expiring_soon
  notes: text("notes"),
});

// ==================== DOCUMENT & COMPLIANCE MODULE ====================

export const complianceDocuments = pgTable("compliance_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: text("category").notNull(), // employee, office
  documentType: text("document_type").notNull(), // passport, visa, workPermit, tradeLicense, rentAgreement, electricityBill, etc.
  title: text("title").notNull(),
  documentNumber: text("document_number"),
  employeeId: varchar("employee_id"),
  shopId: varchar("shop_id"),
  branchId: varchar("branch_id"),
  warehouseId: varchar("warehouse_id"),
  issueDate: date("issue_date").notNull(),
  expiryDate: date("expiry_date").notNull(),
  filePath: text("file_path"),
  fileName: text("file_name"),
  mimeType: text("mime_type"),
  fileSize: integer("file_size"),
  status: text("status").notNull().default("pending_review"), // pending_review, approved, rejected, expired
  remarks: text("remarks"),
  reviewedById: varchar("reviewed_by_id"),
  reviewedAt: timestamp("reviewed_at"),
  reviewComments: text("review_comments"),
  createdById: varchar("created_by_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const documentAuditLogs = pgTable("document_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull(),
  action: text("action").notNull(), // upload, update, review, replace, download, status_change, reminder_sent
  previousStatus: text("previous_status"),
  newStatus: text("new_status"),
  actorId: varchar("actor_id"),
  notes: text("notes"),
  metadata: text("metadata"), // JSON string for additional data
  createdAt: timestamp("created_at").defaultNow(),
});

export const complianceReminders = pgTable("compliance_reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  category: text("category").notNull(), // rent, electricity, water, internet, custom
  frequency: text("frequency").notNull().default("monthly"), // monthly, quarterly, yearly
  dueDayOfMonth: integer("due_day_of_month").default(1),
  dueMonthOfYear: integer("due_month_of_year"), // 1-12 for yearly
  leadTimeDays: integer("lead_time_days").default(7), // days before due date to notify
  shopId: varchar("shop_id"),
  branchId: varchar("branch_id"),
  warehouseId: varchar("warehouse_id"),
  amount: decimal("amount", { precision: 12, scale: 3 }),
  remarks: text("remarks"),
  attachmentPath: text("attachment_path"),
  attachmentName: text("attachment_name"),
  customCategory: text("custom_category"),
  isActive: boolean("is_active").default(true),
  lastTriggeredAt: timestamp("last_triggered_at"),
  nextDueDate: date("next_due_date"),
  createdById: varchar("created_by_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ==================== LEAVE MANAGEMENT MODULE ====================

export const leaveTypes = pgTable("leave_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  daysPerYear: integer("days_per_year").default(0),
  isPaid: boolean("is_paid").default(true),
  carryForward: boolean("carry_forward").default(false),
  maxCarryForward: integer("max_carry_forward").default(0),
});

export const leaveRequests = pgTable("leave_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull(),
  leaveTypeId: varchar("leave_type_id").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  totalDays: decimal("total_days", { precision: 5, scale: 1 }).notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("pending"), // pending, approved, rejected, cancelled
  approvedById: varchar("approved_by_id"),
  approvedPaidDays: decimal("approved_paid_days", { precision: 5, scale: 1 }).default("0"),
  approvedUnpaidDays: decimal("approved_unpaid_days", { precision: 5, scale: 1 }).default("0"),
  approvedAt: timestamp("approved_at"),
  comments: text("comments"),
  coveringEmployeeId: varchar("covering_employee_id"),
  isHalfDay: boolean("is_half_day").default(false),
  halfDayPeriod: text("half_day_period"), // morning, evening
  createdAt: timestamp("created_at").defaultNow(),
});

export const leaveBalances = pgTable("leave_balances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull(),
  leaveTypeId: varchar("leave_type_id").notNull(),
  year: integer("year").notNull(),
  entitlement: decimal("entitlement", { precision: 5, scale: 1 }).default("0"),
  used: decimal("used", { precision: 5, scale: 1 }).default("0"),
  carriedForward: decimal("carried_forward", { precision: 5, scale: 1 }).default("0"),
  balance: decimal("balance", { precision: 5, scale: 1 }).default("0"),
});

// ==================== WAREHOUSE LOCATIONS MODULE ====================

export const warehouseLocations = pgTable("warehouse_locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  warehouseId: varchar("warehouse_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  zone: text("zone"),
  aisle: text("aisle"),
  rack: text("rack"),
  shelf: text("shelf"),
  bin: text("bin"),
  capacity: integer("capacity"),
  isActive: boolean("is_active").default(true),
});

// ==================== SERVICE MANAGEMENT MODULE ====================

export const serviceTickets = pgTable("service_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketNumber: text("ticket_number").notNull(),
  customerId: varchar("customer_id"),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  companyId: varchar("company_id"),
  shopId: varchar("shop_id").notNull(),
  branchId: varchar("branch_id"),
  deviceType: text("device_type").notNull(),
  deviceBrand: text("device_brand"),
  deviceModel: text("device_model"),
  serialNumber: text("serial_number"),
  imeiNumber: text("imei_number"),
  problemDescription: text("problem_description").notNull(),
  serviceDescription: text("service_description"),
  receivedDate: timestamp("received_date").defaultNow(),
  expectedReturnDate: timestamp("expected_return_date"),
  actualReturnDate: timestamp("actual_return_date"),
  status: text("status").notNull().default("received"), // received, in_progress, ready, returned, cancelled
  technicianId: varchar("technician_id"),
  technicianName: text("technician_name"),
  serviceAmount: decimal("service_amount", { precision: 12, scale: 3 }).default("0.000"),
  partsAmount: decimal("parts_amount", { precision: 12, scale: 3 }).default("0.000"),
  vatAmount: decimal("vat_amount", { precision: 12, scale: 3 }).default("0.000"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 3 }).default("0.000"),
  paidAmount: decimal("paid_amount", { precision: 12, scale: 3 }).default("0.000"),
  creditAmount: decimal("credit_amount", { precision: 12, scale: 3 }).default("0.000"),
  paymentMethod: text("payment_method"), // cash, card, credit
  bankAccountId: varchar("bank_account_id"),
  paymentStatus: text("payment_status").notNull().default("pending"), // pending, partial, paid
  remarks: text("remarks"),
  attachments: jsonb("attachments").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const serviceTicketPayments = pgTable("service_ticket_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceTicketId: varchar("service_ticket_id").notNull(),
  customerId: varchar("customer_id"),
  shopId: varchar("shop_id"),
  branchId: varchar("branch_id"),
  paymentDate: timestamp("payment_date").defaultNow(),
  paymentMethod: text("payment_method").notNull(), // cash, card, credit
  bankAccountId: varchar("bank_account_id"),
  amount: decimal("amount", { precision: 12, scale: 3 }).notNull(),
  notes: text("notes"),
  reference: text("reference"),
  processedBy: varchar("processed_by"),
});

// ==================== CRM MODULE ====================

export const crmLeads = pgTable("crm_leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  companyName: text("company_name"),
  email: text("email"),
  phone: text("phone"),
  source: text("source"), // website, referral, cold_call, advertisement, other
  assignedTo: varchar("assigned_to"), // employee/user ID
  status: text("status").notNull().default("new"), // new, contacted, qualified, disqualified
  notes: text("notes"),
  erpCompanyId: varchar("erp_company_id"),
  shopId: varchar("shop_id"),
  branchId: varchar("branch_id"),
  convertedToCustomerId: varchar("converted_to_customer_id"), // link to customers table if converted
  convertedAt: timestamp("converted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const crmDeals = pgTable("crm_deals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id"),
  customerId: varchar("customer_id"), // linked after conversion
  title: text("title").notNull(),
  estimatedValue: decimal("estimated_value", { precision: 12, scale: 3 }).default("0.000"),
  expectedCloseDate: timestamp("expected_close_date"),
  stage: text("stage").notNull().default("prospecting"), // prospecting, proposal, negotiation, won, lost
  probability: integer("probability").default(0), // 0-100%
  assignedTo: varchar("assigned_to"),
  notes: text("notes"),
  erpCompanyId: varchar("erp_company_id"),
  shopId: varchar("shop_id"),
  branchId: varchar("branch_id"),
  wonDate: timestamp("won_date"),
  lostDate: timestamp("lost_date"),
  lostReason: text("lost_reason"),
  projectId: varchar("project_id"), // linked after converting to project
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const crmActivities = pgTable("crm_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id"),
  dealId: varchar("deal_id"),
  customerId: varchar("customer_id"),
  type: text("type").notNull(), // call, email, meeting, note
  subject: text("subject").notNull(),
  description: text("description"),
  activityDate: timestamp("activity_date").defaultNow(),
  outcome: text("outcome"),
  nextFollowUpDate: timestamp("next_follow_up_date"),
  assignedTo: varchar("assigned_to"),
  completed: boolean("completed").default(false),
  shopId: varchar("shop_id"),
  branchId: varchar("branch_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const crmLeadNotes = pgTable("crm_lead_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull(),
  content: text("content").notNull(),
  isInternal: boolean("is_internal").default(true),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const crmCalendarEvents = pgTable("crm_calendar_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  eventType: text("event_type").notNull().default("meeting"), // call, meeting, follow_up, task
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  allDay: boolean("all_day").default(false),
  location: text("location"),
  leadId: varchar("lead_id"),
  dealId: varchar("deal_id"),
  customerId: varchar("customer_id"),
  assignedTo: varchar("assigned_to"),
  attendees: text("attendees"), // JSON array of user IDs
  status: text("status").notNull().default("scheduled"), // scheduled, completed, cancelled, missed
  colorCode: text("color_code"),
  reminderMinutes: integer("reminder_minutes").default(30),
  shopId: varchar("shop_id"),
  branchId: varchar("branch_id"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const crmReminders = pgTable("crm_reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  reminderType: text("reminder_type").notNull().default("follow_up"), // follow_up, meeting, call, task, custom
  reminderDate: timestamp("reminder_date").notNull(),
  leadId: varchar("lead_id"),
  dealId: varchar("deal_id"),
  customerId: varchar("customer_id"),
  eventId: varchar("event_id"),
  taskId: varchar("task_id"),
  assignedTo: varchar("assigned_to"),
  status: text("status").notNull().default("pending"), // pending, sent, acknowledged, dismissed
  notificationType: text("notification_type").default("in_app"), // in_app, email, both
  shopId: varchar("shop_id"),
  branchId: varchar("branch_id"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const crmCustomerContacts = pgTable("crm_customer_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull(),
  name: text("name").notNull(),
  title: text("title"),
  email: text("email"),
  phone: text("phone"),
  isPrimary: boolean("is_primary").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const crmNotifications = pgTable("crm_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  message: text("message"),
  type: text("type").notNull().default("info"), // info, warning, alert, reminder
  relatedType: text("related_type"), // lead, deal, customer, event, task
  relatedId: varchar("related_id"),
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  shopId: varchar("shop_id"),
  branchId: varchar("branch_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const crmTasks = pgTable("crm_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  leadId: varchar("lead_id"),
  dealId: varchar("deal_id"),
  customerId: varchar("customer_id"),
  assignedTo: varchar("assigned_to"),
  dueDate: timestamp("due_date"),
  priority: text("priority").notNull().default("medium"), // low, medium, high, urgent
  status: text("status").notNull().default("pending"), // pending, in_progress, completed, cancelled
  completedAt: timestamp("completed_at"),
  shopId: varchar("shop_id"),
  branchId: varchar("branch_id"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ==================== INSERT SCHEMAS ====================

export const insertCompanySchema = createInsertSchema(companies).omit({ id: true });
export const insertShopSchema = createInsertSchema(shops).omit({ id: true });
export const insertBranchSchema = createInsertSchema(branches).omit({ id: true });
export const insertWarehouseSchema = createInsertSchema(warehouses).omit({ id: true });
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true });
export const insertBrandSchema = createInsertSchema(brands).omit({ id: true });
export const insertSupplierSchema = createInsertSchema(suppliers).omit({ id: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true }).extend({
  bankAccountId: z.string().optional(),
});
export const insertInventorySchema = createInsertSchema(inventory).omit({ id: true });
export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true });
export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders).omit({ id: true });
export const insertPurchaseOrderItemSchema = createInsertSchema(purchaseOrderItems).omit({ id: true });
export const insertPurchaseSchema = createInsertSchema(purchases).omit({ id: true });
export const insertPurchaseItemSchema = createInsertSchema(purchaseItems).omit({ id: true });
export const insertPurchasePaymentSchema = createInsertSchema(purchasePayments).omit({ id: true });
export const insertSaleSchema = createInsertSchema(sales).omit({ id: true });
export const insertBankAccountSchema = createInsertSchema(bankAccounts).omit({ id: true });
export const insertBankTransactionSchema = createInsertSchema(bankTransactions).omit({ id: true });
export const insertPettyCashSchema = createInsertSchema(pettyCash).omit({ id: true });
export const insertCapitalSchema = createInsertSchema(capital).omit({ id: true });
export const insertEmployeeSchema = createInsertSchema(employees).omit({ id: true });
export const insertPettyCashTransactionSchema = createInsertSchema(pettyCashTransactions).omit({ id: true });
export const insertSalaryPaymentSchema = createInsertSchema(salaryPayments).omit({ id: true });
export const insertSalaryAdvanceSchema = createInsertSchema(salaryAdvances).omit({ id: true });
export const insertClientSchema = createInsertSchema(clients).omit({ id: true });
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true });
export const insertProjectExpenseSchema = createInsertSchema(projectExpenses).omit({ id: true });
export const insertProjectIncomeSchema = createInsertSchema(projectIncome).omit({ id: true });
export const insertStockTransferSchema = createInsertSchema(stockTransfers).extend({
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().positive(),
    serialNumbers: z.string().optional()
  })).optional(),
  bankAccountId: z.string().optional()
}).omit({ id: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, refreshToken: true, lastLogin: true });
export const insertChartOfAccountsSchema = createInsertSchema(chartOfAccounts).omit({ id: true });
export const insertJournalEntrySchema = createInsertSchema(journalEntries).omit({ id: true });
export const insertJournalLineSchema = createInsertSchema(journalLines).omit({ id: true });
export const insertQuotationSchema = createInsertSchema(quotations).omit({ id: true });
export const insertQuotationItemSchema = createInsertSchema(quotationItems).omit({ id: true });
export const insertEmployeeDocumentSchema = createInsertSchema(employeeDocuments).omit({ id: true });
export const insertComplianceDocumentSchema = createInsertSchema(complianceDocuments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDocumentAuditLogSchema = createInsertSchema(documentAuditLogs).omit({ id: true, createdAt: true });
export const insertComplianceReminderSchema = createInsertSchema(complianceReminders).omit({ id: true, createdAt: true });
export const insertLeaveTypeSchema = createInsertSchema(leaveTypes).omit({ id: true });
export const insertLeaveRequestSchema = createInsertSchema(leaveRequests, {
  startDate: z.preprocess(
    (val) => (typeof val === "string" ? new Date(val) : val),
    z.coerce.date()
  ),
  endDate: z.preprocess(
    (val) => (typeof val === "string" ? new Date(val) : val),
    z.coerce.date()
  )
}).omit({ id: true });
export const insertLeaveBalanceSchema = createInsertSchema(leaveBalances).omit({ id: true });
export const insertWarehouseLocationSchema = createInsertSchema(warehouseLocations).omit({ id: true });
export const insertSaleReturnSchema = createInsertSchema(saleReturns).omit({ id: true });
export const insertSaleReturnItemSchema = createInsertSchema(saleReturnItems).omit({ id: true });
export const insertSaleReplacementSchema = createInsertSchema(saleReplacements).omit({ id: true });
export const insertSalePaymentSchema = createInsertSchema(salePayments).omit({ id: true });
export const insertSaleItemSchema = createInsertSchema(saleItems).omit({ id: true });
export const insertSerialNumberSchema = createInsertSchema(serialNumbers).omit({ id: true });
export const insertPurchaseReturnSchema = createInsertSchema(purchaseReturns).omit({ id: true });
export const insertPurchaseReturnItemSchema = createInsertSchema(purchaseReturnItems).omit({ id: true });
export const insertSupplierCreditSchema = createInsertSchema(supplierCredits).omit({ id: true });
export const insertSupplierCreditTransactionSchema = createInsertSchema(supplierCreditTransactions).omit({ id: true });
export const insertSupplierRefundSchema = createInsertSchema(supplierRefunds).omit({ id: true });
export const insertServiceTicketSchema = createInsertSchema(serviceTickets).omit({ id: true, ticketNumber: true }).extend({
  receivedDate: z.preprocess((arg) => (typeof arg === "string" ? new Date(arg) : arg), z.date().optional().nullable()),
  expectedReturnDate: z.preprocess((arg) => (typeof arg === "string" ? new Date(arg) : arg), z.date().optional().nullable()),
  actualReturnDate: z.preprocess((arg) => (typeof arg === "string" ? new Date(arg) : arg), z.date().optional().nullable()),
  attachments: z.array(z.string()).optional().default([]),
});
export const insertServiceTicketPaymentSchema = createInsertSchema(serviceTicketPayments).omit({ id: true });
export const insertCrmLeadSchema = createInsertSchema(crmLeads).omit({ id: true });
export const insertCrmDealSchema = createInsertSchema(crmDeals).omit({ id: true });
export const insertCrmActivitySchema = createInsertSchema(crmActivities).omit({ id: true });
export const insertCrmLeadNoteSchema = createInsertSchema(crmLeadNotes).omit({ id: true });
export const insertCrmCalendarEventSchema = createInsertSchema(crmCalendarEvents).omit({ id: true });
export const insertCrmReminderSchema = createInsertSchema(crmReminders).omit({ id: true });
export const insertCrmCustomerContactSchema = createInsertSchema(crmCustomerContacts).omit({ id: true });
export const insertCrmNotificationSchema = createInsertSchema(crmNotifications).omit({ id: true });
export const insertCrmTaskSchema = createInsertSchema(crmTasks).omit({ id: true });

// ==================== INSERT TYPES ====================

export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type InsertShop = z.infer<typeof insertShopSchema>;
export type InsertBranch = z.infer<typeof insertBranchSchema>;
export type InsertWarehouse = z.infer<typeof insertWarehouseSchema>;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type InsertBrand = z.infer<typeof insertBrandSchema>;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertInventory = z.infer<typeof insertInventorySchema>;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;
export type InsertPurchaseOrderItem = z.infer<typeof insertPurchaseOrderItemSchema>;
export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;
export type InsertPurchaseItem = z.infer<typeof insertPurchaseItemSchema>;
export type InsertPurchasePayment = z.infer<typeof insertPurchasePaymentSchema>;
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type InsertBankAccount = z.infer<typeof insertBankAccountSchema>;
export type InsertBankTransaction = z.infer<typeof insertBankTransactionSchema>;
export type InsertPettyCash = z.infer<typeof insertPettyCashSchema>;
export type InsertPettyCashTransaction = z.infer<typeof insertPettyCashTransactionSchema>;
export type InsertCapital = z.infer<typeof insertCapitalSchema>;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type InsertSalaryPayment = z.infer<typeof insertSalaryPaymentSchema>;
export type InsertSalaryAdvance = z.infer<typeof insertSalaryAdvanceSchema>;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type InsertProjectExpense = z.infer<typeof insertProjectExpenseSchema>;
export type InsertProjectIncome = z.infer<typeof insertProjectIncomeSchema>;
export type InsertStockTransfer = z.infer<typeof insertStockTransferSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertChartOfAccounts = z.infer<typeof insertChartOfAccountsSchema>;
export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
export type InsertJournalLine = z.infer<typeof insertJournalLineSchema>;
export type InsertQuotation = z.infer<typeof insertQuotationSchema>;
export type InsertQuotationItem = z.infer<typeof insertQuotationItemSchema>;
export type InsertEmployeeDocument = z.infer<typeof insertEmployeeDocumentSchema>;
export type InsertComplianceDocument = z.infer<typeof insertComplianceDocumentSchema>;
export type InsertDocumentAuditLog = z.infer<typeof insertDocumentAuditLogSchema>;
export type InsertComplianceReminder = z.infer<typeof insertComplianceReminderSchema>;
export type InsertLeaveType = z.infer<typeof insertLeaveTypeSchema>;
export type InsertLeaveRequest = z.infer<typeof insertLeaveRequestSchema>;
export type InsertLeaveBalance = z.infer<typeof insertLeaveBalanceSchema>;
export type InsertWarehouseLocation = z.infer<typeof insertWarehouseLocationSchema>;
export type InsertSaleReturn = z.infer<typeof insertSaleReturnSchema>;
export type InsertSaleReturnItem = z.infer<typeof insertSaleReturnItemSchema>;
export type InsertSaleReplacement = z.infer<typeof insertSaleReplacementSchema>;
export type InsertSalePayment = z.infer<typeof insertSalePaymentSchema>;
export type InsertSaleItem = z.infer<typeof insertSaleItemSchema>;
export type InsertSerialNumber = z.infer<typeof insertSerialNumberSchema>;
export type InsertPurchaseReturn = z.infer<typeof insertPurchaseReturnSchema>;
export type InsertPurchaseReturnItem = z.infer<typeof insertPurchaseReturnItemSchema>;
export type InsertSupplierCredit = z.infer<typeof insertSupplierCreditSchema>;
export type InsertSupplierCreditTransaction = z.infer<typeof insertSupplierCreditTransactionSchema>;
export type InsertServiceTicket = z.infer<typeof insertServiceTicketSchema>;
export type InsertServiceTicketPayment = z.infer<typeof insertServiceTicketPaymentSchema>;
export type InsertCrmLead = z.infer<typeof insertCrmLeadSchema>;
export type InsertCrmDeal = z.infer<typeof insertCrmDealSchema>;
export type InsertCrmActivity = z.infer<typeof insertCrmActivitySchema>;

// ==================== SELECT TYPES ====================

export type Company = typeof companies.$inferSelect;
export type Shop = typeof shops.$inferSelect;
export type Branch = typeof branches.$inferSelect;
export type Warehouse = typeof warehouses.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Brand = typeof brands.$inferSelect;
export type Manufacturer = typeof manufacturers.$inferSelect;
export type Unit = typeof units.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Inventory = typeof inventory.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type Purchase = typeof purchases.$inferSelect;
export type PurchaseItem = typeof purchaseItems.$inferSelect;
export type PurchasePayment = typeof purchasePayments.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type BankAccount = typeof bankAccounts.$inferSelect;
export type BankTransaction = typeof bankTransactions.$inferSelect;
export type PettyCash = typeof pettyCash.$inferSelect;
export type Capital = typeof capital.$inferSelect;
export type Employee = typeof employees.$inferSelect;
export type SalaryPayment = typeof salaryPayments.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Project = typeof projects.$inferSelect;
export const insertTaskTimerSessionSchema = createInsertSchema(taskTimerSessions);
export const insertTimesheetSchema = createInsertSchema(timesheets);

export type Task = typeof tasks.$inferSelect;
export type TaskAttachment = typeof taskAttachments.$inferSelect;
export type ProjectFile = typeof projectFiles.$inferSelect;
export type ProjectExpense = typeof projectExpenses.$inferSelect;
export type ProjectIncome = typeof projectIncome.$inferSelect;
export type StockTransfer = typeof stockTransfers.$inferSelect;
export type User = typeof users.$inferSelect;
export type ChartOfAccount = typeof chartOfAccounts.$inferSelect;
export type JournalEntry = typeof journalEntries.$inferSelect;
export type JournalLine = typeof journalLines.$inferSelect;
export type Quotation = typeof quotations.$inferSelect;
export type QuotationItem = typeof quotationItems.$inferSelect;
export type EmployeeDocument = typeof employeeDocuments.$inferSelect;
export type ComplianceDocument = typeof complianceDocuments.$inferSelect;
export type DocumentAuditLog = typeof documentAuditLogs.$inferSelect;
export type ComplianceReminder = typeof complianceReminders.$inferSelect;
export type LeaveType = typeof leaveTypes.$inferSelect;
export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type LeaveBalance = typeof leaveBalances.$inferSelect;
export type WarehouseLocation = typeof warehouseLocations.$inferSelect;
export type SaleReturn = typeof saleReturns.$inferSelect;
export type SaleReturnItem = typeof saleReturnItems.$inferSelect;
export type SaleReplacement = typeof saleReplacements.$inferSelect;
export type SalePayment = typeof salePayments.$inferSelect;
export type SaleItem = typeof saleItems.$inferSelect;
export type SerialNumber = typeof serialNumbers.$inferSelect;
export type PurchaseReturn = typeof purchaseReturns.$inferSelect;
export type PurchaseReturnItem = typeof purchaseReturnItems.$inferSelect;
export type SupplierCredit = typeof supplierCredits.$inferSelect;
export type SupplierCreditTransaction = typeof supplierCreditTransactions.$inferSelect;
export type SupplierRefund = typeof supplierRefunds.$inferSelect;
export type InsertSupplierRefund = z.infer<typeof insertSupplierRefundSchema>;
export type ServiceTicket = typeof serviceTickets.$inferSelect;
export type ServiceTicketPayment = typeof serviceTicketPayments.$inferSelect;
export type CrmLead = typeof crmLeads.$inferSelect;
export type CrmDeal = typeof crmDeals.$inferSelect;
export type CrmActivity = typeof crmActivities.$inferSelect;
export type CrmLeadNote = typeof crmLeadNotes.$inferSelect;
export type CrmCalendarEvent = typeof crmCalendarEvents.$inferSelect;
export type CrmReminder = typeof crmReminders.$inferSelect;
export type CrmCustomerContact = typeof crmCustomerContacts.$inferSelect;
export type CrmNotification = typeof crmNotifications.$inferSelect;
export type CrmTask = typeof crmTasks.$inferSelect;
export type InsertCrmLeadNote = z.infer<typeof insertCrmLeadNoteSchema>;
export type InsertCrmCalendarEvent = z.infer<typeof insertCrmCalendarEventSchema>;
export type InsertCrmReminder = z.infer<typeof insertCrmReminderSchema>;
export type InsertCrmCustomerContact = z.infer<typeof insertCrmCustomerContactSchema>;
export type InsertCrmNotification = z.infer<typeof insertCrmNotificationSchema>;
export type InsertCrmTask = z.infer<typeof insertCrmTaskSchema>;

export type TaskTimerSession = typeof taskTimerSessions.$inferSelect;
export type InsertTaskTimerSession = z.infer<typeof insertTaskTimerSessionSchema>;
export type Timesheet = typeof timesheets.$inferSelect;
export type InsertTimesheet = z.infer<typeof insertTimesheetSchema>;

// ==================== LOGISTICS MODULE ====================

export const zones = pgTable("zones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  companyId: varchar("company_id"),
  shopId: varchar("shop_id"),
  branchId: varchar("branch_id"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const supervisorZones = pgTable("supervisor_zones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  supervisorId: varchar("supervisor_id").notNull(), // points to users.id
  zoneId: varchar("zone_id").notNull(), // points to zones.id
  createdAt: timestamp("created_at").defaultNow(),
});

export const contracts = pgTable("contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull(), // points to clients.id
  name: text("name").notNull(),
  type: text("type").notNull(), // "daily" or "lease"
  monthlyRate: decimal("monthly_rate", { precision: 12, scale: 3 }).default("0.000"),
  numVehicles: integer("num_vehicles").default(0),
  otCharges: decimal("ot_charges", { precision: 12, scale: 3 }).default("0.000"),
  holidayCharges: decimal("holiday_charges", { precision: 12, scale: 3 }).default("0.000"),
  documents: jsonb("documents").$type<{ name: string; url: string }[]>().default([]),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vehicles = pgTable("vehicles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  plateNumber: text("plate_number").notNull(),
  type: text("type").notNull(), // "owned" or "outsourced"
  capacity: text("capacity"),
  complianceDetails: jsonb("compliance_details").$type<{ insuranceExpiry?: string; permitExpiry?: string; registrationExpiry?: string; lastService?: string }>().default({}),
  status: text("status").notNull().default("available"), // "available", "in_transit", "maintenance"
  currentZoneId: varchar("current_zone_id"), // points to zones.id
  createdAt: timestamp("created_at").defaultNow(),
});

export const locations = pgTable("locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 6 }),
  longitude: decimal("longitude", { precision: 10, scale: 6 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const rfqs = pgTable("rfqs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  rfqNumber: text("rfq_number").notNull().unique(),
  customerId: varchar("customer_id").notNull(), // points to clients.id
  originLocationId: varchar("origin_location_id"), // points to locations.id
  destinationLocationId: varchar("destination_location_id"), // points to locations.id
  transitRoute: text("transit_route"), // multi-country route summary
  transportationCharges: decimal("transportation_charges", { precision: 12, scale: 3 }).default("0.000"),
  outsourcedTruckCost: decimal("outsourced_truck_cost", { precision: 12, scale: 3 }).default("0.000"),
  tollTransitCharges: decimal("toll_transit_charges", { precision: 12, scale: 3 }).default("0.000"),
  clearanceAgentCharges: decimal("clearance_agent_charges", { precision: 12, scale: 3 }).default("0.000"),
  totalCharges: decimal("total_charges", { precision: 12, scale: 3 }).default("0.000"),
  status: text("status").notNull().default("pending"), // "pending", "approved", "rejected", "converted"
  createdAt: timestamp("created_at").defaultNow(),
});

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderNumber: text("order_number").notNull().unique(),
  customerId: varchar("customer_id").notNull(), // points to clients.id
  rfqId: varchar("rfq_id"), // points to rfqs.id, optional
  cargoDetails: text("cargo_details").notNull(),
  weight: decimal("weight", { precision: 10, scale: 3 }),
  loadType: text("load_type"), // LTL, FTL
  documents: jsonb("documents").$type<{ name: string; url: string }[]>().default([]),
  pickupLocationId: varchar("pickup_location_id"), // points to locations.id
  deliveryLocationId: varchar("delivery_location_id"), // points to locations.id
  status: text("status").notNull().default("pending"), // "pending", "confirmed", "cancelled", "incomplete", "completed"
  zoneId: varchar("zone_id"), // points to zones.id
  createdAt: timestamp("created_at").defaultNow(),
});

export const trips = pgTable("trips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tripNumber: text("trip_number").notNull().unique(),
  vehicleId: varchar("vehicle_id").notNull(), // points to vehicles.id
  driverId: varchar("driver_id").notNull(), // points to employees.id
  status: text("status").notNull().default("pending"), // "pending", "in_transit", "completed", "cancelled"
  route: text("route"),
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tripOrders = pgTable("trip_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tripId: varchar("trip_id").notNull(), // points to trips.id
  orderId: varchar("order_id").notNull(), // points to orders.id
  createdAt: timestamp("created_at").defaultNow(),
});

export const deliveries = pgTable("deliveries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tripId: varchar("trip_id").notNull(), // points to trips.id
  orderId: varchar("order_id").notNull(), // points to orders.id
  status: text("status").notNull().default("pending"), // "pending", "partial", "delivered", "failed"
  podUrl: text("pod_url"),
  issueLog: text("issue_log"),
  deliveryTimestamp: timestamp("delivery_timestamp"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const driverActivities = pgTable("driver_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id").notNull(), // points to employees.id
  tripId: varchar("trip_id"), // points to trips.id
  kmBefore: integer("km_before"),
  kmAfter: integer("km_after"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const driverAttendance = pgTable("driver_attendance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id").notNull(), // points to employees.id
  checkInTime: timestamp("check_in_time"),
  checkOutTime: timestamp("check_out_time"),
  latitude: decimal("latitude", { precision: 10, scale: 6 }),
  longitude: decimal("longitude", { precision: 10, scale: 6 }),
  checkInLocation: text("check_in_location"),
  isAuthorizedDevice: boolean("is_authorized_device").default(false),
  autoVerified: boolean("auto_verified").default(false),
  shiftType: text("shift_type").default("regular"),
  shiftHours: decimal("shift_hours", { precision: 5, scale: 2 }).default("0.00"),
  overtimeHours: decimal("overtime_hours", { precision: 5, scale: 2 }).default("0.00"),
  status: text("status").notNull().default("present"), // "present", "absent"
  createdAt: timestamp("created_at").defaultNow(),
});

export const vehicleMaintenance = pgTable("vehicle_maintenance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vehicleId: varchar("vehicle_id").notNull(), // points to vehicles.id
  serviceDate: date("service_date"),
  serviceSchedule: text("service_schedule"), // title or details
  repairLogs: text("repair_logs"),
  cost: decimal("cost", { precision: 12, scale: 3 }).default("0.000"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const fuelLogs = pgTable("fuel_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vehicleId: varchar("vehicle_id").notNull(), // points to vehicles.id
  tripId: varchar("trip_id"), // points to trips.id
  fuelExpense: decimal("fuel_expense", { precision: 12, scale: 3 }).default("0.000"),
  liters: decimal("liters", { precision: 10, scale: 3 }),
  date: date("date"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userActivityLogs = pgTable("user_activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  username: text("username"),
  action: text("action").notNull(),
  details: text("details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ==================== ADVANCED MODULES (DRIVER, FINANCE, SETTINGS) ====================

export const drivers = pgTable("drivers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  packageType: text("package_type").notNull().default("standard"),
  baseSalary: decimal("base_salary", { precision: 12, scale: 3 }).default("0.000"),
  holidayPayRate: text("holiday_pay_rate").notNull().default("1.5x"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const driverEarnings = pgTable("driver_earnings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id").notNull(),
  tripId: varchar("trip_id"),
  basePay: decimal("base_pay", { precision: 12, scale: 3 }).default("0.000"),
  allowances: decimal("allowances", { precision: 12, scale: 3 }).default("0.000"),
  overtimePay: decimal("overtime_pay", { precision: 12, scale: 3 }).default("0.000"),
  holidayPay: decimal("holiday_pay", { precision: 12, scale: 3 }).default("0.000"),
  totalEarnings: decimal("total_earnings", { precision: 12, scale: 3 }).default("0.000"),
  status: text("status").notNull().default("pending"), // pending, paid
  createdAt: timestamp("created_at").defaultNow(),
});

export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: text("invoice_number").notNull().unique(),
  type: text("type").notNull(), // "delivery" or "contract"
  customerId: varchar("customer_id").notNull(),
  orderId: varchar("order_id"),
  tripId: varchar("trip_id"),
  contractId: varchar("contract_id"),
  subtotal: decimal("subtotal", { precision: 12, scale: 3 }).default("0.000"),
  vatAmount: decimal("vat_amount", { precision: 12, scale: 3 }).default("0.000"),
  discount: decimal("discount", { precision: 12, scale: 3 }).default("0.000"),
  total: decimal("total", { precision: 12, scale: 3 }).default("0.000"),
  status: text("status").notNull().default("draft"), // draft, sent, paid, overdue
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const dynamicExpenses = pgTable("dynamic_expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: text("category").notNull(), // "driver", "clearing_agent", "toll", "other"
  tripId: varchar("trip_id"),
  vehicleId: varchar("vehicle_id"),
  employeeId: varchar("employee_id"),
  amount: decimal("amount", { precision: 12, scale: 3 }).notNull(),
  description: text("description"),
  receiptUrl: text("receipt_url"),
  status: text("status").notNull().default("pending"), // pending, approved, paid
  createdAt: timestamp("created_at").defaultNow(),
});

export const companyAssets = pgTable("company_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  assetType: text("asset_type").notNull(), // "truck", "spare_part", "equipment"
  vehicleId: varchar("vehicle_id"),
  value: decimal("value", { precision: 12, scale: 3 }).default("0.000"),
  purchaseDate: timestamp("purchase_date"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const companySettings = pgTable("company_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id"),
  notificationPrefs: jsonb("notification_prefs").$type<{ email: boolean; sms: boolean; push: boolean }>().default({ email: true, sms: false, push: true }),
  regionalFormats: jsonb("regional_formats").$type<{ currency: string; dateFormat: string; timezone: string }>().default({ currency: "OMR", dateFormat: "DD/MM/YYYY", timezone: "Asia/Muscat" }),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Zod insertion schemas
export const insertZoneSchema = createInsertSchema(zones).omit({ id: true, createdAt: true });
export const insertSupervisorZoneSchema = createInsertSchema(supervisorZones).omit({ id: true, createdAt: true });
export const insertContractSchema = createInsertSchema(contracts).omit({ id: true, createdAt: true });
export const insertVehicleSchema = createInsertSchema(vehicles).omit({ id: true, createdAt: true });
export const insertLocationSchema = createInsertSchema(locations).omit({ id: true, createdAt: true });
export const insertRfqSchema = createInsertSchema(rfqs).omit({ id: true, createdAt: true });
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true });
export const insertTripSchema = createInsertSchema(trips).omit({ id: true, createdAt: true });
export const insertTripOrderSchema = createInsertSchema(tripOrders).omit({ id: true, createdAt: true });
export const insertDeliverySchema = createInsertSchema(deliveries).omit({ id: true, createdAt: true });
export const insertDriverActivitySchema = createInsertSchema(driverActivities).omit({ id: true, createdAt: true });
export const insertDriverAttendanceSchema = createInsertSchema(driverAttendance).omit({ id: true, createdAt: true });
export const insertVehicleMaintenanceSchema = createInsertSchema(vehicleMaintenance).omit({ id: true, createdAt: true });
export const insertFuelLogSchema = createInsertSchema(fuelLogs).omit({ id: true, createdAt: true });
export const insertUserActivityLogSchema = createInsertSchema(userActivityLogs).omit({ id: true, createdAt: true });
export const insertDriverSchema = createInsertSchema(drivers).omit({ id: true, createdAt: true });
export const insertDriverEarningsSchema = createInsertSchema(driverEarnings).omit({ id: true, createdAt: true });
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true });
export const insertDynamicExpenseSchema = createInsertSchema(dynamicExpenses).omit({ id: true, createdAt: true });
export const insertCompanyAssetSchema = createInsertSchema(companyAssets).omit({ id: true, createdAt: true });
export const insertCompanySettingSchema = createInsertSchema(companySettings).omit({ id: true, updatedAt: true });

// Types
export type Zone = typeof zones.$inferSelect;
export type InsertZone = z.infer<typeof insertZoneSchema>;
export type SupervisorZone = typeof supervisorZones.$inferSelect;
export type InsertSupervisorZone = z.infer<typeof insertSupervisorZoneSchema>;
export type Contract = typeof contracts.$inferSelect;
export type InsertContract = z.infer<typeof insertContractSchema>;
export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Location = typeof locations.$inferSelect;
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Rfq = typeof rfqs.$inferSelect;
export type InsertRfq = z.infer<typeof insertRfqSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Trip = typeof trips.$inferSelect;
export type InsertTrip = z.infer<typeof insertTripSchema>;
export type TripOrder = typeof tripOrders.$inferSelect;
export type InsertTripOrder = z.infer<typeof insertTripOrderSchema>;
export type Delivery = typeof deliveries.$inferSelect;
export type InsertDelivery = z.infer<typeof insertDeliverySchema>;
export type DriverActivity = typeof driverActivities.$inferSelect;
export type InsertDriverActivity = z.infer<typeof insertDriverActivitySchema>;
export type DriverAttendance = typeof driverAttendance.$inferSelect;
export type InsertDriverAttendance = z.infer<typeof insertDriverAttendanceSchema>;
export type VehicleMaintenance = typeof vehicleMaintenance.$inferSelect;
export type InsertVehicleMaintenance = z.infer<typeof insertVehicleMaintenanceSchema>;
export type FuelLog = typeof fuelLogs.$inferSelect;
export type InsertFuelLog = z.infer<typeof insertFuelLogSchema>;
export type UserActivityLog = typeof userActivityLogs.$inferSelect;
export type InsertUserActivityLog = z.infer<typeof insertUserActivityLogSchema>;
export type Driver = typeof drivers.$inferSelect;
export type InsertDriver = z.infer<typeof insertDriverSchema>;
export type DriverEarning = typeof driverEarnings.$inferSelect;
export type InsertDriverEarning = z.infer<typeof insertDriverEarningsSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type DynamicExpense = typeof dynamicExpenses.$inferSelect;
export type InsertDynamicExpense = z.infer<typeof insertDynamicExpenseSchema>;
export type CompanyAsset = typeof companyAssets.$inferSelect;
export type InsertCompanyAsset = z.infer<typeof insertCompanyAssetSchema>;
export type CompanySetting = typeof companySettings.$inferSelect;
export type InsertCompanySetting = z.infer<typeof insertCompanySettingSchema>;
