import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";

export interface VehicleTelemetry {
  tripId: string;
  vehicleId: string;
  driverId: string;
  driverName?: string;
  vehicleName?: string;
  plateNumber?: string;
  coords: {
    latitude: number;
    longitude: number;
    altitude?: number;
    bearing: number; // 0-360 degrees
    speed: number;   // km/h
    accuracy?: number;
  };
  diagnostics?: {
    ignition?: boolean;
    cargoTemp?: number;
    fuelPercent?: number;
    doorOpen?: boolean;
    storageType?: string;
  };
  timestamp: number;
}

// In-memory cache for ultra-fast real-time lookup
const liveVehicles = new Map<string, VehicleTelemetry>();
const tripBreadcrumbs = new Map<string, VehicleTelemetry[]>();

// Maximum historical points kept in memory per trip
const MAX_BREADCRUMBS = 150;

// Client subscriptions tracking
interface ConnectedClient {
  ws: WebSocket;
  isAlive: boolean;
  subscriptions: Set<string>; // "FLEET" or "TRIP:<tripId>"
}

const connectedClients = new Set<ConnectedClient>();

export function getLiveFleetTelemetry(): VehicleTelemetry[] {
  return Array.from(liveVehicles.values());
}

export function getTripTelemetryHistory(tripId: string): VehicleTelemetry[] {
  return tripBreadcrumbs.get(tripId) || [];
}

export function updateVehicleTelemetry(data: VehicleTelemetry) {
  if (!data.vehicleId) return;

  // Enrich timestamp if missing
  if (!data.timestamp) {
    data.timestamp = Date.now();
  }

  // Ensure default bearing and speed if not provided
  if (data.coords) {
    if (typeof data.coords.bearing !== "number") data.coords.bearing = 0;
    if (typeof data.coords.speed !== "number") data.coords.speed = 0;
  }

  // Update in-memory state
  liveVehicles.set(data.vehicleId, data);

  // Update trip breadcrumb history
  if (data.tripId) {
    const history = tripBreadcrumbs.get(data.tripId) || [];
    history.push(data);
    if (history.length > MAX_BREADCRUMBS) {
      history.shift();
    }
    tripBreadcrumbs.set(data.tripId, history);
  }

  // Broadcast to relevant connected subscribers
  broadcastTelemetry(data);
}

function broadcastTelemetry(data: VehicleTelemetry) {
  const payload = JSON.stringify({
    type: "VEHICLE_UPDATE",
    data,
  });

  const tripChannel = `TRIP:${data.tripId}`;

  connectedClients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      if (
        client.subscriptions.has("FLEET") ||
        (data.tripId && client.subscriptions.has(tripChannel))
      ) {
        client.ws.send(payload);
      }
    }
  });
}

export function initTelemetryWebSocket(server: Server) {
  const wss = new WebSocketServer({
    noServer: true,
  });

  // Attach to the HTTP server upgrade event specifically for path /ws/telemetry
  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url || "", `http://${request.headers.host}`);
    if (url.pathname === "/ws/telemetry") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  // Ping-pong heartbeat to eliminate dead sockets
  const pingInterval = setInterval(() => {
    connectedClients.forEach((client) => {
      if (!client.isAlive) {
        client.ws.terminate();
        connectedClients.delete(client);
        return;
      }
      client.isAlive = false;
      client.ws.ping();
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(pingInterval);
  });

  wss.on("connection", (ws: WebSocket) => {
    const clientState: ConnectedClient = {
      ws,
      isAlive: true,
      subscriptions: new Set(["FLEET"]), // default subscribe to fleet
    };
    connectedClients.add(clientState);

    ws.on("pong", () => {
      clientState.isAlive = true;
    });

    // Send initial snapshot of all active vehicles upon connection
    const initialSnapshot = {
      type: "FLEET_SNAPSHOT",
      vehicles: getLiveFleetTelemetry(),
    };
    ws.send(JSON.stringify(initialSnapshot));

    ws.on("message", (rawMessage) => {
      try {
        const msg = JSON.parse(rawMessage.toString());

        switch (msg.type) {
          case "SUBSCRIBE_FLEET":
            clientState.subscriptions.add("FLEET");
            ws.send(
              JSON.stringify({
                type: "FLEET_SNAPSHOT",
                vehicles: getLiveFleetTelemetry(),
              })
            );
            break;

          case "SUBSCRIBE_TRIP":
            if (msg.tripId) {
              clientState.subscriptions.add(`TRIP:${msg.tripId}`);
              ws.send(
                JSON.stringify({
                  type: "TRIP_SNAPSHOT",
                  tripId: msg.tripId,
                  history: getTripTelemetryHistory(msg.tripId),
                })
              );
            }
            break;

          case "UNSUBSCRIBE_TRIP":
            if (msg.tripId) {
              clientState.subscriptions.delete(`TRIP:${msg.tripId}`);
            }
            break;

          case "TELEMETRY":
          case "DRIVER_TELEMETRY":
            if (msg.data) {
              updateVehicleTelemetry(msg.data);
            }
            break;

          default:
            break;
        }
      } catch (err) {
        console.warn("[telemetry-ws] Failed to process incoming message:", err);
      }
    });

    ws.on("close", () => {
      connectedClients.delete(clientState);
    });

    ws.on("error", (err) => {
      console.warn("[telemetry-ws] Client socket error:", err);
      connectedClients.delete(clientState);
    });
  });

  console.log("[telemetry-ws] 3D Telemetry WebSocket gateway initialized on /ws/telemetry");
  return wss;
}
