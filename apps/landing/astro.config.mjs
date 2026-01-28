// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import icon from "astro-icon";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
import { SITE } from "./src/config/site.mjs";

// https://astro.build/config
export default defineConfig({
  site: SITE.url,
  integrations: [
    react(),
    icon(),
    mdx(),
    tailwind(),
    sitemap({
      changefreq: "weekly",
      lastmod: new Date(),
      filter: (page) => !page.includes("/example"),
      serialize: (item) => {
        // Set custom priorities per page
        if (item.url === `${SITE.url}/`) {
          return { ...item, priority: 1.0, changefreq: "daily" };
        }
        if (item.url.includes("/features")) {
          return { ...item, priority: 0.9, changefreq: "weekly" };
        }
        if (item.url.includes("/contact-sales")) {
          return { ...item, priority: 0.8, changefreq: "monthly" };
        }
        if (item.url.includes("/about")) {
          return { ...item, priority: 0.7, changefreq: "monthly" };
        }
        if (item.url.includes("/contact")) {
          return { ...item, priority: 0.6, changefreq: "monthly" };
        }
        if (item.url.includes("/privacy") || item.url.includes("/terms")) {
          return { ...item, priority: 0.3, changefreq: "yearly" };
        }
        if (item.url.includes("/waitlist")) {
          return { ...item, priority: 0.6, changefreq: "monthly" };
        }
        return { ...item, priority: 0.5 };
      },
    }),
  ],
  build: {
    inlineStylesheets: "auto",
    assets: "_assets",
  },
  compressHTML: true,
  image: {
    domains: [],
    remotePatterns: [],
  },
});
