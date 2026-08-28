import { db } from "../server/db";
import { storage } from "../server/storage";
import { suppliers, vehicles } from "../shared/schema";

async function run() {
  try {
    const allSuppliers = await db.select().from(suppliers);
    const supplierId = allSuppliers[0]?.id;
    
    const allVehicles = await db.select().from(vehicles);
    const vehicleId = allVehicles[0]?.id;
    
    if (!supplierId || !vehicleId) {
      console.log("Missing supplier or vehicle", { supplierId, vehicleId });
      process.exit(0);
    }
    
    console.log("Using supplierId:", supplierId);
    console.log("Using vehicleId (destination):", vehicleId);
    
    const payload = {
      supplierId,
      warehouseId: vehicleId,
      shopId: "c2d33454-e0eb-4043-a616-e5f80e5b7ccf", // dummy or fetch first
      branchId: "b851bdf6-d0be-4a5f-9721-3fe9895c1b6d", // dummy or fetch first
      status: "pending",
      subtotal: 150,
      vatAmount: 7.5,
      discount: 0,
      total: 157.5,
      items: [
        { productId: "Product 1", quantity: 10, unitPrice: 10, vatRate: 5, discount: 0, isCustom: true, customName: "Product 1" },
        { productId: "Product 2", quantity: 5, unitPrice: 10, vatRate: 5, discount: 0, isCustom: true, customName: "Product 2" }
      ]
    };
    
    // Map items like in createPOMutation
    const mappedItems = payload.items.map((item: any) => ({
      ...item,
      productId: item.productId, // here we just pass the text
    }));
    
    const { items, ...orderData } = payload;
    
    const result = await storage.createPurchaseOrder(orderData, mappedItems);
    console.log("SUCCESS creating PO:", result);
  } catch (err: any) {
    console.error("FAILED creating PO:", err);
  } finally {
    process.exit(0);
  }
}
run();
