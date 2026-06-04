import { createFileRoute } from "@tanstack/react-router";
import { ChatApp } from "@/components/ChatApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "N1CKAR//SECURE — Zero-Persistence Encrypted Chat" },
      { name: "description", content: "End-to-end encrypted, zero-persistence messenger with video & voice. Nothing stored, ever. Developed by n1ckar." },
      { property: "og:title", content: "N1CKAR//SECURE" },
      { property: "og:description", content: "E2EE chat & calls. No cloud. No logs. Developed by n1ckar." },
    ],
  }),
  component: ChatApp,
});
