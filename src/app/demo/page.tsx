"use client";

import ChatWidget from "@/components/ChatWidget";

/** Customer-facing support chat — full product experience. */
export default function DemoPage() {
  return (
    <main className="flex h-[calc(100dvh-4rem)] min-h-0 flex-col overflow-hidden bg-white">
      <ChatWidget packageId="premium" />
    </main>
  );
}
