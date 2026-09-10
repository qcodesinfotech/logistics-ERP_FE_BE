import React, { useEffect, useRef, useState, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import * as THREE from "three";
import { 
  Compass, Eye, Play, Pause, RefreshCw, ZoomIn, ZoomOut, 
  Maximize2, Minimize2, Navigation, Layers, ShieldCheck, Thermometer,
  Gauge, AlertCircle, X, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Vehicle3DDigitalTwinModal from "./vehicle-3d-digital-twin";

export interface LiveVehicleData {
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
    bearing: number;
    speed: number;
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

interface Fleet3DMapProps {
  selectedTripId?: string;
  selectedVehicleId?: string;
  onSelectVehicle?: (vehicle: LiveVehicleData) => void;
  height?: string | number;
}

export default function Fleet3DMap({
  selectedTripId,
  selectedVehicleId,
  onSelectVehicle,
  height = "650px",
}: Fleet3DMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, { marker: maplibregl.Marker; el: HTMLElement; targetPos: [number, number]; currentPos: [number, number]; bearing: number }>>(new Map());
  
  const [vehicles, setVehicles] = useState<Map<string, LiveVehicleData>>(new Map());
  const [activeVehicle, setActiveVehicle] = useState<LiveVehicleData | null>(null);
  const [followMode, setFollowMode] = useState<boolean>(true);
  const [cameraPitch, setCameraPitch] = useState<number>(60);
  const [mapTheme, setMapTheme] = useState<"dark" | "streets" | "satellite">("dark");
  const [isDigitalTwinOpen, setIsDigitalTwinOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerWrapperRef = useRef<HTMLDivElement>(null);

  // WebSocket Connection
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    const connectWebSocket = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/telemetry`;

      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setIsConnected(true);
          ws?.send(JSON.stringify({ type: "SUBSCRIBE_FLEET" }));
          if (selectedTripId) {
            ws?.send(JSON.stringify({ type: "SUBSCRIBE_TRIP", tripId: selectedTripId }));
          }
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === "FLEET_SNAPSHOT" && Array.isArray(msg.vehicles)) {
              setVehicles((prev) => {
                const updated = new Map(prev);
                msg.vehicles.forEach((v: LiveVehicleData) => {
                  updated.set(v.vehicleId, v);
                });
                return updated;
              });
            } else if (msg.type === "VEHICLE_UPDATE" && msg.data) {
              const v: LiveVehicleData = msg.data;
              setVehicles((prev) => {
                const updated = new Map(prev);
                updated.set(v.vehicleId, v);
                return updated;
              });
            }
          } catch (e) {
            console.error("Failed to parse telemetry message:", e);
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          reconnectTimeout = setTimeout(connectWebSocket, 3000);
        };

        ws.onerror = () => {
          setIsConnected(false);
        };
      } catch (err) {
        setIsConnected(false);
        reconnectTimeout = setTimeout(connectWebSocket, 3000);
      }
    };

    connectWebSocket();

    // Fallback REST polling in case WebSocket is blocked by proxy
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch("/api/telemetry/live");
        if (res.ok) {
          const list: LiveVehicleData[] = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            setVehicles((prev) => {
              const updated = new Map(prev);
              list.forEach((v) => updated.set(v.vehicleId, v));
              return updated;
            });
          }
        }
      } catch (e) {
        // quiet fallback
      }
    }, 5000);

    return () => {
      clearTimeout(reconnectTimeout);
      clearInterval(pollInterval);
      if (ws) {
        ws.close();
      }
    };
  }, [selectedTripId]);

  // MapLibre Styles
  const getMapStyle = (theme: "dark" | "streets" | "satellite") => {
    switch (theme) {
      case "dark":
        return {
          version: 8 as const,
          sources: {
            "carto-dark": {
              type: "raster" as const,
              tiles: [
                "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
                "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
                "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
              ],
              tileSize: 256,
              attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
            },
          },
          layers: [
            {
              id: "carto-dark-layer",
              type: "raster" as const,
              source: "carto-dark",
              minzoom: 0,
              maxzoom: 20,
            },
          ],
        };
      case "streets":
        return {
          version: 8 as const,
          sources: {
            osm: {
              type: "raster" as const,
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "&copy; OpenStreetMap contributors",
            },
          },
          layers: [
            {
              id: "osm-layer",
              type: "raster" as const,
              source: "osm",
              minzoom: 0,
              maxzoom: 19,
            },
          ],
        };
      case "satellite":
        return {
          version: 8 as const,
          sources: {
            esri: {
              type: "raster" as const,
              tiles: [
                "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
              ],
              tileSize: 256,
              attribution: "&copy; Esri &copy; Earthstar Geographics",
            },
          },
          layers: [
            {
              id: "esri-layer",
              type: "raster" as const,
              source: "esri",
              minzoom: 0,
              maxzoom: 19,
            },
          ],
        };
    }
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: getMapStyle(mapTheme),
      center: [50.5876, 26.2235], // Bahrain default center
      zoom: 13,
      pitch: cameraPitch, // 3D Tilt perspective
      bearing: 15,
      antialias: true,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

    map.on("load", () => {
      mapInstanceRef.current = map;
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update map style when theme changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setStyle(getMapStyle(mapTheme));
  }, [mapTheme]);

  // Create or Update 3D Truck Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    vehicles.forEach((vehicle, vehicleId) => {
      const { latitude, longitude, bearing = 0, speed = 0 } = vehicle.coords;
      const targetPos: [number, number] = [longitude, latitude];

      let entry = markersRef.current.get(vehicleId);

      if (!entry) {
        // Create custom 3D Truck Element
        const el = document.createElement("div");
        el.className = "fleet-3d-truck-marker";
        el.style.width = "64px";
        el.style.height = "64px";
        el.style.cursor = "pointer";
        el.style.perspective = "600px";

        el.innerHTML = `
          <div class="truck-3d-container" style="
            width: 100%;
            height: 100%;
            position: relative;
            transform-style: preserve-3d;
            transform: rotateX(45deg) rotateZ(${bearing}deg);
            transition: transform 0.4s ease-out;
          ">
            <!-- Ground Shadow -->
            <div style="
              position: absolute;
              bottom: 4px;
              left: 12px;
              width: 40px;
              height: 24px;
              background: rgba(0,0,0,0.45);
              filter: blur(4px);
              border-radius: 50%;
              transform: translateZ(-2px);
            "></div>

            <!-- Animated Radar / Speed Ring -->
            <div class="speed-pulse-ring" style="
              position: absolute;
              inset: 2px;
              border: 2px solid ${speed > 0 ? '#38bdf8' : '#22c55e'};
              border-radius: 50%;
              opacity: 0.6;
              animation: pulseRing 1.8s infinite ease-out;
            "></div>

            <!-- 3D Truck Body (Box + Cabin) -->
            <div class="truck-chassis" style="
              position: absolute;
              top: 10px;
              left: 20px;
              width: 24px;
              height: 44px;
              background: linear-gradient(135deg, #1e293b, #0f172a);
              border: 1.5px solid #38bdf8;
              border-radius: 4px;
              box-shadow: 0 8px 16px rgba(0,0,0,0.6);
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
              padding: 2px 0;
            ">
              <!-- Cabin (Front) with Windshield & Headlights -->
              <div style="
                width: 20px;
                height: 14px;
                background: #3b82f6;
                border-radius: 3px 3px 1px 1px;
                position: relative;
                box-shadow: inset 0 2px 4px rgba(255,255,255,0.4);
              ">
                <!-- Headlights -->
                <div style="position: absolute; top: -2px; left: 2px; width: 4px; height: 3px; background: #fef08a; border-radius: 1px; box-shadow: 0 0 6px #fef08a;"></div>
                <div style="position: absolute; top: -2px; right: 2px; width: 4px; height: 3px; background: #fef08a; border-radius: 1px; box-shadow: 0 0 6px #fef08a;"></div>
                <!-- Windshield glass -->
                <div style="position: absolute; top: 3px; left: 3px; right: 3px; height: 6px; background: #93c5fd; border-radius: 1px; opacity: 0.85;"></div>
              </div>

              <!-- Cargo Container (Back) -->
              <div style="
                width: 20px;
                height: 24px;
                background: #1e293b;
                border: 1px solid #475569;
                border-radius: 2px;
                display: flex;
                align-items: center;
                justify-content: center;
              ">
                <span style="font-size: 8px; font-weight: 800; color: #38bdf8; letter-spacing: -0.5px;">LOG</span>
              </div>
            </div>

            <!-- Floating Label Pill -->
            <div style="
              position: absolute;
              bottom: -16px;
              left: 50%;
              transform: translateX(-50%);
              background: rgba(15, 23, 42, 0.85);
              border: 1px solid #38bdf8;
              color: #f8fafc;
              font-size: 9px;
              font-weight: 600;
              padding: 1px 6px;
              border-radius: 10px;
              white-space: nowrap;
              pointer-events: none;
              backdrop-filter: blur(4px);
            ">
              ${vehicle.plateNumber || vehicle.vehicleName || "Truck"} &bull; ${Math.round(speed)} km/h
            </div>
          </div>
        `;

        el.onclick = (e) => {
          e.stopPropagation();
          setActiveVehicle(vehicle);
          onSelectVehicle?.(vehicle);
          if (mapInstanceRef.current) {
            mapInstanceRef.current.flyTo({
              center: [longitude, latitude],
              zoom: 16,
              pitch: 65,
              bearing: bearing,
              essential: true,
              duration: 1200,
            });
          }
        };

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(targetPos)
          .addTo(map);

        entry = {
          marker,
          el,
          targetPos,
          currentPos: targetPos,
          bearing,
        };
        markersRef.current.set(vehicleId, entry);
      } else {
        // Smoothly interpolate position and orientation
        entry.targetPos = targetPos;
        entry.bearing = bearing;

        // Update 3D orientation rotation
        const container = entry.el.querySelector(".truck-3d-container") as HTMLElement;
        if (container) {
          container.style.transform = `rotateX(45deg) rotateZ(${bearing}deg)`;
        }

        // Update label text
        const label = entry.el.querySelector("span, div:last-child") as HTMLElement;
        if (label) {
          label.innerHTML = `${vehicle.plateNumber || vehicle.vehicleName || "Truck"} &bull; ${Math.round(speed)} km/h`;
        }

        // LERP movement on map
        entry.marker.setLngLat(targetPos);
      }
    });

    // Auto-focus if single vehicle selected or followMode active
    if (activeVehicle && followMode) {
      const activeData = vehicles.get(activeVehicle.vehicleId);
      if (activeData) {
        map.easeTo({
          center: [activeData.coords.longitude, activeData.coords.latitude],
          bearing: activeData.coords.bearing,
          pitch: cameraPitch,
          duration: 1000,
        });
      }
    }
  }, [vehicles, activeVehicle, followMode, cameraPitch]);

  // Set default active vehicle
  useEffect(() => {
    if (selectedVehicleId && vehicles.has(selectedVehicleId)) {
      const v = vehicles.get(selectedVehicleId)!;
      setActiveVehicle(v);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo({
          center: [v.coords.longitude, v.coords.latitude],
          zoom: 16,
          pitch: 60,
          bearing: v.coords.bearing,
        });
      }
    } else if (!activeVehicle && vehicles.size > 0) {
      const first = Array.from(vehicles.values())[0];
      setActiveVehicle(first);
    }
  }, [selectedVehicleId, vehicles]);

  // Camera Tilt Handler
  const handlePitchChange = (delta: number) => {
    const newPitch = Math.min(80, Math.max(0, cameraPitch + delta));
    setCameraPitch(newPitch);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setPitch(newPitch);
    }
  };

  // Fit All Trucks in bounds
  const fitAllVehicles = () => {
    const map = mapInstanceRef.current;
    if (!map || vehicles.size === 0) return;

    if (vehicles.size === 1) {
      const single = Array.from(vehicles.values())[0];
      map.flyTo({
        center: [single.coords.longitude, single.coords.latitude],
        zoom: 15,
        pitch: 60,
      });
      return;
    }

    const bounds = new maplibregl.LngLatBounds();
    vehicles.forEach((v) => {
      bounds.extend([v.coords.longitude, v.coords.latitude]);
    });

    map.fitBounds(bounds, {
      padding: 80,
      maxZoom: 16,
      pitch: 50,
      duration: 1200,
    });
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerWrapperRef.current) return;
    if (!isFullscreen) {
      if (containerWrapperRef.current.requestFullscreen) {
        containerWrapperRef.current.requestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerWrapperRef}
      className={`relative w-full overflow-hidden rounded-xl border border-border bg-slate-950 shadow-2xl ${
        isFullscreen ? "fixed inset-0 z-50 h-screen rounded-none" : ""
      }`}
      style={{ height: isFullscreen ? "100vh" : height }}
    >
      <style>{`
        @keyframes pulseRing {
          0% { transform: scale(0.6); opacity: 0.9; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>

      {/* MapLibre WebGL Canvas Container */}
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Top Floating Telemetry & Status HUD Bar */}
      <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg bg-slate-900/90 px-3 py-1.5 text-xs font-semibold text-slate-100 shadow-lg backdrop-blur-md border border-slate-800">
          <div
            className={`h-2.5 w-2.5 rounded-full ${
              isConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
            }`}
          />
          <span>{isConnected ? "3D Telemetry LIVE" : "Reconnecting Telemetry..."}</span>
          <Badge variant="outline" className="ml-1 border-sky-500/40 bg-sky-500/10 text-sky-400 text-[10px]">
            {vehicles.size} {vehicles.size === 1 ? "Truck" : "Trucks"} Tracked
          </Badge>
        </div>

        {/* Style Switcher */}
        <div className="flex items-center rounded-lg bg-slate-900/90 p-0.5 border border-slate-800 shadow-lg backdrop-blur-md">
          <Button
            size="sm"
            variant={mapTheme === "dark" ? "secondary" : "ghost"}
            className="h-7 px-2.5 text-[11px] font-medium"
            onClick={() => setMapTheme("dark")}
          >
            3D Dark
          </Button>
          <Button
            size="sm"
            variant={mapTheme === "streets" ? "secondary" : "ghost"}
            className="h-7 px-2.5 text-[11px] font-medium"
            onClick={() => setMapTheme("streets")}
          >
            Streets
          </Button>
          <Button
            size="sm"
            variant={mapTheme === "satellite" ? "secondary" : "ghost"}
            className="h-7 px-2.5 text-[11px] font-medium"
            onClick={() => setMapTheme("satellite")}
          >
            Satellite
          </Button>
        </div>
      </div>

      {/* Floating Camera & View Controls */}
      <div className="absolute top-4 right-14 z-20 flex items-center gap-1.5 rounded-lg bg-slate-900/90 p-1 border border-slate-800 shadow-lg backdrop-blur-md">
        <Button
          size="icon"
          variant={followMode ? "default" : "ghost"}
          className={`h-8 w-8 ${followMode ? "bg-sky-600 hover:bg-sky-500 text-white" : "text-slate-300"}`}
          title="Chase Cam (Follow Truck)"
          onClick={() => setFollowMode(!followMode)}
        >
          <Navigation className="h-4 w-4" />
        </Button>

        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-slate-300 hover:text-white"
          title="Tilt Up"
          onClick={() => handlePitchChange(15)}
        >
          <Compass className="h-4 w-4" />
        </Button>

        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-slate-300 hover:text-white"
          title="Fit All Fleet"
          onClick={fitAllVehicles}
        >
          <Layers className="h-4 w-4" />
        </Button>

        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-slate-300 hover:text-white"
          title="Toggle Fullscreen"
          onClick={toggleFullscreen}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>

      {/* Active Vehicle Floating Card / HUD */}
      {activeVehicle && (
        <div className="absolute bottom-4 left-4 z-20 w-80 max-w-[calc(100%-2rem)] rounded-xl border border-slate-800 bg-slate-900/95 p-4 text-slate-100 shadow-2xl backdrop-blur-md">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Badge className="bg-sky-500/20 text-sky-400 border border-sky-500/40 text-[10px]">
                  3D ACTIVE
                </Badge>
                <span className="text-xs text-slate-400">
                  {activeVehicle.tripId ? `Trip #${activeVehicle.tripId.slice(-6)}` : "Fleet"}
                </span>
              </div>
              <h4 className="mt-1 text-sm font-bold tracking-tight text-white">
                {activeVehicle.plateNumber || activeVehicle.vehicleName || "Freightliner Truck"}
              </h4>
              <p className="text-xs text-slate-400">Driver: {activeVehicle.driverName || "Assigned Driver"}</p>
            </div>

            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-slate-400 hover:text-white"
              onClick={() => setActiveVehicle(null)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-slate-950/60 p-2.5 border border-slate-800/80">
            <div className="text-center">
              <span className="text-[10px] uppercase font-semibold text-slate-400">Speed</span>
              <p className="text-sm font-bold text-sky-400">
                {Math.round(activeVehicle.coords.speed || 0)}{" "}
                <span className="text-[10px] font-normal text-slate-400">km/h</span>
              </p>
            </div>

            <div className="text-center border-x border-slate-800">
              <span className="text-[10px] uppercase font-semibold text-slate-400">Bearing</span>
              <p className="text-sm font-bold text-emerald-400">
                {Math.round(activeVehicle.coords.bearing || 0)}°
              </p>
            </div>

            <div className="text-center">
              <span className="text-[10px] uppercase font-semibold text-slate-400">Cargo Temp</span>
              <p className="text-sm font-bold text-cyan-400">
                {activeVehicle.diagnostics?.cargoTemp !== undefined
                  ? `${activeVehicle.diagnostics.cargoTemp}°C`
                  : "-18°C"}
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Button
              size="sm"
              className="w-full bg-gradient-to-r from-sky-600 to-blue-600 text-xs font-semibold text-white hover:from-sky-500 hover:to-blue-500 shadow-md"
              onClick={() => setIsDigitalTwinOpen(true)}
            >
              <Eye className="mr-1.5 h-3.5 w-3.5" />
              Open 3D Digital Twin
            </Button>
          </div>
        </div>
      )}

      {/* 3D Digital Twin Inspector Modal */}
      {isDigitalTwinOpen && activeVehicle && (
        <Vehicle3DDigitalTwinModal
          isOpen={isDigitalTwinOpen}
          onClose={() => setIsDigitalTwinOpen(false)}
          vehicle={activeVehicle}
        />
      )}
    </div>
  );
}
