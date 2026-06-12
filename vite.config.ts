import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";

// Public Lovable Cloud (Supabase) credentials are safe to ship in the client
// bundle. Hardcoding them via `define` guarantees the build works on any host
// (Vercel, etc.) without requiring env vars to be configured there.
const PUBLIC_SUPABASE_URL = "https://mfxqnjzxivimrdhlnryh.supabase.co";
const PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_JR8r5Qr9aK2Uu6JK6Pl_VA_7B_OvTJ-";
const PUBLIC_SUPABASE_PROJECT_ID = "mfxqnjzxivimrdhlnryh";

export default defineConfig({
  plugins: [nitro()],

  vite: {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(PUBLIC_SUPABASE_URL),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      ),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(PUBLIC_SUPABASE_PROJECT_ID),
    },
  },

  tanstackStart: {
    server: { entry: "server" },
  },
});
