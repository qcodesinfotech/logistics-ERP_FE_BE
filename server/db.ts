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
        "created_at" timestamp DEFAULT now()
      );

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
    `);
    schemaCheckDone = true;
    console.log("[db] Driver tables schema verified and updated successfully");
  } catch (error) {
    console.error("[db] Error verifying driver tables schema:", error);
  }
}

