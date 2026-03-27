import { useState, useCallback, useEffect, useRef } from "react";
import Layout from "@/components/Layout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import TransactionTable from "@/components/TransactionTable";
import RentalSearchForm from "@/components/RentalSearchForm";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import DealMeter from "@/components/DealMeter";
import type { LocationSelection } from "@/components/LocationAutocomplete";
import { resolveLocation, buildHdbResaleBody, buildHdbRentalBody, buildUraTransactionsBody, buildUraRentalsBody } from "@/lib/resolveLocation";
import LocationMap from "@/components/LocationMap";
import type { UraTransaction } from "@/data/mockData";
import { supabase } from "@/integrations/supabase/client";
import { Search, Loader2, AlertCircle, RotateCcw } from "lucide-react";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationNext, PaginationPrevious, PaginationEllipsis,
} from "@/components/ui/pagination";

const PAGE_SIZE = 10;

function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "ellipsis")[] = [1];
  if (current > 3) pages.push("ellipsis");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push("ellipsis");
  pages.push(total);
  return pages;
}

function TablePagination({ page, totalPages, total, onPageChange }: {
  page: number; totalPages: number; total: number; onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={(e) => { e.preventDefault(); if (page > 1) onPageChange(page - 1); }}
              className={page <= 1 ? "pointer-events-none opacity-40" : "cursor-pointer"}
            />
          </PaginationItem>
          {getPageNumbers(page, totalPages).map((p, i) =>
            p === "ellipsis" ? (
              <PaginationItem key={`e${i}`}><PaginationEllipsis /></PaginationItem>
            ) : (
              <PaginationItem key={p}>
                <PaginationLink
                  isActive={p === page}
                  onClick={(e) => { e.preventDefault(); onPageChange(p); }}
                  className="cursor-pointer"
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            ),
          )}
          <PaginationItem>
            <PaginationNext
              onClick={(e) => { e.preventDefault(); if (page < totalPages) onPageChange(page + 1); }}
              className={page >= totalPages ? "pointer-events-none opacity-40" : "cursor-pointer"}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
      <p className="text-xs text-muted-foreground">
        Showing {from}–{to} of {total}
      </p>
    </div>
  );
}

/* ── Shared settings hook ── */
interface ToolSettings {
  deal_thresholds_buy?: any;
  deal_thresholds_rent?: any;
  location_aliases?: { alias: string; street: string; town: string }[];
  price_diff_messages?: Record<string, string>;
}

function useToolSettings() {
  const [settings, setSettings] = useState<ToolSettings>({});
  useEffect(() => {
    supabase.functions.invoke("admin-prompts", { body: { action: "get_public_settings" } })
      .then(({ data }) => {
        if (data?.success && data.data) {
          const map: ToolSettings = {};
          for (const row of data.data) (map as any)[row.key] = row.value;
          setSettings(map);
        }
      })
      .catch(() => {});
  }, []);
  return settings;
}

function applyAlias(query: string, aliases: { alias: string; street: string; town: string }[] | undefined): string {
  if (!aliases) return query;
  const lower = query.toLowerCase().trim();
  const match = aliases.find((a) => a.alias.toLowerCase() === lower);
  return match ? match.street : query;
}

function scoreDeal(ratio: number, thresholds: any): number {
  const t = thresholds || { great: { maxRatio: 0.9, score: 90 }, good: { maxRatio: 0.97, score: 70 }, fair: { maxRatio: 1.05, score: 50 }, bad: { score: 20 } };
  if (ratio <= (t.great?.maxRatio ?? 0.9)) return t.great?.score ?? 90;
  if (ratio <= (t.good?.maxRatio ?? 0.97)) return t.good?.score ?? 70;
  if (ratio <= (t.fair?.maxRatio ?? 1.05)) return t.fair?.score ?? 50;
  return t.bad?.score ?? 20;
}

function formatPriceDiff(diff: number, messages: Record<string, string> | undefined, type: "buy" | "rent"): string {
  const amt = Math.abs(diff).toLocaleString("en-SG", { style: "currency", currency: "SGD", maximumFractionDigits: 0 });
  if (!messages) {
    return diff > 0 ? `${amt} over what you should be paying` : diff < 0 ? `${amt} under market value` : "Right at market value";
  }
  const key = diff > 0 ? `${type}_over` : `${type}_under`;
  const template = messages[key] || (diff > 0 ? "${amount} over market" : "${amount} under market");
  return template.replace("${amount}", amt);
}
/* ── currency formatter ── */
const fmt = (n: number) =>
  n.toLocaleString("en-SG", { style: "currency", currency: "SGD", maximumFractionDigits: 0 });

/* ── Unified rental result ── */
interface UnifiedRental {
  source: "HDB" | "Private";
  date: string;
  address: string;
  rent: number;
  rooms: string;
  areaSqft: string;
  propertyType: string;
}

