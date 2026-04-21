"use client";

import { useEffect, useRef } from "react";

type Props = {
  lat: number;
  lng: number;
  dispatcherLat?: number;
  dispatcherLng?: number;
};

export default function EmergencyMap({ lat, lng, dispatcherLat, dispatcherLng }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const dispatcherMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const mapboxRef = useRef<typeof import("mapbox-gl") | null>(null);
  const routeDrawnRef = useRef(false);

  // Init map once
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    import("mapbox-gl").then((mapboxgl) => {
      mapboxRef.current = mapboxgl;
      mapboxgl.default.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

      const map = new mapboxgl.default.Map({
        container: mapContainer.current!,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [lng, lat],
        zoom: 14,
      });

      mapRef.current = map;

      // Patient marker — pulsing red dot
      const patientEl = document.createElement("div");
      patientEl.innerHTML = `
        <div style="position:relative;width:40px;height:40px;">
          <div style="position:absolute;inset:0;border-radius:50%;background:#ef444444;animation:pulsePatient 1.5s ease-in-out infinite;"></div>
          <div style="position:absolute;inset:8px;border-radius:50%;background:#ef4444;border:2.5px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4);">
            <span style="font-size:14px;">📍</span>
          </div>
        </div>`;

      // Inject CSS animations
      if (!document.getElementById("emergency-map-anim")) {
        const style = document.createElement("style");
        style.id = "emergency-map-anim";
        style.textContent = `
          @keyframes pulsePatient { 0%,100%{transform:scale(1);opacity:0.6} 50%{transform:scale(1.5);opacity:0} }
          @keyframes pulseAmbulance { 0%,100%{transform:scale(1);opacity:0.6} 50%{transform:scale(1.4);opacity:0} }
        `;
        document.head.appendChild(style);
      }

      new mapboxgl.default.Marker({ element: patientEl.firstElementChild as HTMLElement, anchor: "center" })
        .setLngLat([lng, lat])
        .addTo(map);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      dispatcherMarkerRef.current = null;
      routeDrawnRef.current = false;
    };
  }, []);

  // Update / add dispatcher marker + route when dispatcher position changes
  useEffect(() => {
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl || dispatcherLat === undefined || dispatcherLng === undefined) return;

    // Create or move dispatcher marker (ambulance)
    if (dispatcherMarkerRef.current) {
      dispatcherMarkerRef.current.setLngLat([dispatcherLng, dispatcherLat]);
    } else {
      const el = document.createElement("div");
      el.innerHTML = `
        <div style="position:relative;width:44px;height:44px;">
          <div style="position:absolute;inset:0;border-radius:50%;background:#3b82f633;animation:pulseAmbulance 1.5s ease-in-out infinite;"></div>
          <div style="position:absolute;inset:8px;border-radius:50%;background:#3b82f6;border:2.5px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4);">
            <span style="font-size:14px;">🚑</span>
          </div>
        </div>`;
      dispatcherMarkerRef.current = new mapboxgl.default.Marker({
        element: el.firstElementChild as HTMLElement,
        anchor: "center",
      })
        .setLngLat([dispatcherLng, dispatcherLat])
        .addTo(map);
    }

    // Fit bounds to show both patient + dispatcher
    const bounds = new mapboxgl.default.LngLatBounds();
    bounds.extend([lng, lat]);
    bounds.extend([dispatcherLng, dispatcherLat]);
    map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 800 });

    // Draw driving route
    const drawRoute = async () => {
      if (!map.isStyleLoaded()) {
        map.once("load", drawRoute);
        return;
      }
      const token = mapboxgl.default.accessToken;
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${dispatcherLng},${dispatcherLat};${lng},${lat}?geometries=geojson&access_token=${token}`;
      try {
        const res = await fetch(url);
        const data = await res.json();
        const route = data.routes?.[0]?.geometry;
        if (!route) return;

        if (map.getSource("emer-route")) {
          (map.getSource("emer-route") as unknown as { setData: (d: unknown) => void }).setData({
            type: "Feature", properties: {}, geometry: route,
          });
        } else {
          map.addSource("emer-route", {
            type: "geojson",
            data: { type: "Feature", properties: {}, geometry: route },
          });
          map.addLayer({
            id: "emer-route-glow", type: "line", source: "emer-route",
            paint: { "line-color": "#3b82f6", "line-width": 8, "line-opacity": 0.2 },
          });
          map.addLayer({
            id: "emer-route-line", type: "line", source: "emer-route",
            paint: { "line-color": "#60a5fa", "line-width": 3, "line-dasharray": [2, 2] },
          });
          routeDrawnRef.current = true;
        }
      } catch { /* directions unavailable */ }
    };
    drawRoute();
  }, [dispatcherLat, dispatcherLng, lat, lng]);

  return (
    <div
      ref={mapContainer}
      className="w-full h-56 rounded-2xl overflow-hidden border border-red-800"
    />
  );
}
