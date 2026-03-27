import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OneMapResult {
  SEARCHVAL: string;
  BLK_NO: string;
  ROAD_NAME: string;
  BUILDING: string;
  ADDRESS: string;
  POSTAL: string;
  LATITUDE: string;
  LONGITUDE: string;
}

export interface LocationSelection {
  displayText: string;
  searchText: string;
  lat?: number;
  lng?: number;
  postal?: string;
  blkNo?: string;
  roadName?: string;
  building?: string;
}

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (selection: LocationSelection) => void;
  placeholder?: string;
  className?: string;
}

function formatResult(r: OneMapResult): string {
  const parts: string[] = [];
  if (r.BUILDING && r.BUILDING !== "NIL" && r.BUILDING !== r.ADDRESS) {
    parts.push(r.BUILDING);
  }
  if (r.ADDRESS && r.ADDRESS !== "NIL") {
    parts.push(r.ADDRESS);
  }
  if (parts.length === 0 && r.SEARCHVAL) {
    parts.push(r.SEARCHVAL);
  }
  return parts.join(" — ");
}

export default function LocationAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "e.g. Pinnacle @ Duxton, Clementi, 520123…",
  className,
}: LocationAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<OneMapResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);
  const suppressSearchRef = useRef(false);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("onemap", {
        body: { action: "search", searchVal: query.trim() },
      });

      if (!error && data?.success && data.data?.results) {
        // Take top 6 results
        const results = (data.data.results as OneMapResult[]).slice(0, 6);
        setSuggestions(results);
        setShowDropdown(results.length > 0);
        setHighlightIdx(-1);
      } else {
        setSuggestions([]);
        setShowDropdown(false);
      }
    } catch {
      setSuggestions([]);
      setShowDropdown(false);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search on value change
  useEffect(() => {
    if (suppressSearchRef.current) {
      suppressSearchRef.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, fetchSuggestions]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = (result: OneMapResult) => {
    const display = formatResult(result);
    suppressSearchRef.current = true;
    onChange(display);
    setShowDropdown(false);
    setSuggestions([]);

    if (onSelect) {
      const lat = parseFloat(result.LATITUDE);
      const lng = parseFloat(result.LONGITUDE);
      onSelect({
        displayText: display,
        searchText: result.ADDRESS !== "NIL" ? result.ADDRESS : result.SEARCHVAL,
        lat: isNaN(lat) ? undefined : lat,
        lng: isNaN(lng) ? undefined : lng,
        postal: result.POSTAL !== "NIL" ? result.POSTAL : undefined,
        blkNo: result.BLK_NO !== "NIL" ? result.BLK_NO : undefined,
        roadName: result.ROAD_NAME !== "NIL" ? result.ROAD_NAME : undefined,
        building: result.BUILDING !== "NIL" ? result.BUILDING : undefined,
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && highlightIdx >= 0) {
      e.preventDefault();
      handleSelect(suggestions[highlightIdx]);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pr-8"
        />
        {isSearching && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg overflow-hidden">
          {suggestions.map((result, idx) => (
            <button
              key={`${result.POSTAL}-${idx}`}
              type="button"
              className={cn(
                "flex w-full items-start gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent",
                idx === highlightIdx && "bg-accent",
              )}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(result); }}
              onMouseEnter={() => setHighlightIdx(idx)}
            >
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate">
                  {result.BUILDING && result.BUILDING !== "NIL" ? result.BUILDING : result.SEARCHVAL}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {result.ADDRESS !== "NIL" ? result.ADDRESS : ""}
                  {result.POSTAL && result.POSTAL !== "NIL" ? ` (${result.POSTAL})` : ""}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
