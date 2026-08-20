import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

let schemaCheckDone = false;

export async function ensureDriverTablesSchema() {
  if (schemaCheckDone) return;
  try {
    await db.execute(`
      ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "default_crew_member_id" varchar;
      ALTER TABLE "driver_attendance" ADD COLUMN IF NOT EXISTS "end_latitude" numeric(10, 6);
      ALTER TABLE "driver_attendance" ADD COLUMN IF NOT EXISTS "end_longitude" numeric(10, 6);
      ALTER TABLE "driver_attendance" ADD COLUMN IF NOT EXISTS "truck_id" varchar;
      ALTER TABLE "driver_attendance" ADD COLUMN IF NOT EXISTS "opening_km" integer;
      ALTER TABLE "driver_attendance" ADD COLUMN IF NOT EXISTS "opening_km_timestamp" timestamp;
      ALTER TABLE "driver_attendance" ADD COLUMN IF NOT EXISTS "closing_km" integer;
      ALTER TABLE "driver_attendance" ADD COLUMN IF NOT EXISTS "closing_km_timestamp" timestamp;
      ALTER TABLE "driver_attendance" ADD COLUMN IF NOT EXISTS "check_in_location" text;
      ALTER TABLE "driver_attendance" ADD COLUMN IF NOT EXISTS "is_authorized_device" boolean DEFAULT false;
      ALTER TABLE "driver_attendance" ADD COLUMN IF NOT EXISTS "auto_verified" boolean DEFAULT false;
      ALTER TABLE "driver_attendance" ADD COLUMN IF NOT EXISTS "shift_type" text DEFAULT 'regular';
      ALTER TABLE "driver_attendance" ADD COLUMN IF NOT EXISTS "shift_hours" numeric(5, 2) DEFAULT '0.00';
      ALTER TABLE "driver_attendance" ADD COLUMN IF NOT EXISTS "overtime_hours" numeric(5, 2) DEFAULT '0.00';
      ALTER TABLE "driver_attendance" ADD COLUMN IF NOT EXISTS "crew_member_id" varchar;
      ALTER TABLE "driver_attendance" ADD COLUMN IF NOT EXISTS "crew_check_in_time" timestamp;
      ALTER TABLE "driver_attendance" ADD COLUMN IF NOT EXISTS "crew_check_out_time" timestamp;

      CREATE TABLE IF NOT EXISTS "vehicle_maintenance" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "vehicle_id" varchar NOT NULL,
        "driver_id" varchar,
        "current_km" integer,
        "maintenance_type" text,
        "service_date" date,
        "time" text,
        "service_schedule" text,
        "repair_logs" text,
        "notes" text,
        "photos" jsonb DEFAULT '[]'::jsonb,
        "cost" numeric(12, 3) DEFAULT '0.000',
        "created_at" timestamp DEFAULT now()
      );

      ALTER TABLE "vehicle_maintenance" ADD COLUMN IF NOT EXISTS "driver_id" varchar;
      ALTER TABLE "vehicle_maintenance" ADD COLUMN IF NOT EXISTS "current_km" integer;
      ALTER TABLE "vehicle_maintenance" ADD COLUMN IF NOT EXISTS "maintenance_type" text;
      ALTER TABLE "vehicle_maintenance" ADD COLUMN IF NOT EXISTS "time" text;
      ALTER TABLE "vehicle_maintenance" ADD COLUMN IF NOT EXISTS "notes" text;

      CREATE TABLE IF NOT EXISTS "fuel_logs" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "vehicle_id" varchar NOT NULL,
        "driver_id" varchar,
        "trip_id" varchar,
        "current_km" integer,
        "fuel_expense" numeric(12, 3) DEFAULT '0.000',
        "liters" numeric(10, 3),
        "fuel_station" text,
        "notes" text,
        "photos" jsonb DEFAULT '[]'::jsonb,
        "date" date,
        "time" text,
        "currency" text DEFAULT 'OMR',
        "created_at" timestamp DEFAULT now()
      );

      ALTER TABLE "fuel_logs" ADD COLUMN IF NOT EXISTS "driver_id" varchar;
      ALTER TABLE "fuel_logs" ADD COLUMN IF NOT EXISTS "current_km" integer;
      ALTER TABLE "fuel_logs" ADD COLUMN IF NOT EXISTS "fuel_station" text;
      ALTER TABLE "fuel_logs" ADD COLUMN IF NOT EXISTS "notes" text;
      ALTER TABLE "fuel_logs" ADD COLUMN IF NOT EXISTS "time" text;
      ALTER TABLE "fuel_logs" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'OMR';

      CREATE TABLE IF NOT EXISTS "user_activity_logs" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" varchar,
        "username" text,
        "action" text NOT NULL,
        "details" text,
        "ip_address" text,
        "created_at" timestamp DEFAULT now()
      );

      ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "current_zone_id" varchar;
      ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "assigned_brand_id" varchar;
      ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "assigned_driver_id" varchar;
      ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "storage_type" varchar;

      ALTER TABLE "dispatch_items" ADD COLUMN IF NOT EXISTS "to_no" varchar;
      ALTER TABLE "dispatch_items" ADD COLUMN IF NOT EXISTS "line_number" varchar;
      ALTER TABLE "dispatch_items" ADD COLUMN IF NOT EXISTS "requested_delivery_date" date;
      ALTER TABLE "dispatch_items" ADD COLUMN IF NOT EXISTS "storage_type" varchar;
      ALTER TABLE "dispatch_items" ADD COLUMN IF NOT EXISTS "uom" varchar;
      ALTER TABLE "dispatch_items" ADD COLUMN IF NOT EXISTS "from_org" varchar;
      ALTER TABLE "dispatch_items" ADD COLUMN IF NOT EXISTS "requested_qty" numeric(10, 3);
      ALTER TABLE "dispatch_items" ADD COLUMN IF NOT EXISTS "weight" numeric(10, 3);
      ALTER TABLE "dispatch_items" ADD COLUMN IF NOT EXISTS "total_delivered" numeric(10, 3);
      ALTER TABLE "dispatch_items" ADD COLUMN IF NOT EXISTS "remaining" numeric(10, 3);
      ALTER TABLE "dispatch_items" ADD COLUMN IF NOT EXISTS "remark" text;
      ALTER TABLE "dispatch_items" ADD COLUMN IF NOT EXISTS "grn_number" text;
      ALTER TABLE "dispatch_items" ADD COLUMN IF NOT EXISTS "override_route_id" varchar;

      CREATE TABLE IF NOT EXISTS "dispatch_deliveries" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "dispatch_item_id" varchar NOT NULL,
        "driver_id" varchar,
        "outlet_id" varchar,
        "delivered_qty" numeric(10, 3),
        "remaining_qty" numeric(10, 3),
        "damaged_qty" numeric(10, 3),
        "damage_reason" text,
        "remark" text,
        "pod_url" text,
        "temperature" text,
        "status" text DEFAULT 'pending',
        "delivered_at" timestamp,
        "delivery_time" text,
        "created_at" timestamp DEFAULT now()
      );

      ALTER TABLE "dispatch_deliveries" ADD COLUMN IF NOT EXISTS "driver_id" varchar;
      ALTER TABLE "dispatch_deliveries" ADD COLUMN IF NOT EXISTS "outlet_id" varchar;
      ALTER TABLE "dispatch_deliveries" ADD COLUMN IF NOT EXISTS "delivered_qty" numeric(10, 3);
      ALTER TABLE "dispatch_deliveries" ADD COLUMN IF NOT EXISTS "remaining_qty" numeric(10, 3);
      ALTER TABLE "dispatch_deliveries" ADD COLUMN IF NOT EXISTS "damaged_qty" numeric(10, 3);
      ALTER TABLE "dispatch_deliveries" ADD COLUMN IF NOT EXISTS "damage_reason" text;
      ALTER TABLE "dispatch_deliveries" ADD COLUMN IF NOT EXISTS "remark" text;
      ALTER TABLE "dispatch_deliveries" ADD COLUMN IF NOT EXISTS "pod_url" text;
      ALTER TABLE "dispatch_deliveries" ADD COLUMN IF NOT EXISTS "temperature" text;
      ALTER TABLE "dispatch_deliveries" ADD COLUMN IF NOT EXISTS "pot_url" text;
      ALTER TABLE "dispatch_deliveries" ADD COLUMN IF NOT EXISTS "delivery_start_time" timestamp;
      ALTER TABLE "dispatch_deliveries" ADD COLUMN IF NOT EXISTS "delivery_end_time" timestamp;
      ALTER TABLE "dispatch_deliveries" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending';
      ALTER TABLE "dispatch_deliveries" ADD COLUMN IF NOT EXISTS "delivered_at" timestamp;
      ALTER TABLE "dispatch_deliveries" ADD COLUMN IF NOT EXISTS "delivery_time" text;

      ALTER TABLE "dispatch_outlet_zone_overrides" ADD COLUMN IF NOT EXISTS "override_truck_id" varchar;

      CREATE TABLE IF NOT EXISTS "dispatch_truck_assignments" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "sheet_id" varchar NOT NULL,
        "truck_id" varchar NOT NULL,
        "driver_id" varchar,
        "zone_id" varchar NOT NULL,
        "used_capacity" numeric(10, 3) DEFAULT '0',
        "created_at" timestamp DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "dispatch_outlet_truck_assignments" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "truck_assignment_id" varchar NOT NULL,
        "outlet_code" text NOT NULL,
        "outlet_id" varchar,
        "allocated_weight" numeric(10, 3) DEFAULT '0',
        "sequence" integer DEFAULT 0,
        "created_at" timestamp DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "dispatch_outlet_sequences" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "sheet_id" varchar NOT NULL,
        "route_id" varchar NOT NULL,
        "outlet_id" varchar NOT NULL,
        "sequence" integer NOT NULL DEFAULT 0,
        "created_at" timestamp DEFAULT now()
      );

      -- rfqs
      ALTER TABLE "rfqs" ADD COLUMN IF NOT EXISTS "cargo_details" text;
      ALTER TABLE "rfqs" ADD COLUMN IF NOT EXISTS "temperature_requirement" text;
      ALTER TABLE "rfqs" ADD COLUMN IF NOT EXISTS "weight" numeric(10, 3) DEFAULT 0.000;
      ALTER TABLE "rfqs" ADD COLUMN IF NOT EXISTS "volume" numeric(10, 3) DEFAULT 0.000;
      ALTER TABLE "rfqs" ADD COLUMN IF NOT EXISTS "requested_pickup_date" timestamp;
      ALTER TABLE "rfqs" ADD COLUMN IF NOT EXISTS "requested_delivery_date" timestamp;
      ALTER TABLE "rfqs" ADD COLUMN IF NOT EXISTS "additional_requirements" text;
      ALTER TABLE "rfqs" ADD COLUMN IF NOT EXISTS "notes" text;

      -- quotations
      ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "rfq_id" varchar;
      ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "origin_location_id" varchar;
      ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "destination_location_id" varchar;
      ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "cargo_details" text;
      ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "weight" numeric(10, 3) DEFAULT 0.000;
      ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "volume" numeric(10, 3) DEFAULT 0.000;
      ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "temperature_requirement" text;
      ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "selling_rate" numeric(12, 3) DEFAULT 0.000;
      ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "additional_charges" jsonb DEFAULT '[]'::jsonb;
      ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "payment_terms" text;
      ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1;
      ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "parent_id" varchar;

      -- orders
      ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "quotation_id" varchar;
      ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "volume" numeric(10, 3) DEFAULT 0.000;
      ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "temperature_requirement" text;
      ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "special_instructions" text;
      ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_reference" text;

      -- trips
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "order_id" varchar;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "trailer_number" text;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "planned_pickup_date" timestamp;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "planned_delivery_date" timestamp;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "actual_pickup_date" date;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "actual_pickup_time" text;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "loaded_quantity" numeric(10, 3);
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "cargo_condition" text;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "loading_notes" text;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "loading_documents" jsonb DEFAULT '[]'::jsonb;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "loading_images" jsonb DEFAULT '[]'::jsonb;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "current_location" text;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "gps_location" text;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "delays" jsonb DEFAULT '[]'::jsonb;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "incidents" jsonb DEFAULT '[]'::jsonb;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "additional_expenses" jsonb DEFAULT '[]'::jsonb;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "actual_delivery_date" date;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "actual_delivery_time" text;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "delivered_quantity" numeric(10, 3);
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "received_quantity" numeric(10, 3);
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "shortage_quantity" numeric(10, 3);
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "damaged_quantity" numeric(10, 3);
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "damage_reason" text;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "receiver_name" text;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "receiver_contact" text;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "signed_pod_url" text;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "pod_images" jsonb DEFAULT '[]'::jsonb;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "delivery_notes" text;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "pod_verification_status" text DEFAULT 'pending';
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "verified_by" varchar;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "verified_at" timestamp;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "driver_entitlement" numeric(12, 3) DEFAULT 0.000;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "driver_advance" numeric(12, 3) DEFAULT 0.000;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "driver_tolls" numeric(12, 3) DEFAULT 0.000;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "driver_fuel" numeric(12, 3) DEFAULT 0.000;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "driver_other_expenses" numeric(12, 3) DEFAULT 0.000;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "driver_total_expenses" numeric(12, 3) DEFAULT 0.000;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "driver_deductions" numeric(12, 3) DEFAULT 0.000;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "driver_balance_payable" numeric(12, 3) DEFAULT 0.000;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "driver_settlement_receipts" jsonb DEFAULT '[]'::jsonb;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "driver_settlement_status" text DEFAULT 'pending';
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "selling_rate" numeric(12, 3) DEFAULT 0.000;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "additional_charges" numeric(12, 3) DEFAULT 0.000;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "total_revenue" numeric(12, 3) DEFAULT 0.000;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "maintenance_cost" numeric(12, 3) DEFAULT 0.000;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "other_trip_expenses" numeric(12, 3) DEFAULT 0.000;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "total_trip_cost" numeric(12, 3) DEFAULT 0.000;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "gross_profit" numeric(12, 3) DEFAULT 0.000;
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "profit_margin" numeric(5, 2) DEFAULT 0.00;

      -- invoices
      ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "origin" text;
      ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "destination" text;
      ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "service_details" text;
      ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "quantity" numeric(12, 3) DEFAULT 1.000;
      ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "rate" numeric(12, 3) DEFAULT 0.000;
      ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "additional_charges" numeric(12, 3) DEFAULT 0.000;
      ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "payment_terms" text;
      ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "outstanding_amount" numeric(12, 3) DEFAULT 0.000;

      -- deliveries and delivery attachments
      CREATE TABLE IF NOT EXISTS "deliveries" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "trip_id" varchar NOT NULL,
        "order_id" varchar NOT NULL,
        "status" text NOT NULL DEFAULT 'pending',
        "pod_url" text,
        "issue_log" text,
        "delivery_timestamp" timestamp,
        "created_at" timestamp DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "delivery_docs" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "delivery_id" varchar NOT NULL,
        "order_id" varchar NOT NULL,
        "trip_id" varchar NOT NULL,
        "outlet_id" varchar,
        "pod_url" text NOT NULL,
        "status" text NOT NULL,
        "issue_log" text,
        "created_at" timestamp DEFAULT now()
      );

      -- Backfill existing 0-amount invoices from their orders
      UPDATE invoices
      SET 
        subtotal = orders.grand_total,
        rate = orders.grand_total,
        total = orders.grand_total,
        outstanding_amount = orders.grand_total
      FROM orders
      WHERE invoices.order_id = orders.id AND (invoices.total = '0.000' OR invoices.total IS NULL);

      -- Backfill existing vendors (clients where is_vendor = true) into suppliers table
      INSERT INTO suppliers (id, shop_id, branch_id, company_id, name, company_name, email, phone, vat_number, address, opening_balance, current_balance, status, created_at)
      SELECT 
        id, 
        shop_id, 
        branch_id, 
        brand_id, 
        name, 
        company_name, 
        email, 
        phone, 
        vat_number, 
        billing_address, 
        opening_balance, 
        opening_balance, 
        status, 
        created_at
      FROM clients
      WHERE is_vendor = true
      ON CONFLICT (id) DO UPDATE 
      SET 
        name = EXCLUDED.name,
        company_name = EXCLUDED.company_name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        vat_number = EXCLUDED.vat_number,
        address = EXCLUDED.address,
        status = EXCLUDED.status,
        shop_id = EXCLUDED.shop_id,
        branch_id = EXCLUDED.branch_id,
        company_id = EXCLUDED.company_id;
    `);
    schemaCheckDone = true;
    console.log("[db] Driver tables schema verified and updated successfully");
  } catch (error) {
    console.error("[db] Error verifying driver tables schema:", error);
  }
}

