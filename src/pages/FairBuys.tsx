import { useState, useRef } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import TransactionTable from "@/components/TransactionTable";
import SavedSearchCard from "@/components/SavedSearchCard";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import type { LocationSelection } from "@/components/LocationAutocomplete";
import { mockSavedBuySearches } from "@/data/mockData";
import type { UraTransaction } from "@/data/mockData";
import { supabase } from "@/integrations/supabase/client";
import { resolveLocation, buildHdbResaleBody, buildUraTransactionsBody } from "@/lib/resolveLocation";
import { Search, Loader2, AlertCircle } from "lucide-react";

const FairBuys = () => {
  const [query, setQuery] = useState("");
  const selectionRef = useRef<LocationSelection | null>(null);
  const [results, setResults] = useState<UraTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || query.trim().length < 2) return;

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const sel = selectionRef.current;
      const searchText = sel?.searchText || query.trim();
      const resolved = await resolveLocation(searchText, sel);

      const [uraRes, hdbRes] = await Promise.all([
        supabase.functions.invoke("ura-transactions", { body: buildUraTransactionsBody(resolved) }),
        supabase.functions.invoke("hdb-resale", { body: buildHdbResaleBody(resolved) }),
      ]);

      // Process URA results
      let uraTransactions: UraTransaction[] = [];
      if (!uraRes.error && uraRes.data?.transactions) {
        uraTransactions = uraRes.data.transactions.map((t: UraTransaction) => ({
          ...t,
          source: "Private" as const,
        }));
      }

      // Process HDB results
      let hdbTransactions: UraTransaction[] = [];
      if (!hdbRes.error && hdbRes.data?.transactions) {
        hdbTransactions = hdbRes.data.transactions.map((t: UraTransaction) => ({
          ...t,
          source: "HDB" as const,
        }));
      }

      // Merge and sort by date descending
      const merged = [...uraTransactions, ...hdbTransactions].sort(
        (a, b) => b.contractDate.localeCompare(a.contractDate)
      );

      if (uraRes.error && hdbRes.error) {
        throw new Error("Failed to fetch transaction data.");
      }

      setResults(merged);
    } catch (err: any) {
      setError(err.message || "Failed to fetch transactions.");
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <h2 className="mb-8 text-3xl font-bold tracking-tight">Fair Buys</h2>

      <section className="mb-8">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Check seller's price vs. past transactions
        </h3>
        <form onSubmit={handleSearch} className="flex items-end gap-3 mb-4">
          <div className="flex-1 max-w-md">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Project or Location
            </label>
            <LocationAutocomplete
              value={query}
              onChange={(v) => { setQuery(v); selectionRef.current = null; }}
              onSelect={(sel) => { selectionRef.current = sel; }}
              placeholder="e.g. Riviere, Pinnacle @ Duxton, 520123…"
            />
          </div>
          <Button type="submit" disabled={isLoading || query.trim().length < 2} className="gap-2">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </Button>
        </form>

        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {!isLoading && !error && hasSearched && results.length === 0 && (
          <p className="text-sm text-muted-foreground">No transactions found for "{query}".</p>
        )}

        {!isLoading && results.length > 0 && (
          <>
            <p className="mb-2 text-xs text-muted-foreground">
              {results.length} transaction{results.length !== 1 ? "s" : ""} found
            </p>
            <TransactionTable data={results} />
          </>
        )}

        {!hasSearched && (
          <p className="text-sm text-muted-foreground">
            Search by project name, location, or postal code to see past private property (URA) and HDB resale transactions.
          </p>
        )}
      </section>

      <section className="mt-10">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Saved Searches
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {mockSavedBuySearches.map((s) => (
            <SavedSearchCard key={s.id} search={s} />
          ))}
        </div>
      </section>
    </Layout>
  );
};

export default FairBuys;
