"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

type Emergency = {
  id: string;
  type: string;
  status: string;
  priority: number;
  patient_id: string;
  patient_lat: number;
  patient_lng: number;
  patient_address: string | null;
  estimated_arrival_minutes: number | null;
  created_at: string;
  profiles: { full_name: string; phone: string | null } | null;
};

type ActiveDispatch = Emergency & {
  dispatcher_lat: number | null;
  dispatcher_lng: number | null;
};

interface Props {
  dispatcherLat: number | null;
  dispatcherLng: number | null;
  emergencies: Emergency[];
  activeDispatch: ActiveDispatch | null;
  onEmergencyClick: (em: Emergency) => void;
}

const PRIORITY_HEX: Record<number, string> = {
  1: "#eab308", 2: "#f97316", 3: "#ef4444", 4: "#b91c1c", 5: "#7c3aed",
};

// SVG ambulance icon for dispatcher marker
function makeAmbulanceSVG(color = "#3b82f6") {
  const div = document.createElement("div");
  div.innerHTML = `
    <div style="position:relative;width:48px;height:48px;">
      <div style="
        position:absolute;inset:0;
        border-radius:50%;
        background:${color}33;
        animation:pingAmbulance 1.5s ease-in-out infinite;
      "></div>
      <div style="
        position:absolute;inset:8px;
        border-radius:50%;
        background:${color};
        border:2.5px solid white;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 2px 8px rgba(0,0,0,0.4);
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <rect x="1" y="3" width="15" height="13" rx="1"/>
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
          <circle cx="5.5" cy="18.5" r="2.5"/>
          <circle cx="18.5" cy="18.5" r="2.5"/>
        </svg>
      </div>
    </div>`;
  return div.firstElementChild as HTMLElement;
}

// Pulsing SOS marker for pending emergencies
function makeEmergencyMarker(color: string, isActive: boolean) {
  const div = document.createElement("div");
  div.innerHTML = `
    <div style="position:relative;width:${isActive ? 52 : 44}px;height:${isActive ? 52 : 44}px;cursor:pointer;">
      ${isActive ? `
        <div style="
          position:absolute;inset:0;border-radius:50%;
          background:${color}44;
          animation:pingEmergency 1s ease-in-out infinite;
        "></div>
        <div style="
          position:absolute;inset:6px;border-radius:50%;
          background:${color}33;
          animation:pingEmergency 1s ease-in-out infinite 0.3s;
        "></div>
      ` : ""}
      <div style="
        position:absolute;${isActive ? "inset:12px" : "inset:8px"};
        border-radius:50%;
        background:${color};
        border:2.5px solid white;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 2px 12px ${color}88;
        ${!isActive ? "animation:bounceSOS 2s ease-in-out infinite;" : ""}
      ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
    </div>`;
  return div.firstElementChild as HTMLElement;
}

