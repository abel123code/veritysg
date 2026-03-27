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

export default function Index() {
  const [hotspots, setHotspots] = useState<Record<string, Hotspot[]>>({});
  const [roomMeta, setRoomMeta] = useState<Record<string, RoomMeta>>({});

  useEffect(() => {
    // Fetch hotspots
    supabase
      .from("room_hotspots" as any)
      .select("*")
      .order("sort_order")
      .then(({ data }) => {
        if (!data) return;
        const grouped: Record<string, Hotspot[]> = {};
        for (const row of data as any[]) {
          const key = row.room_key as string;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(row as Hotspot);
        }
        setHotspots(grouped);
      });

    // Fetch room images/meta
    supabase
      .from("room_images" as any)
      .select("*")
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, RoomMeta> = {};
        for (const row of data as any[]) {
          map[row.room_key as string] = {
            image_url: row.image_url as string,
            mobile_image_url: (row as any).mobile_image_url as string,
            title: row.title as string,
            tactics_label: row.tactics_label as string,
          };
        }
        setRoomMeta(map);
      });
  }, []);

  return (
    <main>
      <HeroGreeting />
      {ROOMS.map((room) => {
        const meta = roomMeta[room.key];
        return (
          <RoomExperience
            key={room.key}
            title={meta?.title || room.title}
            imageUrl={meta?.image_url || STATIC_IMAGES[room.key]}
            mobileImageUrl={meta?.mobile_image_url || undefined}
            hotspots={hotspots[room.key] ?? []}
          />
        );
      })}
    </main>
  );
}
