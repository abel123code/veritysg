import React from "react";
import { motion, Variants } from "framer-motion";
import { ArrowRight } from "lucide-react";

interface ColorChangeCardProps {
  heading: string;
  description: string;
  imgSrc: string;
  onClick?: () => void;
}

const ColorChangeCard = ({ heading, description, imgSrc, onClick }: ColorChangeCardProps) => {
  return (
    <motion.div
      onClick={onClick}
      whileHover="hover"
      className="group relative aspect-[16/10] w-full overflow-hidden rounded-lg bg-slate-900 cursor-pointer"
    >
      <div
        className="absolute inset-0 saturate-100 opacity-30 transition-opacity duration-500 group-hover:opacity-70"
        style={{
          backgroundImage: `url(${imgSrc})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      {/* Arrow top-right */}
      <div className="absolute top-4 right-4 z-10">
        <ArrowRight className="w-6 h-6 text-white/70 group-hover:text-white transition-colors" />
      </div>

      {/* Content bottom-left */}
      <div className="absolute inset-x-0 bottom-0 z-10 p-6">
        <div className="overflow-hidden mb-2">
          <motion.div className="flex text-4xl sm:text-5xl font-black uppercase text-white leading-none">
            {heading.split("").map((letter, index) => (
              <AnimatedLetter letter={letter} key={index} />
            ))}
          </motion.div>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
};

interface AnimatedLetterProps {
  letter: string;
}

const letterVariants: Variants = {
  hover: {
    y: "-100%",
  },
};

const AnimatedLetter = ({ letter }: AnimatedLetterProps) => {
  return (
    <div className="inline-block h-[1em] overflow-hidden leading-[1em]">
      <motion.span
        variants={letterVariants}
        className="flex flex-col"
        transition={{ duration: 0.25 }}
      >
        <span>{letter}</span>
        <span>{letter}</span>
      </motion.span>
    </div>
  );
};

export default ColorChangeCard;
