"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Stop {
  id: string;
  address?: {
    address?: string;
    addressLineOne?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
  recipient?: {
    name?: string;
    phone?: string;
  };
  externalId?: string;
  deliveryInfo?: {
    succeeded?: boolean;
    attempted?: boolean;
    state?: string;
  };
  orderCreatedAt?: string;
}

interface RouteMapProps {
  stops: Stop[];
  center?: [number, number];
  zoom?: number;
  className?: string;
}

// Fix for default marker icons in Leaflet
const createDefaultIcon = () => {
  return L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
};

const createSuccessIcon = () => {
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="background-color: #22c55e; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  });
};

const createPendingIcon = () => {
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="background-color: #f59e0b; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  });
};

const createFailedIcon = () => {
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="background-color: #ef4444; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  });
};

const RouteMap = ({ stops, center = [-25.4284, -49.2733], zoom = 12, className = "" }: RouteMapProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const polylineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize map
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current).setView(center, zoom);

      // Add OpenStreetMap tiles
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(mapRef.current);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [center, zoom]);

  useEffect(() => {
    if (!mapRef.current || !stops || stops.length === 0) return;

    // Clear existing markers and polyline
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    const coordinates: [number, number][] = [];

    // Add markers for each stop
    stops.forEach((stop, index) => {
      // Try to get coordinates from address
      // For now, we'll use approximate coordinates based on the order
      // In a real implementation, you would geocode the addresses
      const lat = center[0] + (Math.random() - 0.5) * 0.05;
      const lng = center[1] + (Math.random() - 0.5) * 0.05;
      const coord: [number, number] = [lat, lng];
      coordinates.push(coord);

      // Determine icon based on status
      // allow either standard Icon or DivIcon so TypeScript accepts both kinds
      let icon: L.Icon | L.DivIcon = createDefaultIcon();
      if (stop.deliveryInfo?.succeeded) {
        icon = createSuccessIcon();
      } else if (stop.deliveryInfo?.attempted && !stop.deliveryInfo?.succeeded) {
        icon = createFailedIcon();
      } else {
        icon = createPendingIcon();
      }

      // Create marker
      const marker = L.marker(coord, { icon })
        .addTo(mapRef.current!)
        .bindPopup(`
          <div style="min-width: 200px;">
            <strong>Parada #${index + 1}</strong><br/>
            ${stop.externalId ? `<strong>Pedido:</strong> #${stop.externalId}<br/>` : ""}
            ${stop.recipient?.name ? `<strong>Cliente:</strong> ${stop.recipient.name}<br/>` : ""}
            ${stop.address?.address || stop.address?.addressLineOne ? `<strong>Endereço:</strong> ${stop.address.address || stop.address.addressLineOne}<br/>` : ""}
            ${stop.address?.city ? `<strong>Cidade:</strong> ${stop.address.city}<br/>` : ""}
            ${stop.recipient?.phone ? `<strong>Telefone:</strong> ${stop.recipient.phone}<br/>` : ""}
            ${stop.deliveryInfo?.succeeded ? '<span style="color: green;">✓ Entregue</span>' : 
              stop.deliveryInfo?.attempted ? '<span style="color: red;">✗ Falhou</span>' : 
              '<span style="color: orange;">○ Pendente</span>'}
          </div>
        `);

      markersRef.current.push(marker);
    });

    // Draw polyline connecting stops
    if (coordinates.length > 1) {
      polylineRef.current = L.polyline(coordinates, {
        color: "#3b82f6",
        weight: 4,
        opacity: 0.7,
        dashArray: "10, 10"
      }).addTo(mapRef.current!);
    }

    // Fit bounds to show all markers
    if (coordinates.length > 0) {
      const bounds = L.latLngBounds(coordinates);
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [stops, center]);

  return (
    <div 
      ref={mapContainerRef} 
      className={className}
      style={{ height: "100%", width: "100%", minHeight: "400px" }}
    />
  );
};

export default RouteMap;