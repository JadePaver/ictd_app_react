import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    // Supabase auth refuses to redirect back to IP-literal origins (its
    // IsRedirectURLValid rejects non-loopback IPs before consulting the
    // allow-list), so LAN devices must reach us via a hostname instead:
    // x.y.z.w.nip.io resolves to x.y.z.w. Vite blocks unknown hostnames
    // unless allowed here; `vite preview` inherits this setting.
    allowedHosts: [".nip.io"],
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
