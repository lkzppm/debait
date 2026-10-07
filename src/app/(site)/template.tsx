"use client";

import { motion } from "motion/react";

/**
 * Mounted again on every navigation, so each page fades in under the bar.
 * Opacity only: a transform here would turn the landing page's fixed
 * background into a scrolling one.
 */
export default function SiteTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35, ease: "easeOut" }}>
      {children}
    </motion.div>
  );
}
