import { GooeyText } from "@/components/ui/gooey-text-morphing";
import { ChevronDown } from "lucide-react";
import { motion } from "framer-motion";

const greetings = [
  "Hello",
  "你好",
  "Selamat",
  "வணக்கம்",
  "Bonjour",
  "Hola",
  "Kamusta",
  "안녕",
];

interface HeroGreetingProps {
  backgroundImage?: string;
  backgroundVideo?: string;
}

export default function HeroGreeting({ backgroundImage, backgroundVideo }: HeroGreetingProps) {
  const scrollDown = () => {
    window.scrollTo({ top: window.innerHeight, behavior: "smooth" });
  };

  const hasMedia = backgroundImage || backgroundVideo;

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center bg-primary text-primary-foreground overflow-hidden">
      {backgroundVideo && (
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src={backgroundVideo} type="video/mp4" />
        </video>
      )}
      {backgroundImage && !backgroundVideo && (
        <img
          src={backgroundImage}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      {hasMedia && <div className="absolute inset-0 bg-black/40" />}
      
      <GooeyText
        texts={greetings}
        morphTime={1.5}
        cooldownTime={1}
        className="relative z-10 h-32 w-full max-w-4xl flex items-center justify-center"
        textClassName="text-7xl md:text-9xl font-bold tracking-tight drop-shadow-lg"
      />

      <motion.button
        onClick={scrollDown}
        className="absolute bottom-12 z-10 text-primary-foreground/60 hover:text-primary-foreground transition-colors"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        aria-label="Scroll down"
      >
        <ChevronDown className="h-10 w-10" />
      </motion.button>
    </section>
  );
}
