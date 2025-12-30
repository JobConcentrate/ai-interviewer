import { Suspense } from "react";
import Chat from "@/components/Chat";

export default function RoomPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-2xl">
        <Suspense fallback={<div className="text-center">Loading chat…</div>}>
          <Chat />
        </Suspense>
      </div>
    </main>
  );
}
