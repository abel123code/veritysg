import { useState, useCallback } from "react";
import Layout from "@/components/Layout";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import RentalSearchForm from "@/components/RentalSearchForm";
import LocationMap from "@/components/LocationMap";

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { resolveLocation, buildHdbRentalBody, buildUraRentalsBody } from "@/lib/resolveLocation";

const fmt = (n: number) =>
  n.toLocaleString("en-SG", { style: "currency", currency: "SGD", maximumFractionDigits: 0 });

interface UnifiedRental {
  date: string;
  address: string;
  rent: number;
  rooms: string;
  areaSqft: string;
}

function normalizeHdb(data: any[]): UnifiedRental[] {
  return data.map((r) => ({
    date: r.date || "",
    address: r.project || "",
    rent: Number(r.rent) || 0,
    rooms: r.unitType || "",
    areaSqft: "–",
  }));
}

function normalizePrivate(data: any[]): UnifiedRental[] {
  return data.map((r) => ({
    date: r.leaseDate || "",
    address: [r.project, r.street].filter(Boolean).join(", "),
    rent: Number(r.rent) || 0,
    rooms: r.noOfBedRoom || "",
    areaSqft: r.areaSqft && Number(r.areaSqft) > 0 ? String(r.areaSqft) : "–",
  }));
}

const FairRents = () => {
  const [results, setResults] = useState<UnifiedRental[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchLabel, setSearchLabel] = useState("");

  const doSearch = async (
    location: string,
    lat?: number,
    lng?: number,
  ) => {
    setHasSearched(true);
    setSearchLabel(location);
    setResults([]);
    setErrors([]);
    setLoading(true);

    const errs: string[] = [];
    const merged: UnifiedRental[] = [];
    const resolved = await resolveLocation(location);

    const promises: Promise<void>[] = [];

    promises.push(
      supabase.functions.invoke("search-rentals", { body: buildHdbRentalBody(resolved) })
        .then(({ data, error }) => {
          if (error) throw error;
          if (!data?.success) throw new Error(data?.error || "HDB search failed");
          merged.push(...normalizeHdb(data.data || []));
        })
        .catch((err) => {
          console.error("HDB search error:", err);
          errs.push(err instanceof Error ? err.message : "HDB search failed");
        }),
    );

    promises.push(
      supabase.functions.invoke("ura-rentals", { body: buildUraRentalsBody(resolved) })
        .then(({ data, error }) => {
          if (error) throw error;
          if (!data?.success) throw new Error(data?.error || "Private rental search failed");
          merged.push(...normalizePrivate(data.data || []));
        })
        .catch((err) => {
          console.error("Private search error:", err);
          errs.push(err instanceof Error ? err.message : "Private rental search failed");
        }),
    );

    await Promise.allSettled(promises);

    // Sort by date descending
    merged.sort((a, b) => b.date.localeCompare(a.date));

    setResults(merged);
    setErrors(errs);
    setLoading(false);
  };

  const handleTextSearch = (params: { location: string; lat?: number; lng?: number }) => {
    doSearch(params.location, params.lat, params.lng);
  };

  const handleMapSelect = useCallback(
    (info: { address: string; postalCode: string; lat: number; lng: number }) => {
      const query = info.postalCode
        ? `${info.address} (${info.postalCode})`
        : info.address;
      doSearch(query, info.lat, info.lng);
    },
    [],
  );

  return (
    <Layout>
      <h2 className="mb-8 text-3xl font-bold tracking-tight">Fair Rents</h2>

      <Accordion type="single" collapsible defaultValue="check-rent" className="space-y-2">
        <AccordionItem value="check-rent" className="border rounded-lg px-4">
          <AccordionTrigger className="text-sm font-semibold uppercase tracking-wide hover:no-underline">
            Check your rent vs. other listings
          </AccordionTrigger>
          <AccordionContent className="pb-6 space-y-5">
            <RentalSearchForm onSearch={handleTextSearch} isLoading={loading} />

            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">or pick on map</span>
              <Separator className="flex-1" />
            </div>

            <LocationMap onLocationSelect={handleMapSelect} searchLocation={searchLabel} />

            {/* Results */}
            {hasSearched && (
              <div className="space-y-3">
                {loading && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Searching rentals near {searchLabel}…
                    </p>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                )}

                {errors.length > 0 &&
                  errors.map((e, i) => (
                    <p key={i} className="text-sm text-destructive">{e}</p>
                  ))}

                {!loading && results.length > 0 && (
                  <div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Address</TableHead>
                          <TableHead className="text-right">Rental Price</TableHead>
                          <TableHead>No. of Rooms</TableHead>
                          <TableHead className="text-right">Area (sqft)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell>{r.date}</TableCell>
                            <TableCell className="font-medium">{r.address}</TableCell>
                            <TableCell className="text-right">{fmt(r.rent)}</TableCell>
                            <TableCell>{r.rooms}</TableCell>
                            <TableCell className="text-right">{r.areaSqft}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Data from HDB (data.gov.sg) and URA rental contracts (past 12 months).
                    </p>
                  </div>
                )}

                {!loading && errors.length === 0 && results.length === 0 && (
                  <p className="text-sm text-muted-foreground">No rental results found.</p>
                )}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Layout>
  );
};

export default FairRents;
