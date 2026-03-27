import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import type { LocationSelection } from "@/components/LocationAutocomplete";
import { Search, Loader2 } from "lucide-react";

interface RentalSearchFormProps {
  onSearch: (params: { location: string; lat?: number; lng?: number }) => void;
  isLoading: boolean;
}

const RentalSearchForm = ({ onSearch, isLoading }: RentalSearchFormProps) => {
  const [location, setLocation] = useState("");
  const selectionRef = useRef<LocationSelection | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!location.trim()) return;
    const sel = selectionRef.current;
    onSearch({
      location: sel?.searchText || location.trim(),
      lat: sel?.lat,
      lng: sel?.lng,
    });
  };

  const handleSelect = (sel: LocationSelection) => {
    selectionRef.current = sel;
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3">
      <div className="flex-1 max-w-md">
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Location
        </label>
        <LocationAutocomplete
          value={location}
          onChange={(v) => { setLocation(v); selectionRef.current = null; }}
          onSelect={handleSelect}
          placeholder="e.g. Clementi, Pinnacle @ Duxton, 520123…"
        />
      </div>

      <Button type="submit" disabled={isLoading || !location.trim()} className="gap-2">
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        Search
      </Button>
    </form>
  );
};

export default RentalSearchForm;
