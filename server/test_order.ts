import { db } from './db';
import { orders, orderCharges, clients } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function test() {
  try {
    const clientsList = await db.query.clients.findMany({ limit: 1 });
    if (clientsList.length === 0) {
      console.log("No clients found!");
      return;
    }

    const orderData = {
      orderNumber: `ORD-${Date.now()}`,
      customerId: clientsList[0].id,
      cargoDetails: "Test Cargo",
      weight: "0.000",
      grandTotal: "4005.000",
      documents: [],
      rfqId: null,
      zoneId: null,
      orderDate: new Date().toISOString(),
      paymentDueDate: new Date().toISOString(),
      status: "pending",
      destinations: [{ country: "", city: "" }],
      truckType: "rented",
      driverName: "",
      driverContact: "",
      originCountry: "",
      originCity: ""
    };
    
    console.log("Attempting to insert order...", orderData);
    const [row] = await db.insert(orders).values(orderData).returning();
    console.log("Order created:", row.id);

    const chargesData = [
      { orderId: row.id, description: "Driver Wages", qty: "2", unitRate: "350", total: "700.000", isProfit: false },
      { orderId: row.id, description: "Fuel", qty: "300", unitRate: "3", total: "900.000", isProfit: false }
    ];
    console.log("Attempting to insert charges...");
    await db.insert(orderCharges).values(chargesData);
    console.log("Charges created successfully!");
    
    // Clean up
    await db.delete(orderCharges).where(eq(orderCharges.orderId, row.id));
    await db.delete(orders).where(eq(orders.id, row.id));
    process.exit(0);
  } catch (error) {
    console.error("DEBUG ERROR:", error);
    process.exit(1);
  }
}
test();
