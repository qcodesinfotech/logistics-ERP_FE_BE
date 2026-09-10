import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { 
  X, RotateCcw, Play, Pause, Thermometer, Fuel, Gauge, 
  User, ShieldCheck, Truck, AlertCircle, Snowflake, Box, Sparkles 
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { LiveVehicleData } from "./fleet-3d-map";

interface Vehicle3DDigitalTwinModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: LiveVehicleData;
}

export default function Vehicle3DDigitalTwinModal({
  isOpen,
  onClose,
  vehicle,
}: Vehicle3DDigitalTwinModalProps) {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [activeZone, setActiveZone] = useState<"all" | "cabin" | "frozen" | "chilled" | "dry">("all");

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const truckGroupRef = useRef<THREE.Group | null>(null);
  const zoneMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());

  // 3D Scene Initialization
  useEffect(() => {
    if (!isOpen || !canvasContainerRef.current) return;

    const container = canvasContainerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(10, 6, 12);
    camera.lookAt(0, 1.5, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0x38bdf8, 2.0);
    mainLight.position.set(12, 18, 10);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    scene.add(mainLight);

    const rimLight = new THREE.DirectionalLight(0x818cf8, 1.2);
    rimLight.position.set(-10, 8, -10);
    scene.add(rimLight);

    // Ground Grid & Circle
    const gridHelper = new THREE.GridHelper(24, 24, 0x38bdf8, 0x1e293b);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // Hologram circular pad
    const ringGeo = new THREE.RingGeometry(5.8, 6.0, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.02;
    scene.add(ring);

    // Build Procedural 3D Truck
    const truckGroup = new THREE.Group();
    truckGroupRef.current = truckGroup;

    // Chassis frame
    const chassisGeo = new THREE.BoxGeometry(2.4, 0.4, 9.6);
    const chassisMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7, metalness: 0.5 });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    chassis.position.y = 1.0;
    chassis.castShadow = true;
    truckGroup.add(chassis);

    // Cabin (Front)
    const cabinGeo = new THREE.BoxGeometry(2.3, 2.6, 2.8);
    const cabinMat = new THREE.MeshStandardMaterial({ 
      color: 0x2563eb, 
      roughness: 0.2, 
      metalness: 0.8 
    });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(0, 2.4, 3.2);
    cabin.castShadow = true;
    cabin.receiveShadow = true;
    truckGroup.add(cabin);
    zoneMeshesRef.current.set("cabin", cabin);

    // Windshield
    const windshieldGeo = new THREE.BoxGeometry(2.1, 1.2, 0.1);
    const windshieldMat = new THREE.MeshPhysicalMaterial({ 
      color: 0x93c5fd, 
      transmission: 0.8, 
      opacity: 1, 
      transparent: true, 
      roughness: 0.1, 
      ior: 1.5 
    });
    const windshield = new THREE.Mesh(windshieldGeo, windshieldMat);
    windshield.position.set(0, 2.8, 4.61);
    windshield.rotation.x = -0.15;
    truckGroup.add(windshield);

    // Headlights
    const lightGeo = new THREE.BoxGeometry(0.5, 0.3, 0.1);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const leftLight = new THREE.Mesh(lightGeo, lightMat);
    leftLight.position.set(-0.8, 1.6, 4.62);
    const rightLight = new THREE.Mesh(lightGeo, lightMat);
    rightLight.position.set(0.8, 1.6, 4.62);
    truckGroup.add(leftLight);
    truckGroup.add(rightLight);

    // Driver silhouette / avatar inside cabin
    const driverHeadGeo = new THREE.SphereGeometry(0.3, 16, 16);
    const driverMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.4 });
    const driverHead = new THREE.Mesh(driverHeadGeo, driverMat);
    driverHead.position.set(0.5, 2.8, 3.4);
    truckGroup.add(driverHead);

    // Multi-Temperature Cargo Bay: FROZEN (-18°C)
    const frozenGeo = new THREE.BoxGeometry(2.35, 2.8, 2.1);
    const frozenMat = new THREE.MeshPhysicalMaterial({
      color: 0x0284c7,
      metalness: 0.1,
      roughness: 0.2,
      transmission: 0.3,
      transparent: true,
      opacity: 0.9,
    });
    const frozenBay = new THREE.Mesh(frozenGeo, frozenMat);
    frozenBay.position.set(0, 2.5, 0.9);
    frozenBay.castShadow = true;
    truckGroup.add(frozenBay);
    zoneMeshesRef.current.set("frozen", frozenBay);

    // Multi-Temperature Cargo Bay: CHILLED (+4°C)
    const chilledGeo = new THREE.BoxGeometry(2.35, 2.8, 2.1);
    const chilledMat = new THREE.MeshPhysicalMaterial({
      color: 0x06b6d4,
      metalness: 0.1,
      roughness: 0.3,
      transmission: 0.3,
      transparent: true,
      opacity: 0.9,
    });
    const chilledBay = new THREE.Mesh(chilledGeo, chilledMat);
    chilledBay.position.set(0, 2.5, -1.25);
    chilledBay.castShadow = true;
    truckGroup.add(chilledBay);
    zoneMeshesRef.current.set("chilled", chilledBay);

    // Multi-Temperature Cargo Bay: DRY STORAGE (Ambient)
    const dryGeo = new THREE.BoxGeometry(2.35, 2.8, 2.1);
    const dryMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.3,
      roughness: 0.6,
    });
    const dryBay = new THREE.Mesh(dryGeo, dryMat);
    dryBay.position.set(0, 2.5, -3.4);
    dryBay.castShadow = true;
    truckGroup.add(dryBay);
    zoneMeshesRef.current.set("dry", dryBay);

    // Wheels (6 wheels: 2 front, 4 rear dual axle)
    const wheelGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.5, 24);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
    const rimGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.52, 16);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });

    const wheelPositions = [
      [-1.25, 0.7, 3.2], // Front Left
      [1.25, 0.7, 3.2],  // Front Right
      [-1.25, 0.7, -1.8], // Rear Axle 1 Left
      [1.25, 0.7, -1.8],  // Rear Axle 1 Right
      [-1.25, 0.7, -3.3], // Rear Axle 2 Left
      [1.25, 0.7, -3.3],  // Rear Axle 2 Right
    ];

    wheelPositions.forEach(([x, y, z]) => {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(x, y, z);

      const tire = new THREE.Mesh(wheelGeo, wheelMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      wheelGroup.add(tire);

      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.rotation.z = Math.PI / 2;
      wheelGroup.add(rim);

      truckGroup.add(wheelGroup);
    });

    scene.add(truckGroup);

    // Simple Orbit Controls using mouse drag
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging || !truckGroupRef.current) return;
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      truckGroupRef.current.rotation.y += deltaX * 0.01;
      if (cameraRef.current) {
        cameraRef.current.position.y = Math.max(2, Math.min(14, cameraRef.current.position.y - deltaY * 0.03));
        cameraRef.current.lookAt(0, 1.5, 0);
      }

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      if (!cameraRef.current) return;
      const fov = cameraRef.current.fov + e.deltaY * 0.05;
      cameraRef.current.fov = Math.max(20, Math.min(75, fov));
      cameraRef.current.updateProjectionMatrix();
    };

    container.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    container.addEventListener("wheel", onWheel);

    // Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (autoRotate && truckGroupRef.current && !isDragging) {
        truckGroupRef.current.rotation.y += 0.005;
      }

      renderer.render(scene, camera);
    };
    animate();

    // Handle Resize
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      container.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      container.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isOpen]);

  // Highlight specific zone when activeZone changes
  useEffect(() => {
    const meshes = zoneMeshesRef.current;
    if (meshes.size === 0) return;

    meshes.forEach((mesh, name) => {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (activeZone === "all" || activeZone === name) {
        mat.emissive = new THREE.Color(0x000000);
        mesh.scale.set(1, 1, 1);
      } else {
        mat.emissive = new THREE.Color(0x000000);
        mesh.scale.set(0.98, 0.98, 0.98);
      }
    });

    if (activeZone !== "all" && meshes.has(activeZone)) {
      const selectedMesh = meshes.get(activeZone)!;
      const mat = selectedMesh.material as THREE.MeshStandardMaterial;
      mat.emissive = new THREE.Color(0x38bdf8);
      mat.emissiveIntensity = 0.35;
    }
  }, [activeZone]);

  const resetCamera = () => {
    if (cameraRef.current && truckGroupRef.current) {
      cameraRef.current.position.set(10, 6, 12);
      cameraRef.current.fov = 45;
      cameraRef.current.updateProjectionMatrix();
      cameraRef.current.lookAt(0, 1.5, 0);
      truckGroupRef.current.rotation.set(0, 0, 0);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl overflow-hidden border-slate-800 bg-slate-950 p-0 text-slate-100 shadow-2xl">
        <DialogHeader className="border-b border-slate-800/80 px-6 py-4 bg-slate-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="flex items-center gap-2 text-base font-bold text-white">
                  <span>3D Digital Twin &bull; {vehicle.plateNumber || vehicle.vehicleName || "Fleet Truck"}</span>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                    LIVE SYNC
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  Real-time 3D spatial inspection &bull; Telemetry telemetry telemetry
                </DialogDescription>
              </div>
            </div>

            {/* Quick Action Controls */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-slate-700 bg-slate-800/50 text-xs text-slate-300 hover:text-white"
                onClick={() => setAutoRotate(!autoRotate)}
              >
                {autoRotate ? <Pause className="mr-1.5 h-3.5 w-3.5" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
                {autoRotate ? "Pause Spin" : "Auto Rotate"}
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="h-8 border-slate-700 bg-slate-800/50 text-xs text-slate-300 hover:text-white"
                onClick={resetCamera}
                title="Reset Camera Angle"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Content Body: 3D Canvas + Diagnostic HUD */}
        <div className="grid grid-cols-1 md:grid-cols-12 h-[560px]">
          {/* 3D WebGL Canvas Area */}
          <div className="relative md:col-span-8 h-full bg-slate-950 overflow-hidden">
            <div ref={canvasContainerRef} className="h-full w-full cursor-grab active:cursor-grabbing" />

            {/* Floating Compartment Filter Pills */}
            <div className="absolute bottom-4 left-4 z-10 flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-900/90 p-1.5 border border-slate-800/90 shadow-xl backdrop-blur-md">
              <span className="px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Inspect:</span>
              <Button
                size="sm"
                variant={activeZone === "all" ? "default" : "ghost"}
                className={`h-6 px-2 text-[11px] ${activeZone === "all" ? "bg-sky-600 text-white" : "text-slate-300"}`}
                onClick={() => setActiveZone("all")}
              >
                Full Vehicle
              </Button>
              <Button
                size="sm"
                variant={activeZone === "cabin" ? "default" : "ghost"}
                className={`h-6 px-2 text-[11px] ${activeZone === "cabin" ? "bg-blue-600 text-white" : "text-slate-300"}`}
                onClick={() => setActiveZone("cabin")}
              >
                Cabin
              </Button>
              <Button
                size="sm"
                variant={activeZone === "frozen" ? "default" : "ghost"}
                className={`h-6 px-2 text-[11px] ${activeZone === "frozen" ? "bg-sky-600 text-white" : "text-slate-300"}`}
                onClick={() => setActiveZone("frozen")}
              >
                Frozen Bay
              </Button>
              <Button
                size="sm"
                variant={activeZone === "chilled" ? "default" : "ghost"}
                className={`h-6 px-2 text-[11px] ${activeZone === "chilled" ? "bg-cyan-600 text-white" : "text-slate-300"}`}
                onClick={() => setActiveZone("chilled")}
              >
                Chilled Bay
              </Button>
              <Button
                size="sm"
                variant={activeZone === "dry" ? "default" : "ghost"}
                className={`h-6 px-2 text-[11px] ${activeZone === "dry" ? "bg-slate-700 text-white" : "text-slate-300"}`}
                onClick={() => setActiveZone("dry")}
              >
                Dry Bay
              </Button>
            </div>

            {/* Compass Hint */}
            <div className="absolute top-4 right-4 text-[10px] text-slate-500 bg-slate-900/70 px-2 py-1 rounded border border-slate-800">
              Drag to Orbit &bull; Scroll to Zoom
            </div>
          </div>

          {/* Right Telemetry & Compartments Sidebar */}
          <div className="md:col-span-4 flex flex-col justify-between border-l border-slate-800/80 bg-slate-900/30 p-5 overflow-y-auto">
            <div className="space-y-4">
              {/* Driver Card */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-400">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-white">{vehicle.driverName || "Ali Al-Khatib"}</h5>
                    <p className="text-xs text-slate-400">Driver ID: #{vehicle.driverId?.slice(-6) || "DRV-102"}</p>
                  </div>
                  <Badge className="ml-auto bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
                    Active Driving
                  </Badge>
                </div>
              </div>

              {/* Dynamic Speed & Heading Gauges */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                    <Gauge className="h-3.5 w-3.5 text-sky-400" />
                    <span>Speed</span>
                  </div>
                  <p className="mt-1 text-2xl font-black text-white">
                    {Math.round(vehicle.coords.speed || 0)}
                    <span className="ml-1 text-xs font-normal text-slate-400">km/h</span>
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                    <Fuel className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Fuel Level</span>
                  </div>
                  <p className="mt-1 text-2xl font-black text-white">
                    {vehicle.diagnostics?.fuelPercent ?? 78}
                    <span className="ml-0.5 text-xs font-normal text-slate-400">%</span>
                  </p>
                </div>
              </div>

              {/* Multi-Temperature Cargo Bay Status */}
              <div>
                <h6 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Cargo Compartments
                </h6>
                <div className="space-y-2">
                  {/* Frozen Bay */}
                  <div 
                    className={`rounded-lg border p-2.5 transition-all cursor-pointer ${
                      activeZone === "frozen" 
                        ? "border-sky-500 bg-sky-500/10" 
                        : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
                    }`}
                    onClick={() => setActiveZone("frozen")}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-medium text-slate-200">
                        <Snowflake className="h-3.5 w-3.5 text-sky-400" />
                        Bay 1 (Frozen)
                      </span>
                      <span className="font-mono font-bold text-sky-400">
                        {vehicle.diagnostics?.cargoTemp ?? -18.2}°C
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">Refrigeration Active &bull; Set: -20°C</p>
                  </div>

                  {/* Chilled Bay */}
                  <div 
                    className={`rounded-lg border p-2.5 transition-all cursor-pointer ${
                      activeZone === "chilled" 
                        ? "border-cyan-500 bg-cyan-500/10" 
                        : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
                    }`}
                    onClick={() => setActiveZone("chilled")}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-medium text-slate-200">
                        <Thermometer className="h-3.5 w-3.5 text-cyan-400" />
                        Bay 2 (Chilled)
                      </span>
                      <span className="font-mono font-bold text-cyan-400">+4.1°C</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">Dairy & Produce &bull; Set: +4°C</p>
                  </div>

                  {/* Dry Bay */}
                  <div 
                    className={`rounded-lg border p-2.5 transition-all cursor-pointer ${
                      activeZone === "dry" 
                        ? "border-slate-500 bg-slate-800/40" 
                        : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
                    }`}
                    onClick={() => setActiveZone("dry")}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-medium text-slate-200">
                        <Box className="h-3.5 w-3.5 text-slate-400" />
                        Bay 3 (Dry Cargo)
                      </span>
                      <span className="font-mono font-bold text-slate-300">+22.5°C</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">Ambient Storage &bull; 85% Capacity</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Status Footer */}
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                All Sensors Operational
              </span>
              <span className="font-mono text-[11px]">3D Model: Heavy Refrig</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
