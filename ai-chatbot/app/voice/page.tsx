import { Suspense } from "react";
import VoiceInterview from "@/components/VoiceInterview";

export default function VoicePage() {
  return (
    <main className="min-h-screen w-full bg-slate-950">
      <Suspense fallback={<div className="text-center text-slate-200">Loading voice interview...</div>}>
        <VoiceInterview />
      </Suspense>
    </main>
  );
}
