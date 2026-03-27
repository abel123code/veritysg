import { motion } from "framer-motion";

export default function LoadingScreen() {
  return (
    <motion.div
      key="loading-screen"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-primary"
    >
      <div className="h-10 w-10 rounded-full border-[3px] border-primary-foreground/20 border-t-primary-foreground animate-spin" />
    </motion.div>
  );
}
