import { useEffect, useState } from "react";
import HeroGreeting from "@/components/HeroGreeting";
import RoomExperience, { type Hotspot } from "@/components/RoomExperience";
import { supabase } from "@/integrations/supabase/client";
import roomViewing from "@/assets/room-viewing.jpg";
import roomNegotiation from "@/assets/room-negotiation.jpg";
import roomReceipt from "@/assets/room-receipt.jpg";

const STATIC_IMAGES: Record<string, string> = {
  viewing: roomViewing,
  negotiation: roomNegotiation,
  receipt: roomReceipt,
};

const ROOMS = [
  { key: "viewing", title: "The Viewing Room" },
  { key: "negotiation", title: "The Negotiation Room" },
  { key: "receipt", title: "The Receipt Room" },
];

interface RoomMeta { image_url?: string; mobile_image_url?: string; title?: string; tactics_label?: string; }
interface HeroSettings { background_image?: string; background_video?: string; display_mode?: "video" | "image" | "none"; }

export default function Index() {
  const [hotspots, setHotspots] = useState<Record<string, Hotspot[]>>({});
  const [roomMeta, setRoomMeta] = useState<Record<string, RoomMeta>>({});
  const [heroSettings, setHeroSettings] = useState<HeroSettings>({});
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      // Fetch all data in parallel
      const [hotspotsRes, roomImagesRes, settingsRes] = await Promise.all([
        supabase.from("room_hotspots" as any).select("*").order("sort_order"),
        supabase.from("room_images" as any).select("*"),
        supabase.functions.invoke("admin-prompts", { body: { action: "get_public_settings" } }),
      ]);

      // Process hotspots
      if (hotspotsRes.data) {
        const grouped: Record<string, Hotspot[]> = {};
        for (const row of hotspotsRes.data as any[]) {
          const key = row.room_key as string;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(row as Hotspot);
        }
        setHotspots(grouped);
      }

      // Process room images
      if (roomImagesRes.data) {
        const map: Record<string, RoomMeta> = {};
        for (const row of roomImagesRes.data as any[]) {
          map[row.room_key as string] = {
            image_url: row.image_url as string,
            mobile_image_url: (row as any).mobile_image_url as string,
            title: row.title as string,
            tactics_label: row.tactics_label as string,
          };
        }
        setRoomMeta(map);
      }

      // Process hero settings
      if (settingsRes.data?.success && settingsRes.data?.data) {
        const settings: Record<string, any> = {};
        for (const row of settingsRes.data.data) settings[row.key] = row.value;
        if (settings.hero_settings) {
          setHeroSettings(settings.hero_settings);
        }
      }

      setDataLoaded(true);
    };

    loadData();
  }, []);

  // Compute final image URLs - prioritize CMS images, fallback to static assets
  const getRoomImage = (roomKey: string) => {
    const meta = roomMeta[roomKey];
    // Use CMS image if available (has actual URL)
    if (meta?.image_url && meta.image_url.trim() !== "") {
      return meta.image_url;
    }
    // Fallback to static bundled images
    return STATIC_IMAGES[roomKey];
  };

  // Mobile images disabled - always use same image for all screen sizes
  // To re-enable separate mobile images, restore this function
  const getMobileImage = (_roomKey: string) => {
    return undefined;
  };

  return (
    <main>
      <HeroGreeting
        backgroundImage={heroSettings.background_image}
        backgroundVideo={heroSettings.background_video}
        displayMode={heroSettings.display_mode}
      />
      {ROOMS.map((room) => {
        const meta = roomMeta[room.key];
        return (
          <RoomExperience
            key={room.key}
            title={meta?.title || room.title}
            imageUrl={getRoomImage(room.key)}
            mobileImageUrl={getMobileImage(room.key)}
            hotspots={hotspots[room.key] ?? []}
          />
        );
      })}
    </main>
  );
}