const HDB_TOWNS = [
  "ANG MO KIO","BEDOK","BISHAN","BUKIT BATOK","BUKIT MERAH","BUKIT PANJANG",
  "BUKIT TIMAH","CENTRAL AREA","CHOA CHU KANG","CLEMENTI","GEYLANG",
  "HOUGANG","JURONG EAST","JURONG WEST","KALLANG/WHAMPOA","MARINE PARADE",
  "PASIR RIS","PUNGGOL","QUEENSTOWN","SEMBAWANG","SENGKANG","SERANGOON",
  "TAMPINES","TOA PAYOH","WOODLANDS","YISHUN","TENGAH",
];

type SearchType = "hdb" | "private" | "both" | "postal";

function classifySearch(query: string): SearchType {
  const trimmed = query.replace(/\s*\(.*?\)\s*/g, "").trim();
  if (!trimmed) return "both";
  if (/^\d{6}$/.test(trimmed)) return "postal";
  if (/^\d+\s/.test(trimmed)) return "hdb";
  const upper = trimmed.toUpperCase();
  if (HDB_TOWNS.some((t) => t === upper || t.includes(upper) || upper.includes(t))) return "both";
  return "private";
}

function normalizeHdb(data: any[]): UnifiedRental[] {
  return data.map((r) => ({
    source: "HDB",
    date: r.date || "",
    address: r.project || "",
    rent: Number(r.rent) || 0,
    rooms: r.unitType || "",
    areaSqft: "–",
    propertyType: r.unitType || "",
  }));
}

function normalizePrivate(data: any[]): UnifiedRental[] {
  return data.map((r) => ({
    source: "Private",
    date: r.leaseDate || "",
    address: [r.project, r.street].filter(Boolean).join(", "),
    rent: Number(r.rent) || 0,
    rooms: r.noOfBedRoom || "",
    areaSqft: r.areaSqft && Number(r.areaSqft) > 0 ? String(r.areaSqft) : "–",
    propertyType: r.propertyType || "",
  }));
}

/* ── Format HDB flat type for display ── */
function formatFlatType(flatType: string): string {
  if (!flatType) return "–";
  return flatType;
}

/* ── Evaluated transaction types ── */
interface HdbTransaction {
  type: "HDB";
  location: string;
  sqft: string;
  bedrooms: string;
  resalePrice: number;
  remainingLease: string;
  date: string;
}

interface CondoTransaction {
  type: "Condo";
  projectStreet: string;
  sqft: string;
  price: number;
  floorRange: string;
  contractDate: string;
  tenure: string;
}

type EvalTransaction = HdbTransaction | CondoTransaction;