export default function DispatchMap({ dispatcherLat, dispatcherLng, emergencies, activeDispatch, onEmergencyClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const dispatcherMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const routeLayerAddedRef = useRef(false);

  // Inject CSS animations
  useEffect(() => {
    if (document.getElementById("dispatch-map-animations")) return;
    const style = document.createElement("style");
    style.id = "dispatch-map-animations";
    style.textContent = `
      @keyframes pingAmbulance { 0%,100%{transform:scale(1);opacity:0.6} 50%{transform:scale(1.4);opacity:0} }
      @keyframes pingEmergency { 0%,100%{transform:scale(1);opacity:0.7} 50%{transform:scale(1.6);opacity:0} }
      @keyframes bounceSOS { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
    `;
    document.head.appendChild(style);
  }, []);

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
    if (!token) { console.error("NEXT_PUBLIC_MAPBOX_TOKEN is not set"); return; }
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: dispatcherLng && dispatcherLat ? [dispatcherLng, dispatcherLat] : [31.0522, -17.8253],
      zoom: 12,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Dispatcher marker (ambulance)
  useEffect(() => {
    if (!mapRef.current || dispatcherLat === null || dispatcherLng === null) return;
    const el = makeAmbulanceSVG("#3b82f6");
    if (dispatcherMarkerRef.current) {
      dispatcherMarkerRef.current.setLngLat([dispatcherLng, dispatcherLat]);
    } else {
      dispatcherMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([dispatcherLng, dispatcherLat])
        .addTo(mapRef.current);
      mapRef.current.flyTo({ center: [dispatcherLng, dispatcherLat], zoom: 13, duration: 1500 });
    }
  }, [dispatcherLat, dispatcherLng]);

  // Emergency markers
  useEffect(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const allEms = activeDispatch
      ? [activeDispatch, ...emergencies.filter((e) => e.id !== activeDispatch.id)]
      : emergencies;

    allEms.forEach((em) => {
      const color = PRIORITY_HEX[em.priority] ?? "#ef4444";
      const isActive = activeDispatch?.id === em.id;
      const el = makeEmergencyMarker(color, isActive);
      el.title = em.profiles?.full_name ?? "Emergency";
      el.addEventListener("click", () => onEmergencyClick(em));

      const popup = new mapboxgl.Popup({ offset: 28, closeButton: false, className: "dispatch-popup" })
        .setHTML(`
          <div style="background:#1e293b;color:#f1f5f9;font-size:12px;font-weight:700;padding:6px 10px;border-radius:10px;border:1px solid #334155">
            <div>${em.profiles?.full_name ?? "Unknown"}</div>
            <div style="font-weight:400;color:#94a3b8;margin-top:2px">${em.type.replace(/_/g, " ")}</div>
          </div>
        `);

      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([em.patient_lng, em.patient_lat])
        .setPopup(popup)
        .addTo(mapRef.current!);
      markersRef.current.push(marker);
    });

    // Fit bounds
    if (allEms.length > 0) {
      const coords: [number, number][] = allEms.map((e) => [e.patient_lng, e.patient_lat]);
      if (dispatcherLat !== null && dispatcherLng !== null) coords.push([dispatcherLng, dispatcherLat]);
      const bounds = coords.reduce(
        (b, c) => b.extend(c),
        new mapboxgl.LngLatBounds(coords[0], coords[0])
      );
      mapRef.current.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 800 });
    }
  }, [emergencies, activeDispatch]);

  // Draw route when active dispatch accepted
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activeDispatch || dispatcherLat === null || dispatcherLng === null) return;

    const drawRoute = async () => {
      if (!map.isStyleLoaded()) { map.once("load", drawRoute); return; }

      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${dispatcherLng},${dispatcherLat};${activeDispatch.patient_lng},${activeDispatch.patient_lat}?geometries=geojson&access_token=${mapboxgl.accessToken}`;

      try {
        const res = await fetch(url);
        const data = await res.json();
        const route = data.routes?.[0]?.geometry;
        if (!route) return;

        if (map.getSource("route")) {
          (map.getSource("route") as mapboxgl.GeoJSONSource).setData({ type: "Feature", properties: {}, geometry: route });
        } else {
          map.addSource("route", { type: "geojson", data: { type: "Feature", properties: {}, geometry: route } });
          map.addLayer({ id: "route-glow", type: "line", source: "route", paint: { "line-color": "#3b82f6", "line-width": 8, "line-opacity": 0.25 } });
          map.addLayer({ id: "route-line", type: "line", source: "route", paint: { "line-color": "#60a5fa", "line-width": 3, "line-dasharray": [2, 2] } });
          routeLayerAddedRef.current = true;
        }
      } catch { /* directions unavailable — fall back silently */ }
    };

    drawRoute();

    return () => {
      if (!routeLayerAddedRef.current) return;
      if (map.getLayer("route-line")) map.removeLayer("route-line");
      if (map.getLayer("route-glow")) map.removeLayer("route-glow");
      if (map.getSource("route")) map.removeSource("route");
      routeLayerAddedRef.current = false;
    };
  }, [activeDispatch?.id, dispatcherLat, dispatcherLng]);

  return (
    <div ref={containerRef} className="w-full h-full" />
  );
}
