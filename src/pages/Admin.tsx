import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Lock, Save, RefreshCw, Plus, Trash2, Upload, Move, MousePointer, Eye, BookOpen, ArrowLeft, Settings, Smartphone, Monitor, Image, Video } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface RoomHotspot {
  id: string; room_key: string; x_percent: number; y_percent: number; mobile_x_percent?: number | null; mobile_y_percent?: number | null; title: string; description: string; sort_order: number; tactics_label: string;
}
interface RoomImage { room_key: string; image_url: string; mobile_image_url: string; title: string; tactics_label: string; }
interface GuideTactic { id: string; phase: string; question: string; answer: string; sort_order: number; }
interface GuideRegulation { id: string; title: string; content: string; sort_order: number; }
interface GuideGlossary { id: string; term: string; definition: string; sort_order: number; }

interface LocationAlias { alias: string; street: string; town: string; }

const ROOM_TABS = [
  { key: "viewing", label: "Viewing" },
  { key: "negotiation", label: "Negotiation" },
  { key: "receipt", label: "Receipt" },
];

/* ---- Data Settings Sub-Tab ---- */
function DataSettingsTab({ password, callAdmin, toast: toastFn }: { password: () => string; callAdmin: (body: Record<string, unknown>) => Promise<any>; toast: any }) {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await callAdmin({ action: "get_settings", password: password() });
      if (res.success && res.data) {
        const map: Record<string, any> = {};
        for (const row of res.data) map[row.key] = row.value;
        setSettings(map);
      }
    } catch { toastFn({ title: "Failed to load settings", variant: "destructive" }); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadSettings(); }, []);

  const saveSetting = async (key: string, value: any) => {
    setSavingKey(key);
    try {
      const res = await callAdmin({ action: "upsert_setting", password: password(), key, value });
      if (res.success) { toastFn({ title: "Setting saved" }); await loadSettings(); }
      else toastFn({ title: res.error || "Save failed", variant: "destructive" });
    } catch { toastFn({ title: "Save failed", variant: "destructive" }); }
    finally { setSavingKey(null); }
  };

  const thresholdsBuy = settings.deal_thresholds_buy || { great: { maxRatio: 0.9, score: 90 }, good: { maxRatio: 0.97, score: 70 }, fair: { maxRatio: 1.05, score: 50 }, bad: { score: 20 } };
  const thresholdsRent = settings.deal_thresholds_rent || { great: { maxRatio: 0.9, score: 90 }, good: { maxRatio: 0.97, score: 70 }, fair: { maxRatio: 1.05, score: 50 }, bad: { score: 20 } };
  const aliases: LocationAlias[] = settings.location_aliases || [];
  const messages = settings.price_diff_messages || { buy_over: "", buy_under: "", rent_over: "", rent_under: "" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2"><Settings className="h-5 w-5" /> Data Settings</h2>
          <p className="text-sm text-muted-foreground">Manage deal scoring, location aliases, and messaging.</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadSettings} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <Tabs defaultValue="scoring">
        <TabsList>
          <TabsTrigger value="scoring">Deal Scoring</TabsTrigger>
          <TabsTrigger value="aliases">Location Aliases</TabsTrigger>
          <TabsTrigger value="messaging">Messaging</TabsTrigger>
        </TabsList>

        {/* Deal Scoring */}
        <TabsContent value="scoring" className="space-y-4">
          <p className="text-sm text-muted-foreground">Configure the ratio thresholds that determine deal ratings (offer ÷ median).</p>
          {[
            { label: "Buy Thresholds", key: "deal_thresholds_buy", data: thresholdsBuy },
            { label: "Rent Thresholds", key: "deal_thresholds_rent", data: thresholdsRent },
          ].map(({ label, key, data }) => (
            <ThresholdCard key={key} label={label} data={data} saving={savingKey === key} onSave={(val) => saveSetting(key, val)} />
          ))}
        </TabsContent>

        {/* Location Aliases */}
        <TabsContent value="aliases" className="space-y-4">
          <p className="text-sm text-muted-foreground">Map common building names to HDB street/town for search.</p>
          <AliasesEditor aliases={aliases} saving={savingKey === "location_aliases"} onSave={(val) => saveSetting("location_aliases", val)} />
        </TabsContent>

        {/* Messaging */}
        <TabsContent value="messaging" className="space-y-4">
          <p className="text-sm text-muted-foreground">Edit the text shown when comparing user's price to market median. Use <code className="bg-muted px-1 rounded text-xs">${"{amount}"}</code> as placeholder.</p>
          <MessagingEditor messages={messages} saving={savingKey === "price_diff_messages"} onSave={(val) => saveSetting("price_diff_messages", val)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ThresholdCard({ label, data, saving, onSave }: { label: string; data: any; saving: boolean; onSave: (val: any) => void }) {
  const [great, setGreat] = useState({ maxRatio: data.great?.maxRatio ?? 0.9, score: data.great?.score ?? 90 });
  const [good, setGood] = useState({ maxRatio: data.good?.maxRatio ?? 0.97, score: data.good?.score ?? 70 });
  const [fair, setFair] = useState({ maxRatio: data.fair?.maxRatio ?? 1.05, score: data.fair?.score ?? 50 });
  const [bad, setBad] = useState({ score: data.bad?.score ?? 20 });

  useEffect(() => {
    setGreat({ maxRatio: data.great?.maxRatio ?? 0.9, score: data.great?.score ?? 90 });
    setGood({ maxRatio: data.good?.maxRatio ?? 0.97, score: data.good?.score ?? 70 });
    setFair({ maxRatio: data.fair?.maxRatio ?? 1.05, score: data.fair?.score ?? 50 });
    setBad({ score: data.bad?.score ?? 20 });
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{label}</CardTitle>
          <Button size="sm" disabled={saving} onClick={() => onSave({ great, good, fair, bad })}>
            <Save className="h-3 w-3 mr-1" /> {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-4 text-sm">
          {[
            { name: "Great Deal", color: "text-green-600", ratio: great.maxRatio, score: great.score, setR: (v: number) => setGreat({ ...great, maxRatio: v }), setS: (v: number) => setGreat({ ...great, score: v }) },
            { name: "Good Deal", color: "text-emerald-600", ratio: good.maxRatio, score: good.score, setR: (v: number) => setGood({ ...good, maxRatio: v }), setS: (v: number) => setGood({ ...good, score: v }) },
            { name: "Fair Deal", color: "text-amber-600", ratio: fair.maxRatio, score: fair.score, setR: (v: number) => setFair({ ...fair, maxRatio: v }), setS: (v: number) => setFair({ ...fair, score: v }) },
            { name: "Bad Deal", color: "text-red-600", ratio: null, score: bad.score, setR: null, setS: (v: number) => setBad({ score: v }) },
          ].map((seg) => (
            <div key={seg.name} className="space-y-2">
              <Label className={`text-xs font-semibold ${seg.color}`}>{seg.name}</Label>
              {seg.ratio !== null && seg.setR && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Max Ratio (≤)</Label>
                  <Input type="number" step="0.01" value={seg.ratio} onChange={(e) => seg.setR!(parseFloat(e.target.value) || 0)} className="h-8 text-xs" />
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Score</Label>
                <Input type="number" value={seg.score} onChange={(e) => seg.setS(parseInt(e.target.value) || 0)} className="h-8 text-xs" />
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">Logic: if ratio ≤ great.maxRatio → Great, else if ≤ good.maxRatio → Good, else if ≤ fair.maxRatio → Fair, else → Bad.</p>
      </CardContent>
    </Card>
  );
}

function AliasesEditor({ aliases, saving, onSave }: { aliases: LocationAlias[]; saving: boolean; onSave: (val: LocationAlias[]) => void }) {
  const [items, setItems] = useState<LocationAlias[]>(aliases);
  useEffect(() => { setItems(aliases); }, [aliases]);

  const update = (idx: number, field: keyof LocationAlias, val: string) => {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  };

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Aliases ({items.length})</Label>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setItems([...items, { alias: "", street: "", town: "" }])}>
              <Plus className="h-3 w-3 mr-1" /> Add
            </Button>
            <Button size="sm" disabled={saving} onClick={() => onSave(items.filter((a) => a.alias.trim()))}>
              <Save className="h-3 w-3 mr-1" /> {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
        {items.map((alias, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Alias (search term)</Label>
              <Input value={alias.alias} onChange={(e) => update(i, "alias", e.target.value)} className="h-8 text-xs" placeholder="Pinnacle at Duxton" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Street</Label>
              <Input value={alias.street} onChange={(e) => update(i, "street", e.target.value)} className="h-8 text-xs" placeholder="CANTONMENT RD" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Town</Label>
              <Input value={alias.town} onChange={(e) => update(i, "town", e.target.value)} className="h-8 text-xs" placeholder="BUKIT MERAH" />
            </div>
            <Button size="sm" variant="destructive" className="h-8" onClick={() => setItems(items.filter((_, j) => j !== i))}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No aliases. Add one to map a building name to a street/town.</p>}
      </CardContent>
    </Card>
  );
}

function MessagingEditor({ messages, saving, onSave }: { messages: any; saving: boolean; onSave: (val: any) => void }) {
  const [msgs, setMsgs] = useState(messages);
  useEffect(() => { setMsgs(messages); }, [messages]);

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-end">
          <Button size="sm" disabled={saving} onClick={() => onSave(msgs)}>
            <Save className="h-3 w-3 mr-1" /> {saving ? "Saving..." : "Save"}
          </Button>
        </div>
        {[
          { key: "buy_over", label: "Buy — Over Market" },
          { key: "buy_under", label: "Buy — Under Market" },
          { key: "rent_over", label: "Rent — Over Market" },
          { key: "rent_under", label: "Rent — Under Market" },
        ].map(({ key, label }) => (
          <div key={key} className="space-y-1">
            <Label className="text-xs">{label}</Label>
            <Input value={msgs[key] || ""} onChange={(e) => setMsgs({ ...msgs, [key]: e.target.value })} className="text-sm" placeholder={`e.g. \${amount} over what you should be paying`} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function Admin() {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hotspots, setHotspots] = useState<RoomHotspot[]>([]);
  const [hotspotLoading, setHotspotLoading] = useState(false);
  const [roomImageData, setRoomImageData] = useState<Record<string, RoomImage>>({});
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [mode, setMode] = useState<"place" | "move">("place");
  const [mobileMode, setMobileMode] = useState(false);
  const [tactics, setTactics] = useState<GuideTactic[]>([]);
  const [regulations, setRegulations] = useState<GuideRegulation[]>([]);
  const [glossary, setGlossary] = useState<GuideGlossary[]>([]);
  const [guideLoading, setGuideLoading] = useState(false);
  const [heroSettings, setHeroSettings] = useState<{ background_image?: string; background_video?: string }>({});
  const [heroSaving, setHeroSaving] = useState(false);
  const canvasRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const { toast } = useToast();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const storedPassword = () => sessionStorage.getItem("admin_pw") || password;

  const callAdmin = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("admin-prompts", { body });
    if (error) throw error;
    return data;
  };

  const handleUnlock = async () => {
    setLoading(true);
    try {
      const res = await callAdmin({ action: "verify", password });
      if (res.verified) {
        sessionStorage.setItem("admin_pw", password);
        setAuthenticated(true);
        await Promise.all([loadHotspots(password), loadRoomImages(), loadGuideContent(password), loadHeroSettings()]);
      } else {
        toast({ title: "Invalid password", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to verify password", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadRoomImages = async () => {
    try {
      const res = await callAdmin({ action: "get_room_images", password: storedPassword() });
      if (res.success && res.data) {
        const map: Record<string, RoomImage> = {};
        for (const row of res.data) map[row.room_key] = { room_key: row.room_key, image_url: row.image_url, mobile_image_url: row.mobile_image_url || '', title: row.title || '', tactics_label: row.tactics_label || '' };
        setRoomImageData(map);
      }
    } catch { /* silent */ }
  };

  const loadHeroSettings = async () => {
    try {
      const res = await callAdmin({ action: "get_settings", password: storedPassword() });
      if (res.success && res.data) {
        const settings: Record<string, any> = {};
        for (const row of res.data) settings[row.key] = row.value;
        if (settings.hero_settings) {
          setHeroSettings(settings.hero_settings);
        }
      }
    } catch { /* silent */ }
  };

  const saveHeroSettings = async () => {
    setHeroSaving(true);
    try {
      const res = await callAdmin({ action: "upsert_setting", password: storedPassword(), key: "hero_settings", value: heroSettings });
      if (res.success) toast({ title: "Hero settings saved" });
      else toast({ title: res.error || "Save failed", variant: "destructive" });
    } catch { toast({ title: "Save failed", variant: "destructive" }); }
    finally { setHeroSaving(false); }
  };

  const uploadHeroMedia = async (file: File, type: "image" | "video") => {
    const ext = file.name.split(".").pop() || (type === "video" ? "mp4" : "jpg");
    const path = `hero-${type}.${ext}`;
    await supabase.storage.from("room-images").remove([path]);
    const { error: uploadError } = await supabase.storage.from("room-images").upload(path, file, { upsert: true });
    if (uploadError) { toast({ title: "Upload failed: " + uploadError.message, variant: "destructive" }); return; }
    const { data: urlData } = supabase.storage.from("room-images").getPublicUrl(path);
    const publicUrl = urlData.publicUrl + "?t=" + Date.now();
    if (type === "video") {
      setHeroSettings((prev) => ({ ...prev, background_video: publicUrl }));
    } else {
      setHeroSettings((prev) => ({ ...prev, background_image: publicUrl }));
    }
    toast({ title: `Hero ${type} uploaded` });
  };

  const uploadRoomImage = async (roomKey: string, file: File, isMobile = false) => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = isMobile ? `mobile-${roomKey}.${ext}` : `${roomKey}.${ext}`;
    await supabase.storage.from("room-images").remove([path]);
    const { error: uploadError } = await supabase.storage.from("room-images").upload(path, file, { upsert: true });
    if (uploadError) { toast({ title: "Upload failed: " + uploadError.message, variant: "destructive" }); return; }
    const { data: urlData } = supabase.storage.from("room-images").getPublicUrl(path);
    const publicUrl = urlData.publicUrl;
    if (isMobile) {
      await callAdmin({ action: "upsert_room_image", password: storedPassword(), room_key: roomKey, mobile_image_url: publicUrl });
      setRoomImageData((prev) => ({ ...prev, [roomKey]: { ...prev[roomKey], room_key: roomKey, mobile_image_url: publicUrl + "?t=" + Date.now() } }));
    } else {
      await callAdmin({ action: "upsert_room_image", password: storedPassword(), room_key: roomKey, image_url: publicUrl });
      setRoomImageData((prev) => ({ ...prev, [roomKey]: { ...prev[roomKey], room_key: roomKey, image_url: publicUrl + "?t=" + Date.now() } }));
    }
    toast({ title: `${isMobile ? "Mobile image" : "Image"} uploaded & saved` });
  };

  const loadHotspots = async (pw?: string) => {
    setHotspotLoading(true);
    try {
      const res = await callAdmin({ action: "list_hotspots", password: pw || storedPassword() });
      if (res.success) setHotspots(res.data);
    } catch { toast({ title: "Failed to load hotspots", variant: "destructive" }); }
    finally { setHotspotLoading(false); }
  };

  const saveHotspot = async (h: Partial<RoomHotspot> & { room_key: string }) => {
    try {
      const res = await callAdmin({ action: "upsert_hotspot", password: storedPassword(), ...h });
      if (res.success) { toast({ title: "Hotspot saved" }); await loadHotspots(); }
      else toast({ title: res.error || "Save failed", variant: "destructive" });
    } catch { toast({ title: "Save failed", variant: "destructive" }); }
  };

  const deleteHotspot = async (id: string) => {
    try {
      const res = await callAdmin({ action: "delete_hotspot", password: storedPassword(), id });
      if (res.success) { toast({ title: "Hotspot deleted" }); if (selectedHotspotId === id) setSelectedHotspotId(null); await loadHotspots(); }
      else toast({ title: res.error || "Delete failed", variant: "destructive" });
    } catch { toast({ title: "Delete failed", variant: "destructive" }); }
  };

  const handleCanvasClick = (roomKey: string, xPercent: number, yPercent: number) => {
    if (mobileMode) {
      // In mobile mode: move sets mobile coords, place is not used (we don't create new hotspots from mobile canvas)
      if (mode === "move" && selectedHotspotId) {
        const h = hotspots.find((h) => h.id === selectedHotspotId);
        if (h) saveHotspot({ id: h.id, room_key: h.room_key, mobile_x_percent: xPercent, mobile_y_percent: yPercent, title: h.title, description: h.description, sort_order: h.sort_order });
      } else if (selectedHotspotId) {
        // If a hotspot is selected in place mode on mobile canvas, set its mobile position
        const h = hotspots.find((h) => h.id === selectedHotspotId);
        if (h) saveHotspot({ id: h.id, room_key: h.room_key, mobile_x_percent: xPercent, mobile_y_percent: yPercent, title: h.title, description: h.description, sort_order: h.sort_order });
      }
    } else {
      if (mode === "move" && selectedHotspotId) {
        const h = hotspots.find((h) => h.id === selectedHotspotId);
        if (h) saveHotspot({ id: h.id, room_key: h.room_key, x_percent: xPercent, y_percent: yPercent, title: h.title, description: h.description, sort_order: h.sort_order });
      } else {
        const order = hotspots.filter((h) => h.room_key === roomKey).length;
        saveHotspot({ room_key: roomKey, x_percent: xPercent, y_percent: yPercent, title: "New hotspot", description: "", sort_order: order });
      }
    }
  };

  const scrollToHotspot = (hotspot: RoomHotspot) => {
    setSelectedHotspotId(hotspot.id);
    const canvas = canvasRefs.current[hotspot.room_key];
    if (canvas) canvas.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // Guide content
  const loadGuideContent = async (pw?: string) => {
    setGuideLoading(true);
    try {
      const res = await callAdmin({ action: "get_guide_content", password: pw || storedPassword() });
      if (res.success) {
        setTactics(res.tactics || []);
        setRegulations(res.regulations || []);
        setGlossary(res.glossary || []);
      }
    } catch { toast({ title: "Failed to load guide content", variant: "destructive" }); }
    finally { setGuideLoading(false); }
  };

  const saveTactic = async (t: Partial<GuideTactic> & { phase: string }) => {
    try {
      const res = await callAdmin({ action: "upsert_tactic", password: storedPassword(), ...t });
      if (res.success) { toast({ title: "Tactic saved" }); await loadGuideContent(); }
      else toast({ title: res.error || "Save failed", variant: "destructive" });
    } catch { toast({ title: "Save failed", variant: "destructive" }); }
  };

  const deleteTactic = async (id: string) => {
    try {
      const res = await callAdmin({ action: "delete_tactic", password: storedPassword(), id });
      if (res.success) { toast({ title: "Tactic deleted" }); await loadGuideContent(); }
      else toast({ title: res.error || "Delete failed", variant: "destructive" });
    } catch { toast({ title: "Delete failed", variant: "destructive" }); }
  };

  const saveRegulation = async (r: Partial<GuideRegulation> & { title: string }) => {
    try {
      const res = await callAdmin({ action: "upsert_regulation", password: storedPassword(), ...r });
      if (res.success) { toast({ title: "Regulation saved" }); await loadGuideContent(); }
      else toast({ title: res.error || "Save failed", variant: "destructive" });
    } catch { toast({ title: "Save failed", variant: "destructive" }); }
  };

  const deleteRegulation = async (id: string) => {
    try {
      const res = await callAdmin({ action: "delete_regulation", password: storedPassword(), id });
      if (res.success) { toast({ title: "Regulation deleted" }); await loadGuideContent(); }
      else toast({ title: res.error || "Delete failed", variant: "destructive" });
    } catch { toast({ title: "Delete failed", variant: "destructive" }); }
  };

  const saveGlossaryItem = async (g: Partial<GuideGlossary> & { term: string }) => {
    try {
      const res = await callAdmin({ action: "upsert_glossary", password: storedPassword(), ...g });
      if (res.success) { toast({ title: "Glossary item saved" }); await loadGuideContent(); }
      else toast({ title: res.error || "Save failed", variant: "destructive" });
    } catch { toast({ title: "Save failed", variant: "destructive" }); }
  };

  const deleteGlossaryItem = async (id: string) => {
    try {
      const res = await callAdmin({ action: "delete_glossary", password: storedPassword(), id });
      if (res.success) { toast({ title: "Glossary item deleted" }); await loadGuideContent(); }
      else toast({ title: res.error || "Delete failed", variant: "destructive" });
    } catch { toast({ title: "Delete failed", variant: "destructive" }); }
  };

  const hotspotCardRefs = useRef<Map<string, () => Promise<void>>>(new Map());

  const registerHotspotSave = useCallback((id: string, saveFn: () => Promise<void>) => {
    hotspotCardRefs.current.set(id, saveFn);
  }, []);

  const unregisterHotspotSave = useCallback((id: string) => {
    hotspotCardRefs.current.delete(id);
  }, []);

  const saveAllAndReturn = async () => {
    setSaving(true);
    try {
      const saveFns = Array.from(hotspotCardRefs.current.values());
      await Promise.all(saveFns.map((fn) => fn()));
      toast({ title: "All changes saved" });
      navigate("/");
    } catch {
      toast({ title: "Some saves failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const pw = sessionStorage.getItem("admin_pw");
    if (pw) {
      setPassword(pw);
      setAuthenticated(true);
      loadHotspots(pw);
      loadRoomImages();
      loadGuideContent(pw);
      loadHeroSettings();
    }
  }, []);

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Lock className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
            <CardTitle>Admin Access</CardTitle>
            <CardDescription>Enter the admin password to manage content</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleUnlock()} />
            <Button className="w-full" onClick={handleUnlock} disabled={loading || !password}>{loading ? "Verifying..." : "Unlock"}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Admin CMS</h1>
          <Button onClick={saveAllAndReturn} disabled={saving} variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {saving ? "Saving..." : "Save & Return Home"}
          </Button>
        </div>
        <Tabs defaultValue="home" className="w-full">
          <TabsList className="w-full justify-start h-12 bg-muted/50 p-1 rounded-lg">
            <TabsTrigger value="home" className="text-sm px-5 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">Home Page</TabsTrigger>
            <TabsTrigger value="tool" className="text-sm px-5 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">Tool</TabsTrigger>
            <TabsTrigger value="guide" className="text-sm px-5 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">Guide</TabsTrigger>
            <TabsTrigger value="settings" className="text-sm px-5 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">Data Settings</TabsTrigger>
          </TabsList>

          {/* Home Page Tab — Hero Settings & Room Hotspots */}
          <TabsContent value="home" className="space-y-6 mt-6">
            {/* Hero Settings Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Video className="h-5 w-5" /> Hero Section
                </CardTitle>
                <CardDescription>Configure the hero greeting section background image or looping video.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Image className="h-4 w-4" /> Background Image
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={heroSettings.background_image || ""}
                        onChange={(e) => setHeroSettings((prev) => ({ ...prev, background_image: e.target.value }))}
                        placeholder="Image URL or upload"
                        className="flex-1"
                      />
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadHeroMedia(file, "image");
                            e.target.value = "";
                          }}
                        />
                        <Button variant="outline" size="icon">
                          <Upload className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {heroSettings.background_image && (
                      <div className="relative">
                        <img src={heroSettings.background_image} alt="Hero preview" className="w-full h-32 object-cover rounded border" />
                        <Button
                          size="sm"
                          variant="destructive"
                          className="absolute top-2 right-2"
                          onClick={() => setHeroSettings((prev) => ({ ...prev, background_image: undefined }))}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Video className="h-4 w-4" /> Background Video (loops)
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={heroSettings.background_video || ""}
                        onChange={(e) => setHeroSettings((prev) => ({ ...prev, background_video: e.target.value }))}
                        placeholder="Video URL or upload (MP4)"
                        className="flex-1"
                      />
                      <div className="relative">
                        <input
                          type="file"
                          accept="video/mp4,video/webm"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadHeroMedia(file, "video");
                            e.target.value = "";
                          }}
                        />
                        <Button variant="outline" size="icon">
                          <Upload className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {heroSettings.background_video && (
                      <div className="relative">
                        <video src={heroSettings.background_video} className="w-full h-32 object-cover rounded border" muted loop />
                        <Button
                          size="sm"
                          variant="destructive"
                          className="absolute top-2 right-2"
                          onClick={() => setHeroSettings((prev) => ({ ...prev, background_video: undefined }))}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Video takes priority over image if both are set. Leave both empty for solid background color.</p>
                <Button onClick={saveHeroSettings} disabled={heroSaving}>
                  <Save className="h-4 w-4 mr-2" /> {heroSaving ? "Saving..." : "Save Hero Settings"}
                </Button>
              </CardContent>
            </Card>

            {/* Room Hotspots Section */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Room Hotspots</h2>
                <p className="text-sm text-muted-foreground">Upload an image, then click on it to place hotspots.</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                  <Switch checked={mobileMode} onCheckedChange={setMobileMode} />
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">{mobileMode ? "Mobile" : "Desktop"}</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => loadHotspots()} disabled={hotspotLoading}>
                  <RefreshCw className={`h-4 w-4 mr-1 ${hotspotLoading ? "animate-spin" : ""}`} /> Refresh
                </Button>
              </div>
            </div>
            <Tabs defaultValue="viewing">
              <TabsList>
                {ROOM_TABS.map((t) => (<TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>))}
              </TabsList>
              {ROOM_TABS.map((tab) => {
                const roomHots = hotspots.filter((h) => h.room_key === tab.key);
                const rd = roomImageData[tab.key];
                const canvasImage = mobileMode ? (rd?.mobile_image_url || undefined) : (rd?.image_url || undefined);
                return (
                  <TabsContent key={tab.key} value={tab.key} className="space-y-4">
                    {!mobileMode && (
                      <Card>
                        <CardContent className="pt-4 space-y-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Room Title (shown on homepage)</Label>
                            <Input
                              value={rd?.title ?? ''}
                              onChange={(e) => setRoomImageData((prev) => ({ ...prev, [tab.key]: { ...prev[tab.key], room_key: tab.key, image_url: prev[tab.key]?.image_url || '', mobile_image_url: prev[tab.key]?.mobile_image_url || '', title: e.target.value, tactics_label: prev[tab.key]?.tactics_label || '' } }))}
                              placeholder={`e.g. The ${tab.label} Room`}
                            />
                          </div>
                          <Button size="sm" onClick={async () => {
                            const data = roomImageData[tab.key];
                            if (data) {
                              await callAdmin({ action: "upsert_room_image", password: storedPassword(), room_key: tab.key, title: data.title, image_url: data.image_url || '' });
                              toast({ title: "Room title saved" });
                            }
                          }}>
                            <Save className="h-3 w-3 mr-1" /> Save Room Title
                          </Button>
                        </CardContent>
                      </Card>
                    )}
                    <RoomImageCanvas
                      roomKey={tab.key} imageUrl={canvasImage} hotspots={roomHots} selectedId={selectedHotspotId}
                      mode={mobileMode ? "move" : mode} onModeChange={setMode} onSelectHotspot={setSelectedHotspotId}
                      onCanvasClick={handleCanvasClick} onUpload={(rk, file) => uploadRoomImage(rk, file, mobileMode)}
                      canvasRef={(el) => { canvasRefs.current[tab.key] = el; }}
                      isMobileMode={mobileMode}
                    />
                    {roomHots.map((h) => (
                      <HotspotDetailCard key={h.id} hotspot={h} selected={selectedHotspotId === h.id}
                        onSelect={() => setSelectedHotspotId(h.id)} onPreview={() => scrollToHotspot(h)}
                        onSave={saveHotspot} onDelete={deleteHotspot}
                        registerSave={registerHotspotSave} unregisterSave={unregisterHotspotSave}
                        isMobileMode={mobileMode}
                      />
                    ))}
                  </TabsContent>
                );
              })}
            </Tabs>
          </TabsContent>

          {/* Tool Tab — Placeholder */}
          <TabsContent value="tool" className="mt-6">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-lg font-medium text-muted-foreground">Tool content management</p>
                <p className="text-sm text-muted-foreground mt-1">Coming soon — settings for fair price and rent calculations will appear here.</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Guide Tab */}
          <TabsContent value="guide" className="space-y-6 mt-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2"><BookOpen className="h-5 w-5" /> Guide Content</h2>
                <p className="text-sm text-muted-foreground">Manage the Buyer's Guide — tactics, regulations, and glossary.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => loadGuideContent()} disabled={guideLoading}>
                <RefreshCw className={`h-4 w-4 mr-1 ${guideLoading ? "animate-spin" : ""}`} /> Refresh
              </Button>
            </div>
            <Tabs defaultValue="tactics">
              <TabsList>
                <TabsTrigger value="tactics">Psychological Tactics</TabsTrigger>
                <TabsTrigger value="regulations">Regulations</TabsTrigger>
                <TabsTrigger value="glossary">Glossary</TabsTrigger>
              </TabsList>
              <TabsContent value="tactics" className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">FAQ items shown under each phase on the Guide page.</p>
                  <Button size="sm" onClick={() => saveTactic({ phase: "viewing", question: "New tactic", answer: "", sort_order: tactics.length })}>
                    <Plus className="h-3 w-3 mr-1" /> Add Tactic
                  </Button>
                </div>
                {["viewing", "negotiation", "receipt"].map((phase) => {
                  const phaseTactics = tactics.filter((t) => t.phase === phase);
                  if (phaseTactics.length === 0) return null;
                  return (
                    <div key={phase} className="space-y-3">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{phase}</h3>
                      {phaseTactics.map((t) => (<TacticCard key={t.id} tactic={t} onSave={saveTactic} onDelete={deleteTactic} />))}
                    </div>
                  );
                })}
                {tactics.length === 0 && !guideLoading && <p className="text-center text-muted-foreground py-8">No tactics yet. Click "Add Tactic" to create one.</p>}
              </TabsContent>
              <TabsContent value="regulations" className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Collapsible regulation cards on the Guide page.</p>
                  <Button size="sm" onClick={() => saveRegulation({ title: "New Regulation", content: "", sort_order: regulations.length })}>
                    <Plus className="h-3 w-3 mr-1" /> Add Regulation
                  </Button>
                </div>
                {regulations.map((r) => (<RegulationCard key={r.id} regulation={r} onSave={saveRegulation} onDelete={deleteRegulation} />))}
                {regulations.length === 0 && !guideLoading && <p className="text-center text-muted-foreground py-8">No regulations yet.</p>}
              </TabsContent>
              <TabsContent value="glossary" className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Term definitions shown in the glossary grid.</p>
                  <Button size="sm" onClick={() => saveGlossaryItem({ term: "NEW", definition: "", sort_order: glossary.length })}>
                    <Plus className="h-3 w-3 mr-1" /> Add Term
                  </Button>
                </div>
                {glossary.map((g) => (<GlossaryCard key={g.id} item={g} onSave={saveGlossaryItem} onDelete={deleteGlossaryItem} />))}
                {glossary.length === 0 && !guideLoading && <p className="text-center text-muted-foreground py-8">No glossary items yet.</p>}
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Data Settings Tab */}
          <TabsContent value="settings" className="mt-6">
            <DataSettingsTab password={storedPassword} callAdmin={callAdmin} toast={toast} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/* ---- Visual Canvas ---- */
function RoomImageCanvas({
  roomKey, imageUrl, hotspots, selectedId, mode, onModeChange, onSelectHotspot, onCanvasClick, onUpload, canvasRef, isMobileMode = false,
}: {
  roomKey: string; imageUrl?: string; hotspots: RoomHotspot[]; selectedId: string | null;
  mode: "place" | "move"; onModeChange: (m: "place" | "move") => void;
  onSelectHotspot: (id: string | null) => void; onCanvasClick: (roomKey: string, x: number, y: number) => void;
  onUpload: (roomKey: string, file: File) => void; canvasRef: (el: HTMLDivElement | null) => void;
  isMobileMode?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
      const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
      onCanvasClick(roomKey, x, y);
    },
    [roomKey, onCanvasClick],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUpload(roomKey, file);
    e.target.value = "";
  };

  const setRefs = useCallback((el: HTMLDivElement | null) => {
    (containerRef as any).current = el;
    canvasRef(el);
  }, [canvasRef]);

  if (!imageUrl) {
    return (
      <div className="space-y-2">
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center py-20 cursor-pointer hover:border-primary/50 transition-colors">
          <Upload className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground font-medium">Click to upload room image</p>
          <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {!isMobileMode && (
          <>
            <Button size="sm" variant={mode === "place" ? "default" : "outline"} onClick={() => onModeChange("place")}>
              <MousePointer className="h-3 w-3 mr-1" /> Place
            </Button>
            <Button size="sm" variant={mode === "move" ? "default" : "outline"} onClick={() => { onModeChange("move"); if (!selectedId && hotspots.length > 0) onSelectHotspot(hotspots[0].id); }}>
              <Move className="h-3 w-3 mr-1" /> Move
            </Button>
          </>
        )}
        {isMobileMode && (
          <p className="text-xs text-muted-foreground">Select a hotspot below, then click image to set its mobile position.</p>
        )}
        <div className="flex-1" />
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-3 w-3 mr-1" /> {isMobileMode ? "Upload Mobile Image" : "Replace Image"}
        </Button>
      </div>
      <div ref={setRefs} className="relative w-full rounded-lg overflow-hidden border border-border cursor-crosshair select-none" onClick={handleImageClick}>
        <img src={imageUrl} alt={`${roomKey} room`} className="w-full block" draggable={false} />
        {hotspots.map((h, i) => {
          const posX = isMobileMode ? (h.mobile_x_percent ?? h.x_percent) : h.x_percent;
          const posY = isMobileMode ? (h.mobile_y_percent ?? h.y_percent) : h.y_percent;
          const hasMobilePos = h.mobile_x_percent != null && h.mobile_y_percent != null;
          return (
            <button
              key={h.id}
              className={`absolute w-7 h-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-all ${
                selectedId === h.id
                  ? "bg-primary text-primary-foreground border-primary scale-125 z-20"
                  : isMobileMode && !hasMobilePos
                    ? "bg-muted text-muted-foreground border-dashed border-muted-foreground/40 z-10"
                    : "bg-background/90 text-foreground border-primary/60 hover:scale-110 z-10"
              }`}
              style={{ left: `${posX}%`, top: `${posY}%` }}
              onClick={(e) => { e.stopPropagation(); onSelectHotspot(selectedId === h.id ? null : h.id); }}
              title={h.title}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {isMobileMode
          ? "Click on the image to set the mobile position for the selected hotspot."
          : mode === "place" ? "Click on the image to place a new hotspot." : "Click on the image to move the selected hotspot."}
      </p>
    </div>
  );
}

/* ---- Hotspot Detail Card ---- */
function HotspotDetailCard({
  hotspot, selected, onSelect, onPreview, onSave, onDelete, registerSave, unregisterSave, isMobileMode = false,
}: {
  hotspot: RoomHotspot; selected: boolean;
  onSelect: () => void; onPreview: () => void;
  onSave: (h: Partial<RoomHotspot> & { room_key: string }) => void; onDelete: (id: string) => void;
  registerSave: (id: string, saveFn: () => Promise<void>) => void;
  unregisterSave: (id: string) => void;
  isMobileMode?: boolean;
}) {
  const [title, setTitle] = useState(hotspot.title);
  const [desc, setDesc] = useState(hotspot.description);
  const [order, setOrder] = useState(String(hotspot.sort_order));
  const [tacticsLabel, setTacticsLabel] = useState(hotspot.tactics_label || '');

  useEffect(() => { setTitle(hotspot.title); setDesc(hotspot.description); setOrder(String(hotspot.sort_order)); setTacticsLabel(hotspot.tactics_label || ''); }, [hotspot]);

  const dirty = title !== hotspot.title || desc !== hotspot.description || order !== String(hotspot.sort_order) || tacticsLabel !== (hotspot.tactics_label || '');

  useEffect(() => {
    registerSave(hotspot.id, async () => {
      if (dirty) {
        onSave({ id: hotspot.id, room_key: hotspot.room_key, title, description: desc, sort_order: Number(order), x_percent: hotspot.x_percent, y_percent: hotspot.y_percent, tactics_label: tacticsLabel });
      }
    });
    return () => unregisterSave(hotspot.id);
  }, [hotspot, title, desc, order, tacticsLabel, registerSave, unregisterSave, onSave]);

  return (
    <Card className={`cursor-pointer transition-all ${selected ? "ring-2 ring-primary" : "hover:ring-1 hover:ring-primary/40"}`} onClick={onSelect}>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-sm font-medium text-muted-foreground">
              <Monitor className="inline h-3 w-3 mr-1" />
              Desktop: {Math.round(hotspot.x_percent)}% × {Math.round(hotspot.y_percent)}%
            </span>
            <br />
            <span className="text-xs text-muted-foreground">
              <Smartphone className="inline h-3 w-3 mr-1" />
              Mobile: {hotspot.mobile_x_percent != null ? `${Math.round(hotspot.mobile_x_percent)}% × ${Math.round(hotspot.mobile_y_percent!)}%` : "Not set"}
            </span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onPreview(); }} title="Preview on image">
              <Eye className="h-3 w-3" />
            </Button>
            <Button size="sm" disabled={!dirty} onClick={(e) => {
              e.stopPropagation();
              onSave({ id: hotspot.id, room_key: hotspot.room_key, title, description: desc, sort_order: Number(order), x_percent: hotspot.x_percent, y_percent: hotspot.y_percent, tactics_label: tacticsLabel });
            }}>
              <Save className="h-3 w-3 mr-1" /> Save
            </Button>
            <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); onDelete(hotspot.id); }}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-3 space-y-1">
            <Label className="text-xs">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} onClick={(e) => e.stopPropagation()} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Display Order</Label>
            <Input type="number" value={order} onChange={(e) => setOrder(e.target.value)} onClick={(e) => e.stopPropagation()} />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Description</Label>
          <Textarea className="min-h-[80px] text-sm" value={desc} onChange={(e) => setDesc(e.target.value)} onClick={(e) => e.stopPropagation()} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Tactics Link Text</Label>
          <Input value={tacticsLabel} onChange={(e) => setTacticsLabel(e.target.value)} onClick={(e) => e.stopPropagation()} placeholder="Click for a full list of psychological tactics used during..." />
        </div>
      </CardContent>
    </Card>
  );
}

/* ---- Tactic Card ---- */
function TacticCard({ tactic, onSave, onDelete }: {
  tactic: GuideTactic; onSave: (t: Partial<GuideTactic> & { phase: string }) => void; onDelete: (id: string) => void;
}) {
  const [phase, setPhase] = useState(tactic.phase);
  const [question, setQuestion] = useState(tactic.question);
  const [answer, setAnswer] = useState(tactic.answer);
  const [order, setOrder] = useState(String(tactic.sort_order));

  useEffect(() => { setPhase(tactic.phase); setQuestion(tactic.question); setAnswer(tactic.answer); setOrder(String(tactic.sort_order)); }, [tactic]);

  const dirty = phase !== tactic.phase || question !== tactic.question || answer !== tactic.answer || order !== String(tactic.sort_order);

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Select value={phase} onValueChange={setPhase}>
              <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="viewing">Viewing</SelectItem>
                <SelectItem value="negotiation">Negotiation</SelectItem>
                <SelectItem value="receipt">Receipt</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Label className="text-xs">Order</Label>
              <Input type="number" className="w-16 h-8 text-xs" value={order} onChange={(e) => setOrder(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={!dirty} onClick={() => onSave({ id: tactic.id, phase, question, answer, sort_order: Number(order) })}>
              <Save className="h-3 w-3 mr-1" /> Save
            </Button>
            <Button size="sm" variant="destructive" onClick={() => onDelete(tactic.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Question / Tactic</Label>
          <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. Artificial scarcity — 'Many people are viewing this unit'" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Answer / Explanation</Label>
          <Textarea className="min-h-[80px] text-sm" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Explain what this tactic means and how to handle it..." />
        </div>
      </CardContent>
    </Card>
  );
}

/* ---- Regulation Card ---- */
function RegulationCard({ regulation, onSave, onDelete }: {
  regulation: GuideRegulation; onSave: (r: Partial<GuideRegulation> & { title: string }) => void; onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState(regulation.title);
  const [content, setContent] = useState(regulation.content);
  const [order, setOrder] = useState(String(regulation.sort_order));

  useEffect(() => { setTitle(regulation.title); setContent(regulation.content); setOrder(String(regulation.sort_order)); }, [regulation]);

  const dirty = title !== regulation.title || content !== regulation.content || order !== String(regulation.sort_order);

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Order</Label>
            <Input type="number" className="w-16 h-8 text-xs" value={order} onChange={(e) => setOrder(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={!dirty} onClick={() => onSave({ id: regulation.id, title, content, sort_order: Number(order) })}>
              <Save className="h-3 w-3 mr-1" /> Save
            </Button>
            <Button size="sm" variant="destructive" onClick={() => onDelete(regulation.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Content (plain text, supports line breaks)</Label>
          <Textarea className="min-h-[120px] text-sm" value={content} onChange={(e) => setContent(e.target.value)} />
        </div>
      </CardContent>
    </Card>
  );
}

/* ---- Glossary Card ---- */
function GlossaryCard({ item, onSave, onDelete }: {
  item: GuideGlossary; onSave: (g: Partial<GuideGlossary> & { term: string }) => void; onDelete: (id: string) => void;
}) {
  const [term, setTerm] = useState(item.term);
  const [definition, setDefinition] = useState(item.definition);
  const [order, setOrder] = useState(String(item.sort_order));

  useEffect(() => { setTerm(item.term); setDefinition(item.definition); setOrder(String(item.sort_order)); }, [item]);

  const dirty = term !== item.term || definition !== item.definition || order !== String(item.sort_order);

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Order</Label>
            <Input type="number" className="w-16 h-8 text-xs" value={order} onChange={(e) => setOrder(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={!dirty} onClick={() => onSave({ id: item.id, term, definition, sort_order: Number(order) })}>
              <Save className="h-3 w-3 mr-1" /> Save
            </Button>
            <Button size="sm" variant="destructive" onClick={() => onDelete(item.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Term</Label>
          <Input value={term} onChange={(e) => setTerm(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Definition</Label>
          <Textarea className="min-h-[80px] text-sm" value={definition} onChange={(e) => setDefinition(e.target.value)} />
        </div>
      </CardContent>
    </Card>
  );
}
