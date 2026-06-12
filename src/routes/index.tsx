import { createFileRoute } from "@tanstack/react-router";
import { ChatApp } from "@/components/ChatApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NULLROOM — Zero-Persistence Encrypted Chat & Calls" },
      { name: "description", content: "End-to-end encrypted ephemeral rooms with voice & video. Nothing stored, ever. Developed by n1ckar." },
      { property: "og:title", content: "NULLROOM" },
      { property: "og:description", content: "E2EE chat & calls. No cloud. No logs. Developed by n1ckar." },
    ],
  }),
  component: ChatApp,
});