/* ====================================================================== */
/*  Fair Buys sub-section                                                  */
/* ====================================================================== */
function FairBuysSection() {
  const settings = useToolSettings();
  // Form state
  const [housingType, setHousingType] = useState<"HDB" | "Condo" | "">("");
  const [sqft, setSqft] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [offeringPrice, setOfferingPrice] = useState("");
  const [location, setLocation] = useState("");
  const buySelectionRef = useRef<LocationSelection | null>(null);

  // Results state
  const [transactions, setTransactions] = useState<EvalTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasEvaluated, setHasEvaluated] = useState(false);

  // Pagination & filter
  const [evalPage, setEvalPage] = useState(1);
  const [evalFilter, setEvalFilter] = useState("");

  // Placeholder deal score
  const [dealScore, setDealScore] = useState(50);
  const [priceDiff, setPriceDiff] = useState(0);

  // Missing fields prompt
  const [showMissingPrompt, setShowMissingPrompt] = useState(false);

  const allFilled = housingType !== "" && sqft.trim() !== "" && bedrooms !== "" && offeringPrice.trim() !== "" && location.trim() !== "";

  const resetForm = () => {
    setHousingType("");
    setSqft("");
    setBedrooms("");
    setOfferingPrice("");
    setLocation("");
    setTransactions([]);
    setHasEvaluated(false);
    setError(null);
    setShowMissingPrompt(false);
    setDealScore(50);
    setPriceDiff(0);
    setEvalPage(1);
    setEvalFilter("");
  };

  const runEvaluation = async () => {
    if (!location.trim()) return;
    setIsLoading(true);
    setError(null);
    setHasEvaluated(true);
    setShowMissingPrompt(false);
    setEvalPage(1);
    setEvalFilter("");

    try {
      const sel = buySelectionRef.current;
      const searchQuery = sel?.searchText || applyAlias(location.trim(), settings.location_aliases);
      const resolved = await resolveLocation(searchQuery, sel);

      const merged: EvalTransaction[] = [];
      const selectedType = housingType || "HDB"; // default

      if (selectedType === "Condo") {
        const uraBody = buildUraTransactionsBody(resolved);
        const uraRes = await supabase.functions.invoke("ura-transactions", { body: uraBody });

        if (uraRes.error) throw new Error("Failed to fetch condo transaction data.");
        if (uraRes.data?.transactions) {
          for (const t of uraRes.data.transactions) {
            const pType = (t.propertyType || "").toLowerCase();
            if (!pType.includes("condominium") && !pType.includes("apartment")) continue;
            merged.push({
              type: "Condo",
              projectStreet: [t.project, t.street].filter(Boolean).join(" — "),
              sqft: t.areaSqft ? `${t.areaSqft}` : "–",
              price: Number(t.price) || 0,
              floorRange: t.floorRange || "–",
              contractDate: t.contractDate || "",
              tenure: t.tenure || "–",
            });
          }
        }
      } else {
        const hdbBody = buildHdbResaleBody(resolved);
        const hdbRes = await supabase.functions.invoke("hdb-resale", { body: hdbBody });

        if (hdbRes.error) throw new Error("Failed to fetch HDB resale data.");
        if (hdbRes.data?.transactions) {
          for (const t of hdbRes.data.transactions) {
            merged.push({
              type: "HDB",
              location: t.project || t.street || "–",
              sqft: t.areaSqft ? `${t.areaSqft}` : "–",
              bedrooms: formatFlatType(t.propertyType || ""),
              resalePrice: Number(t.price) || 0,
              remainingLease: t.remainingLease || t.remaining_lease || "–",
              date: t.contractDate || "",
            });
          }
        }
      }

      // Sort by relevance: sqft proximity to user input first, then date
      const targetSqft = parseFloat(sqft) || 0;

      merged.sort((a, b) => {
        if (targetSqft > 0) {
          const sqftA = parseFloat(a.type === "HDB" ? a.sqft : a.sqft) || 0;
          const sqftB = parseFloat(b.type === "HDB" ? b.sqft : b.sqft) || 0;
          const distA = Math.abs(sqftA - targetSqft);
          const distB = Math.abs(sqftB - targetSqft);
          if (distA !== distB) return distA - distB;
        }

        const dateA = a.type === "HDB" ? a.date : a.contractDate;
        const dateB = b.type === "HDB" ? b.date : b.contractDate;
        return dateB.localeCompare(dateA);
      });
      setTransactions(merged);

      // Deal scoring using CMS settings
      const offer = parseFloat(offeringPrice.replace(/[^0-9.]/g, "")) || 0;
      if (merged.length > 0 && offer > 0) {
        const prices = merged.map((t) => t.type === "HDB" ? t.resalePrice : t.price).filter((p) => p > 0).sort((a, b) => a - b);
        const median = prices.length > 0 ? prices[Math.floor(prices.length / 2)] : 0;
        if (median > 0) {
          const diff = offer - median;
          setPriceDiff(diff);
          setDealScore(scoreDeal(offer / median, settings.deal_thresholds_buy));
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch transactions.");
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEvaluate = () => {
    if (!allFilled) {
      setShowMissingPrompt(true);
      return;
    }
    runEvaluation();
  };

  return (
    <section className="space-y-8">
      {/* Header with Start Over */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Property Deal Evaluator
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Input the property details to see if you're getting a fair deal.
          </p>
        </div>
        {(housingType || sqft || bedrooms || offeringPrice || location || hasEvaluated) && (
          <Button variant="ghost" size="sm" onClick={resetForm} className="gap-1.5 text-muted-foreground">
            <RotateCcw className="h-3.5 w-3.5" />
            Start Over
          </Button>
        )}
      </div>

      {/* ── Input Form ── */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-5 overflow-visible">
        {/* Housing Type Toggle */}
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Type of Housing
          </label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={housingType === "HDB" ? "default" : "outline"}
              onClick={() => setHousingType("HDB")}
              className="flex-1"
            >
              HDB
            </Button>
            <Button
              type="button"
              variant={housingType === "Condo" ? "default" : "outline"}
              onClick={() => setHousingType("Condo")}
              className="flex-1"
            >
              Condo
            </Button>
          </div>
        </div>

        {/* Grid: sqft, bedrooms, price */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              No. of Square Feet
            </label>
            <Input
              type="number"
              placeholder="e.g. 1200"
              value={sqft}
              onChange={(e) => setSqft(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              No. of Bedrooms
            </label>
            <Select value={bedrooms} onValueChange={setBedrooms}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
                <SelectItem value="5+">5+</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Offering Price (SGD)
            </label>
            <Input
              type="text"
              placeholder="e.g. 1,200,000"
              value={offeringPrice}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9]/g, "");
                setOfferingPrice(raw ? Number(raw).toLocaleString("en-SG") : "");
              }}
            />
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Location
          </label>
          <LocationAutocomplete
            value={location}
            onChange={(v) => { setLocation(v); buySelectionRef.current = null; }}
            onSelect={(sel) => { buySelectionRef.current = sel; }}
            placeholder="Project name, address, or postal code"
          />
        </div>

        {/* Missing fields prompt */}
        {showMissingPrompt && (
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4 shrink-0" />
              One or more fields missing.
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={runEvaluation}
              className="text-xs"
            >
              Continue with missing fields?
            </Button>
          </div>
        )}

        {/* Evaluate Button */}
        <Button
          onClick={handleEvaluate}
          disabled={isLoading || !location.trim()}
          className="w-full gap-2"
          size="lg"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Evaluate Deal
        </Button>
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Deal Meter + Price Diff ── */}
      {!isLoading && hasEvaluated && transactions.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6 flex flex-col items-center space-y-4">
          <DealMeter score={dealScore} />
          <p className="text-center text-base font-semibold text-foreground">
            {priceDiff === 0 ? "Right at market value" : formatPriceDiff(priceDiff, settings.price_diff_messages, "buy")}
          </p>
          <p className="text-xs text-muted-foreground">
            Based on median of nearby transactions. Full evaluation logic coming soon.
          </p>
        </div>
      )}

      {/* ── Nearby Transactions Table ── */}
      {!isLoading && hasEvaluated && transactions.length > 0 && (() => {
        const q = evalFilter.toLowerCase();
        const filtered = q
          ? transactions.filter((t) => {
              if (t.type === "HDB") {
                return t.location.toLowerCase().includes(q) || t.sqft.toLowerCase().includes(q) || t.bedrooms.toLowerCase().includes(q) || String(t.resalePrice).includes(q) || t.date.includes(q);
              }
              return t.projectStreet.toLowerCase().includes(q) || t.sqft.toLowerCase().includes(q) || String(t.price).includes(q) || t.contractDate.includes(q) || t.tenure.toLowerCase().includes(q);
            })
          : transactions;
        const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
        const paged = filtered.slice((evalPage - 1) * PAGE_SIZE, evalPage * PAGE_SIZE);
        return (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Nearby Transactions
          </h4>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {filtered.length === transactions.length
                ? `${transactions.length} transaction${transactions.length !== 1 ? "s" : ""} found`
                : `${filtered.length} of ${transactions.length} transactions match filter`}
            </p>
            <Input
              placeholder="Filter results…"
              value={evalFilter}
              onChange={(e) => { setEvalFilter(e.target.value); setEvalPage(1); }}
              className="w-48 h-8 text-xs"
            />
          </div>
          <div className="rounded-xl border border-border overflow-hidden">
            {transactions[0]?.type === "HDB" ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Sqft</TableHead>
                    <TableHead>Bedrooms</TableHead>
                    <TableHead className="text-right">Resale Price</TableHead>
                    <TableHead>Remaining Lease</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(paged as HdbTransaction[]).map((t, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Badge variant="secondary" className="bg-muted text-muted-foreground">HDB</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{t.location}</TableCell>
                      <TableCell className="text-right">{t.sqft}</TableCell>
                      <TableCell>{t.bedrooms}</TableCell>
                      <TableCell className="text-right">{fmt(t.resalePrice)}</TableCell>
                      <TableCell>{t.remainingLease}</TableCell>
                      <TableCell>{t.date}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Project & Street</TableHead>
                    <TableHead className="text-right">Area (sqft)</TableHead>
                    <TableHead className="text-right">Transacted Price</TableHead>
                    <TableHead>Floor Range</TableHead>
                    <TableHead>Contract Date</TableHead>
                    <TableHead>Tenure</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(paged as CondoTransaction[]).map((t, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Badge variant="default" className="bg-foreground text-background">Condo</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{t.projectStreet}</TableCell>
                      <TableCell className="text-right">{t.sqft}</TableCell>
                      <TableCell className="text-right">{fmt(t.price)}</TableCell>
                      <TableCell>{t.floorRange}</TableCell>
                      <TableCell>{t.contractDate}</TableCell>
                      <TableCell className="text-xs">{t.tenure}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <TablePagination page={evalPage} totalPages={totalPages} total={filtered.length} onPageChange={setEvalPage} />
          <p className="text-xs text-muted-foreground">
            {transactions[0]?.type === "HDB"
              ? "Data from HDB resale transactions. Source: data.gov.sg"
              : "Data from URA private resale transactions. Source: URA"
            }
          </p>
        </div>
        );
      })()}

      {!isLoading && hasEvaluated && !error && transactions.length === 0 && (
        <p className="text-sm text-muted-foreground">No nearby transactions found for "{location}".</p>
      )}
    </section>
  );
}

/* ── Rental transaction types ── */
interface HdbRentalTransaction {
  type: "HDB";
  location: string;
  bedrooms: string;
  monthlyRental: number;
  rentApprovalDate: string;
}

interface CondoRentalTransaction {
  type: "Condo";
  projectStreet: string;
  areaSqft: string;
  monthlyRental: number;
  bedrooms: string;
  leaseDate: string;
}

type RentalTransaction = HdbRentalTransaction | CondoRentalTransaction;

/* ====================================================================== */
/*  Fair Rents sub-section                                                 */
/* ====================================================================== */
function FairRentsSection() {
  const settings = useToolSettings();
  // Form state
  const [housingType, setHousingType] = useState<"HDB" | "Condo" | "">("");
  const [sqft, setSqft] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [rentalOffering, setRentalOffering] = useState("");
  const [location, setLocation] = useState("");
  const rentSelectionRef = useRef<LocationSelection | null>(null);

  // Results state
  const [transactions, setTransactions] = useState<RentalTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasEvaluated, setHasEvaluated] = useState(false);

  // Deal scoring
  const [dealScore, setDealScore] = useState(50);
  const [priceDiff, setPriceDiff] = useState(0);

  // Pagination & filter
  const [rentalEvalPage, setRentalEvalPage] = useState(1);
  const [rentalEvalFilter, setRentalEvalFilter] = useState("");

  // Missing fields prompt
  const [showMissingPrompt, setShowMissingPrompt] = useState(false);

  const allFilled = housingType !== "" && sqft.trim() !== "" && bedrooms !== "" && rentalOffering.trim() !== "" && location.trim() !== "";

  const resetForm = () => {
    setHousingType("");
    setSqft("");
    setBedrooms("");
    setRentalOffering("");
    setLocation("");
    setTransactions([]);
    setHasEvaluated(false);
    setError(null);
    setShowMissingPrompt(false);
    setDealScore(50);
    setPriceDiff(0);
    setRentalEvalPage(1);
    setRentalEvalFilter("");
  };

  const runEvaluation = async () => {
    if (!location.trim()) return;
    setIsLoading(true);
    setError(null);
    setHasEvaluated(true);
    setShowMissingPrompt(false);
    setRentalEvalPage(1);
    setRentalEvalFilter("");

    try {
      const sel = rentSelectionRef.current;
      const searchQuery = sel?.searchText || applyAlias(location.trim(), settings.location_aliases);
      const selectedType = housingType || "HDB";
      const merged: RentalTransaction[] = [];
      const resolved = await resolveLocation(searchQuery, sel);

      if (selectedType === "Condo") {
        const uraBody = buildUraRentalsBody(resolved);
        const uraRes = await supabase.functions.invoke("ura-rentals", { body: uraBody });

        if (uraRes.error) throw new Error("Failed to fetch private rental data.");
        if (uraRes.data?.success && uraRes.data.data) {
          for (const t of uraRes.data.data) {
            merged.push({
              type: "Condo",
              projectStreet: [t.project, t.street].filter(Boolean).join(" — "),
              areaSqft: t.areaSqft && Number(t.areaSqft) > 0 ? `${t.areaSqft}` : "–",
              monthlyRental: Number(t.rent) || 0,
              bedrooms: t.noOfBedRoom || "–",
              leaseDate: t.leaseDate || "",
            });
          }
        }
      } else {
        const hdbBody = buildHdbRentalBody(resolved);
        const hdbRes = await supabase.functions.invoke("search-rentals", { body: hdbBody });

        if (hdbRes.error) throw new Error("Failed to fetch HDB rental data.");
        if (hdbRes.data?.success && hdbRes.data.data) {
          for (const t of hdbRes.data.data) {
            merged.push({
              type: "HDB",
              location: t.project || "–",
              bedrooms: formatFlatType(t.unitType || ""),
              monthlyRental: Number(t.rent) || 0,
              rentApprovalDate: t.date || "",
            });
          }
        }
      }

      // Sort by relevance: sqft proximity to user input first, then date
      const targetSqft = parseFloat(sqft) || 0;

      merged.sort((a, b) => {
        if (targetSqft > 0) {
          const sqftA = a.type === "Condo" ? (parseFloat(a.areaSqft) || 0) : 0;
          const sqftB = b.type === "Condo" ? (parseFloat(b.areaSqft) || 0) : 0;
          if (sqftA > 0 && sqftB > 0) {
            const distA = Math.abs(sqftA - targetSqft);
            const distB = Math.abs(sqftB - targetSqft);
            if (distA !== distB) return distA - distB;
          }
        }

        const dateA = a.type === "HDB" ? a.rentApprovalDate : a.leaseDate;
        const dateB = b.type === "HDB" ? b.rentApprovalDate : b.leaseDate;
        return dateB.localeCompare(dateA);
      });
      setTransactions(merged);

      // Deal scoring using CMS settings
      const offer = parseFloat(rentalOffering.replace(/[^0-9.]/g, "")) || 0;
      if (merged.length > 0 && offer > 0) {
        const rents = merged.map((t) => t.monthlyRental).filter((p) => p > 0).sort((a, b) => a - b);
        const median = rents.length > 0 ? rents[Math.floor(rents.length / 2)] : 0;
        if (median > 0) {
          const diff = offer - median;
          setPriceDiff(diff);
          setDealScore(scoreDeal(offer / median, settings.deal_thresholds_rent));
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch rental data.");
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEvaluate = () => {
    if (!allFilled) {
      setShowMissingPrompt(true);
      return;
    }
    runEvaluation();
  };

  return (
    <section className="space-y-8">
      {/* Header with Start Over */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Rental Deal Evaluator
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Input the property details to see if you're getting a fair rental deal.
          </p>
        </div>
        {(housingType || sqft || bedrooms || rentalOffering || location || hasEvaluated) && (
          <Button variant="ghost" size="sm" onClick={resetForm} className="gap-1.5 text-muted-foreground">
            <RotateCcw className="h-3.5 w-3.5" />
            Start Over
          </Button>
        )}
      </div>

      {/* ── Input Form ── */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-5 overflow-visible">
        {/* Housing Type Toggle */}
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Type of Housing
          </label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={housingType === "HDB" ? "default" : "outline"}
              onClick={() => setHousingType("HDB")}
              className="flex-1"
            >
              HDB
            </Button>
            <Button
              type="button"
              variant={housingType === "Condo" ? "default" : "outline"}
              onClick={() => setHousingType("Condo")}
              className="flex-1"
            >
              Condo
            </Button>
          </div>
        </div>

        {/* Grid: sqft, bedrooms, rental offering */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              No. of Square Feet
            </label>
            <Input
              type="number"
              placeholder="e.g. 800"
              value={sqft}
              onChange={(e) => setSqft(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              No. of Bedrooms
            </label>
            <Select value={bedrooms} onValueChange={setBedrooms}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
                <SelectItem value="5+">5+</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Monthly Rental Offering (SGD)
            </label>
            <Input
              type="text"
              placeholder="e.g. 3,500"
              value={rentalOffering}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9]/g, "");
                setRentalOffering(raw ? Number(raw).toLocaleString("en-SG") : "");
              }}
            />
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Location
          </label>
          <LocationAutocomplete
            value={location}
            onChange={(v) => { setLocation(v); rentSelectionRef.current = null; }}
            onSelect={(sel) => { rentSelectionRef.current = sel; }}
            placeholder="Project name, address, or town"
          />
        </div>

        {/* Missing fields prompt */}
        {showMissingPrompt && (
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4 shrink-0" />
              One or more fields missing.
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={runEvaluation}
              className="text-xs"
            >
              Continue with missing fields?
            </Button>
          </div>
        )}

        {/* Evaluate Button */}
        <Button
          onClick={handleEvaluate}
          disabled={isLoading || !location.trim()}
          className="w-full gap-2"
          size="lg"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Evaluate Rental
        </Button>
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Deal Meter + Price Diff ── */}
      {!isLoading && hasEvaluated && transactions.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6 flex flex-col items-center space-y-4">
          <DealMeter score={dealScore} />
          <p className="text-center text-base font-semibold text-foreground">
            {priceDiff === 0 ? "Right at market rental value" : formatPriceDiff(priceDiff, settings.price_diff_messages, "rent")}
          </p>
          <p className="text-xs text-muted-foreground">
            Based on median of nearby rental transactions. Full evaluation logic coming soon.
          </p>
        </div>
      )}

      {/* ── Nearby Rental Transactions Table ── */}
      {!isLoading && hasEvaluated && transactions.length > 0 && (() => {
        const q = rentalEvalFilter.toLowerCase();
        const filtered = q
          ? transactions.filter((t) => {
              if (t.type === "HDB") {
                return t.location.toLowerCase().includes(q) || t.bedrooms.toLowerCase().includes(q) || String(t.monthlyRental).includes(q) || t.rentApprovalDate.includes(q);
              }
              return t.projectStreet.toLowerCase().includes(q) || t.areaSqft.toLowerCase().includes(q) || String(t.monthlyRental).includes(q) || t.bedrooms.toLowerCase().includes(q) || t.leaseDate.includes(q);
            })
          : transactions;
        const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
        const paged = filtered.slice((rentalEvalPage - 1) * PAGE_SIZE, rentalEvalPage * PAGE_SIZE);
        return (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Nearby Rental Transactions
          </h4>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {filtered.length === transactions.length
                ? `${transactions.length} rental transaction${transactions.length !== 1 ? "s" : ""} found`
                : `${filtered.length} of ${transactions.length} transactions match filter`}
            </p>
            <Input
              placeholder="Filter results…"
              value={rentalEvalFilter}
              onChange={(e) => { setRentalEvalFilter(e.target.value); setRentalEvalPage(1); }}
              className="w-48 h-8 text-xs"
            />
          </div>
          <div className="rounded-xl border border-border overflow-hidden">
            {transactions[0]?.type === "HDB" ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Flat Type</TableHead>
                    <TableHead className="text-right">Monthly Rental</TableHead>
                    <TableHead>Rent Approval Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(paged as HdbRentalTransaction[]).map((t, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Badge variant="secondary" className="bg-muted text-muted-foreground">HDB</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{t.location}</TableCell>
                      <TableCell>{t.bedrooms}</TableCell>
                      <TableCell className="text-right">{fmt(t.monthlyRental)}</TableCell>
                      <TableCell>{t.rentApprovalDate}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Project & Street</TableHead>
                    <TableHead className="text-right">Area (sqft)</TableHead>
                    <TableHead className="text-right">Monthly Rental</TableHead>
                    <TableHead>Bedrooms</TableHead>
                    <TableHead>Lease Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(paged as CondoRentalTransaction[]).map((t, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Badge variant="default" className="bg-foreground text-background">Condo</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{t.projectStreet}</TableCell>
                      <TableCell className="text-right">{t.areaSqft}</TableCell>
                      <TableCell className="text-right">{fmt(t.monthlyRental)}</TableCell>
                      <TableCell>{t.bedrooms}</TableCell>
                      <TableCell>{t.leaseDate}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <TablePagination page={rentalEvalPage} totalPages={totalPages} total={filtered.length} onPageChange={setRentalEvalPage} />
          <p className="text-xs text-muted-foreground">
            {transactions[0]?.type === "HDB"
              ? "Data from HDB rental transactions. Source: data.gov.sg"
              : "Data from URA rental contracts. Source: URA"
            }
          </p>
        </div>
        );
      })()}

      {!isLoading && hasEvaluated && !error && transactions.length === 0 && (
        <p className="text-sm text-muted-foreground">No nearby rental transactions found for "{location}".</p>
      )}
    </section>
  );
}

/* ====================================================================== */
/*  Just Looking Around sub-section                                        */
/* ====================================================================== */
function JustLookingSection() {
  const [mode, setMode] = useState<"idle" | "renting" | "buying">("idle");
  const [rentalResults, setRentalResults] = useState<UnifiedRental[]>([]);
  const [buyResults, setBuyResults] = useState<UraTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchLabel, setSearchLabel] = useState("");
  const [rentalPage, setRentalPage] = useState(1);
  const [buyPage, setBuyPage] = useState(1);
  const [rentalFilter, setRentalFilter] = useState("");
  const [buyFilter, setBuyFilter] = useState("");

  const doRentalSearch = async (location: string, lat?: number, lng?: number) => {
    setIsLoading(true);
    setErrors([]);
    setRentalResults([]);
    setBuyResults([]);
    setHasSearched(true);
    setSearchLabel(location);

    const errs: string[] = [];
    const merged: UnifiedRental[] = [];
    const resolved = await resolveLocation(location, null, lat, lng);
    const promises: Promise<void>[] = [];

    promises.push(
      supabase.functions.invoke("search-rentals", { body: buildHdbRentalBody(resolved) })
        .then(({ data, error }) => {
          if (error) throw error;
          if (!data?.success) throw new Error(data?.error || "HDB search failed");
          merged.push(...normalizeHdb(data.data || []));
        })
        .catch((err) => { errs.push(err instanceof Error ? err.message : "HDB rental search failed"); }),
    );

    promises.push(
      supabase.functions.invoke("ura-rentals", { body: buildUraRentalsBody(resolved) })
        .then(({ data, error }) => {
          if (error) throw error;
          if (!data?.success) throw new Error(data?.error || "Private rental search failed");
          merged.push(...normalizePrivate(data.data || []));
        })
        .catch((err) => { errs.push(err instanceof Error ? err.message : "Private rental search failed"); }),
    );

    await Promise.allSettled(promises);
    merged.sort((a, b) => b.date.localeCompare(a.date));
    setRentalResults(merged);
    setRentalPage(1);
    setRentalFilter("");
    setErrors(errs);
    setIsLoading(false);
  };

  const doBuySearch = async (location: string, lat?: number, lng?: number) => {
    setIsLoading(true);
    setErrors([]);
    setRentalResults([]);
    setBuyResults([]);
    setHasSearched(true);
    setSearchLabel(location);

    const errs: string[] = [];
    const resolved = await resolveLocation(location, null, lat, lng);

    const [uraRes, hdbRes] = await Promise.allSettled([
      supabase.functions.invoke("ura-transactions", { body: buildUraTransactionsBody(resolved) }),
      supabase.functions.invoke("hdb-resale", { body: buildHdbResaleBody(resolved) }),
    ]);

    let uraTransactions: UraTransaction[] = [];
    if (uraRes.status === "fulfilled" && !uraRes.value.error && uraRes.value.data?.transactions) {
      uraTransactions = uraRes.value.data.transactions.map((t: UraTransaction) => ({ ...t, source: "Private" as const }));
    } else {
      errs.push("Private resale search failed");
    }

    let hdbTransactions: UraTransaction[] = [];
    if (hdbRes.status === "fulfilled" && !hdbRes.value.error && hdbRes.value.data?.transactions) {
      hdbTransactions = hdbRes.value.data.transactions.map((t: UraTransaction) => ({ ...t, source: "HDB" as const }));
    } else {
      errs.push("HDB resale search failed");
    }

    const merged = [...uraTransactions, ...hdbTransactions].sort(
      (a, b) => b.contractDate.localeCompare(a.contractDate),
    );
    setBuyResults(merged);
    setBuyPage(1);
    setBuyFilter("");
    setErrors(errs);
    setIsLoading(false);
  };

  const handleTextSearch = (params: { location: string; lat?: number; lng?: number }) => {
    if (mode === "renting") doRentalSearch(params.location, params.lat, params.lng);
    else if (mode === "buying") doBuySearch(params.location, params.lat, params.lng);
  };

  const handleMapSelect = useCallback((info: { address: string; postalCode: string; lat: number; lng: number }) => {
    const query = info.postalCode ? `${info.address} (${info.postalCode})` : info.address;
    if (mode === "renting") doRentalSearch(query, info.lat, info.lng);
    else if (mode === "buying") doBuySearch(query, info.lat, info.lng);
  }, [mode]);

  return (
    <section className="space-y-6">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Browse recent market data
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Don't have a specific property in mind? Pick what you're looking for, then search any area on the map.
        </p>
        <div className="flex gap-3">
          <Button
            variant={mode === "renting" ? "default" : "outline"}
            onClick={() => { setMode("renting"); setHasSearched(false); setRentalResults([]); setBuyResults([]); setErrors([]); }}
            className="gap-2"
          >
            Renting
          </Button>
          <Button
            variant={mode === "buying" ? "default" : "outline"}
            onClick={() => { setMode("buying"); setHasSearched(false); setRentalResults([]); setBuyResults([]); setErrors([]); }}
            className="gap-2"
          >
            Buying
          </Button>
        </div>
      </div>

      {mode !== "idle" && (
        <div className="space-y-5">
          <RentalSearchForm
            onSearch={handleTextSearch}
            isLoading={isLoading}
          />

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">or pick on map</span>
            <Separator className="flex-1" />
          </div>

          <LocationMap onLocationSelect={handleMapSelect} searchLocation={searchLabel} />
        </div>
      )}

      {isLoading && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Searching near {searchLabel}…</p>
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      )}

      {errors.length > 0 && errors.map((e, i) => (
        <div key={i} className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {e}
        </div>
      ))}

      {/* Rental results table */}
      {!isLoading && mode === "renting" && rentalResults.length > 0 && (() => {
        const q = rentalFilter.toLowerCase();
        const filtered = q
          ? rentalResults.filter((r) =>
              r.address.toLowerCase().includes(q) ||
              r.propertyType.toLowerCase().includes(q) ||
              r.rooms.toLowerCase().includes(q) ||
              r.source.toLowerCase().includes(q) ||
              r.date.includes(q) ||
              String(r.rent).includes(q)
            )
          : rentalResults;
        const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
        const paged = filtered.slice((rentalPage - 1) * PAGE_SIZE, rentalPage * PAGE_SIZE);
        return (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">
                {filtered.length === rentalResults.length
                  ? `${rentalResults.length} rental transaction${rentalResults.length !== 1 ? "s" : ""} found`
                  : `${filtered.length} of ${rentalResults.length} transactions match filter`}
              </p>
              <Input
                placeholder="Filter results…"
                value={rentalFilter}
                onChange={(e) => { setRentalFilter(e.target.value); setRentalPage(1); }}
                className="w-48 h-8 text-xs"
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Area (sqft)</TableHead>
                  <TableHead>No. of Rooms</TableHead>
                  <TableHead className="text-right">Rental Price</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Badge
                        variant={r.source === "HDB" ? "secondary" : "default"}
                        className={
                          r.source === "HDB"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                        }
                      >
                        {r.source}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{r.address}</TableCell>
                    <TableCell>{r.propertyType}</TableCell>
                    <TableCell className="text-right">{r.areaSqft}</TableCell>
                    <TableCell>{r.rooms}</TableCell>
                    <TableCell className="text-right">{fmt(r.rent)}</TableCell>
                    <TableCell>{r.date}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination page={rentalPage} totalPages={totalPages} total={rentalResults.length} onPageChange={setRentalPage} />
            <p className="mt-2 text-xs text-muted-foreground text-center">
              Data from HDB (data.gov.sg) and URA rental contracts (past 12 months).
            </p>
          </div>
        );
      })()}

      {/* Buy results table */}
      {!isLoading && mode === "buying" && buyResults.length > 0 && (() => {
        const q = buyFilter.toLowerCase();
        const filtered = q
          ? buyResults.filter((t) =>
              t.project.toLowerCase().includes(q) ||
              t.street.toLowerCase().includes(q) ||
              t.propertyType.toLowerCase().includes(q) ||
              (t.source || "").toLowerCase().includes(q) ||
              t.contractDate.includes(q) ||
              String(t.price).includes(q) ||
              String(t.areaSqft).includes(q)
            )
          : buyResults;
        const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
        const paged = filtered.slice((buyPage - 1) * PAGE_SIZE, buyPage * PAGE_SIZE);
        return (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">
                {filtered.length === buyResults.length
                  ? `${buyResults.length} transaction${buyResults.length !== 1 ? "s" : ""} found`
                  : `${filtered.length} of ${buyResults.length} transactions match filter`}
              </p>
              <Input
                placeholder="Filter results…"
                value={buyFilter}
                onChange={(e) => { setBuyFilter(e.target.value); setBuyPage(1); }}
                className="w-48 h-8 text-xs"
              />
            </div>
            <TransactionTable data={paged} />
            <TablePagination page={buyPage} totalPages={totalPages} total={buyResults.length} onPageChange={setBuyPage} />
          </div>
        );
      })()}

      {!isLoading && hasSearched && errors.length === 0 &&
        ((mode === "renting" && rentalResults.length === 0) || (mode === "buying" && buyResults.length === 0)) && (
        <p className="text-sm text-muted-foreground">No results found for "{searchLabel}".</p>
      )}
    </section>
  );
}

/* ====================================================================== */
/*  Tool page — tabbed container                                           */
/* ====================================================================== */
export default function Tool() {
  return (
    <Layout>
      <h2 className="mb-6 text-3xl font-bold tracking-tight">Tool</h2>

      <Tabs defaultValue="looking" className="w-full">
        <TabsList className="w-full justify-start mb-6">
          <TabsTrigger value="looking">Just Looking Around</TabsTrigger>
          <TabsTrigger value="buys">Fair Buys</TabsTrigger>
          <TabsTrigger value="rents">Fair Rents</TabsTrigger>
        </TabsList>

        <TabsContent value="looking">
          <JustLookingSection />
        </TabsContent>

        <TabsContent value="buys">
          <FairBuysSection />
        </TabsContent>

        <TabsContent value="rents">
          <FairRentsSection />
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
