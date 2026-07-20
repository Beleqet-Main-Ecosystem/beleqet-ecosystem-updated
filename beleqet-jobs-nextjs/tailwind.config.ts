import type { Config } from "tailwindcss";

const config: Config = {
  theme: {
    extend: {
      colors: {
        ink: "#0E1F17",         // Solid Typography & Deep UI Blocks
        "ink-2": "#16281F",     // Dashboard Mockup Background Gradients
        lime: "#D8F24E",        // Primary Brand Accent
        "lime-deep": "#B9D93A",   // Focused Interactive Accents
        "bg-soft": "#F5F8F5",    // Muted Layout Panels
        muted: "#5C6B62",       // Descriptions & Captions
      },
    },
  },
};
export default config;
