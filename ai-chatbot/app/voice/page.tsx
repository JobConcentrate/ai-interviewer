import { Suspense } from "react";
import VoiceInterview from "@/components/VoiceInterview";

export default function VoicePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-3xl">
        <Suspense fallback={<div className="text-center">Loading voice interview...</div>}>
          <VoiceInterview />
        </Suspense>
      </div>
    </main>
  );
}
