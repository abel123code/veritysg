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

export default function HeroGreeting() {
  const scrollDown = () => {
    window.scrollTo({ top: window.innerHeight, behavior: "smooth" });
  };

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center bg-primary text-primary-foreground overflow-hidden">
      <GooeyText
        texts={greetings}
        morphTime={1.5}
        cooldownTime={1}
        className="h-32 flex items-center justify-center"
        textClassName="text-7xl md:text-9xl font-bold tracking-tight"
      />

      <motion.button
        onClick={scrollDown}
        className="absolute bottom-12 text-primary-foreground/60 hover:text-primary-foreground transition-colors"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        aria-label="Scroll down"
      >
        <ChevronDown className="h-10 w-10" />
      </motion.button>
    </section>
  );
}
