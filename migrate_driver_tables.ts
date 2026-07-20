import { db } from "./server/db";

async function main() {
  try {
    console.log("Running database migrations for driver tables...");

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
    `);

    console.log("Migration executed successfully!");
  } catch (error) {
    console.error("Migration error:", error);
  } finally {
    process.exit(0);
  }
}

main();
