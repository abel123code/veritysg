import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MapPin } from "lucide-react";

// Fix default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface LocationMapProps {
  onLocationSelect: (info: { address: string; postalCode: string; lat: number; lng: number }) => void;
  searchLocation?: string | null;
}

const LocationMap = ({ onLocationSelect, searchLocation }: LocationMapProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [addressLabel, setAddressLabel] = useState<string | null>(null);

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    // Update marker
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else if (mapRef.current) {
      markerRef.current = L.marker([lat, lng]).addTo(mapRef.current);
    }

    setIsGeocoding(true);
    setAddressLabel(null);

    try {
      const { data, error } = await supabase.functions.invoke("onemap", {
        body: { action: "reverseGeocode", lat, lng },
      });

      if (error) throw error;
      if (!data?.success || !data.data?.GeocodeInfo?.length) {
        setAddressLabel("No address found here");
        return;
      }

      const info = data.data.GeocodeInfo[0];
      const address = [info.BLOCK, info.ROAD, info.BUILDINGNAME].filter(Boolean).join(" ");
      setAddressLabel(address || "Unknown location");

      onLocationSelect({
        address: address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        postalCode: info.POSTALCODE || "",
        lat,
        lng,
      });
    } catch (err) {
      console.error("Reverse geocode error:", err);
      setAddressLabel("Could not resolve address");
    } finally {
      setIsGeocoding(false);
    }
  }, [onLocationSelect]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView([1.3521, 103.8198], 12);
    L.tileLayer("https://www.onemap.gov.sg/maps/tiles/Default/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      handleMapClick(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [handleMapClick]);

  // Geocode typed search location and fly to it
  useEffect(() => {
    if (!searchLocation || !mapRef.current) return;

    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("onemap", {
          body: { action: "search", searchVal: searchLocation },
        });

        if (cancelled || error || !data?.success) return;

        const results = data.data?.results;
        if (!results?.length) return;

        const first = results[0];
        const lat = parseFloat(first.LATITUDE);
        const lng = parseFloat(first.LONGITUDE);

        if (isNaN(lat) || isNaN(lng) || !mapRef.current) return;

        // Drop pin
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng]).addTo(mapRef.current);
        }

        mapRef.current.flyTo([lat, lng], 16);

        const address = [first.BLK_NO, first.ROAD_NAME, first.BUILDING].filter(Boolean).join(" ");
        setAddressLabel(address || searchLocation);
      } catch (err) {
        console.error("Forward geocode error:", err);
      }
    })();

    return () => { cancelled = true; };
  }, [searchLocation]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin className="h-3.5 w-3.5" />
        Click on the map to pick a location
      </div>
      <div className="relative rounded-lg overflow-hidden border" style={{ height: 300 }}>
        <div ref={containerRef} style={{ height: "100%", width: "100%" }} />

        {isGeocoding && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-[1000]">
            <div className="flex items-center gap-2 bg-background rounded-md px-3 py-2 shadow text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Resolving address…
            </div>
          </div>
        )}
      </div>

      {addressLabel && !isGeocoding && (
        <p className="text-sm font-medium truncate">{addressLabel}</p>
      )}
    </div>
  );
};

export default LocationMap;
