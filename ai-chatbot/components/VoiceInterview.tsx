"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { fetchPreviousChat, sendInterviewMessage } from "@/lib/api";
import type { Message } from "../server/state/interview.state";

type VoiceSupport = {
  recognition: boolean;
  synthesis: boolean;
};

export default function VoiceInterview() {
  const searchParams = useSearchParams();
  const urlSessionId = searchParams.get("sessionId");
  const urlRole = searchParams.get("role") ?? undefined;
  const urlEmployer = searchParams.get("employer") ?? undefined;
  const urlToken = searchParams.get("token") ?? undefined;
  const urlRoleId = searchParams.get("roleId") ?? undefined;
  const urlCandidateEmail = searchParams.get("candidateEmail") ?? undefined;
  const urlAccessToken = searchParams.get("accessToken") ?? undefined;
  const rawUrlLanguage = searchParams.get("language");
  const urlLanguage =
    rawUrlLanguage === "zh" ? "zh" : rawUrlLanguage === "en" ? "en" : null;

  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ended, setEnded] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<"en" | "zh" | null>(null);
  const [languageLocked, setLanguageLocked] = useState(false);
  const [languageChecked, setLanguageChecked] = useState(false);
  const [voiceSupport, setVoiceSupport] = useState<VoiceSupport>({
    recognition: false,
    synthesis: false,
  });

  const recognitionRef = useRef<any>(null);
  const isVoiceSupported = voiceSupport.recognition && voiceSupport.synthesis;
  const languageCode = language === "zh" ? "zh-CN" : "en-US";
  const languageStorageKey = sessionId
    ? `ai-interviewer-language:${sessionId}`
    : "ai-interviewer-language";

  const getSpeechRecognition = () => {
    if (typeof window === "undefined") return null;
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    if (!recognitionRef.current) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.interimResults = false;
      recognitionRef.current.continuous = false;
      recognitionRef.current.maxAlternatives = 1;
    }
    if (language) {
      recognitionRef.current.lang = languageCode;
    }
    return recognitionRef.current;
  };

  const stopListening = () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    try {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.stop();
    } catch {
      // Ignore stop errors.
    } finally {
      setListening(false);
    }
  };

  const startListening = (force = false) => {
    if (!force && (!started || loading || ended || speaking)) return;
    const recognition = getSpeechRecognition();
    if (!recognition) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    setError(null);
    recognition.onresult = (event: any) => {
      const transcript = event?.results?.[0]?.[0]?.transcript?.trim() ?? "";
      if (transcript) {
        void handleSendMessage(transcript);
      } else {
        setError("Could not hear a response. Please try again.");
      }
    };
    recognition.onerror = () => {
      setError("Microphone error. Please check permissions.");
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
    };

    try {
      recognition.start();
      setListening(true);
    } catch {
      setError("Unable to start listening. Try again.");
      setListening(false);
    }
  };

  const speakMessage = (text: string, shouldListen: boolean) => {
    if (typeof window === "undefined") return;
    if (!voiceSupport.synthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    if (language) {
      utterance.lang = languageCode;
    }
    setSpeaking(true);
    utterance.onend = () => {
      setSpeaking(false);
      if (shouldListen) {
        startListening(true);
      }
    };
    utterance.onerror = () => {
      setSpeaking(false);
      if (shouldListen) {
        startListening(true);
      }
    };
    window.speechSynthesis.speak(utterance);
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || loading || ended || !sessionId) return;

    stopListening();
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      const data = await sendInterviewMessage(
        text,
        sessionId,
        urlRole,
        urlEmployer,
        urlToken,
        urlRoleId,
        urlCandidateEmail,
        urlAccessToken,
        undefined,
        language ?? undefined
      );
      if (data.message) {
        setMessages((prev) => [...prev, { role: "ai", content: data.message }]);
        speakMessage(data.message, !data.ended);
      }
      if (data.ended) setEnded(true);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: "Unable to reach the interviewer." },
      ]);
      setError("Unable to reach the interviewer.");
    } finally {
      setLoading(false);
    }
  };

  const requestMicPermission = async () => {
    if (typeof navigator === "undefined") return true;
    if (!navigator.mediaDevices?.getUserMedia) return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch {
      setError("Microphone permission is required to continue.");
      return false;
    }
  };

  const bootstrapInterview = async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);

    try {
      const data = await fetchPreviousChat(
        sessionId,
        urlRole,
        urlEmployer,
        urlToken,
        urlRoleId,
        urlCandidateEmail,
        urlAccessToken,
        true,
        language ?? undefined
      );
      const history = data.messages ?? [];
      setMessages(history);
      const wasEnded = Boolean(data.ended);
      setEnded(wasEnded);

      let nextMessage = data.message ?? "";

      if (history.length === 0) {
        const intro = await sendInterviewMessage(
          "",
          sessionId,
          urlRole,
          urlEmployer,
          urlToken,
          urlRoleId,
          urlCandidateEmail,
          urlAccessToken,
          true,
          language ?? undefined
        );
        if (intro.message) {
          setMessages([{ role: "ai", content: intro.message }]);
          nextMessage = intro.message;
        }
        if (intro.ended) setEnded(true);
        if (nextMessage && !wasEnded && !intro.ended) {
          speakMessage(nextMessage, true);
        }
        return;
      }

      if (!nextMessage && history.length > 0) {
        const lastAi = [...history]
          .reverse()
          .find((message) => message.role === "ai")?.content;
        nextMessage = lastAi ?? "";
      }

      if (nextMessage && !wasEnded) {
        speakMessage(nextMessage, true);
      }
    } catch (err) {
      setError("Unable to start the interview. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReady = async () => {
    if (!sessionId || started || !isVoiceSupported || !language) return;
    setError(null);
    const permissionOk = await requestMicPermission();
    if (!permissionOk) return;
    setStarted(true);
    await bootstrapInterview();
  };

  const handleSelectLanguage = (value: "en" | "zh") => {
    if (languageLocked) return;
    setLanguage(value);
    setLanguageLocked(true);
  };

  useEffect(() => {
    const sid = urlSessionId ?? uuidv4();
    setSessionId(sid);
    setLanguage(urlLanguage);
    setLanguageLocked(Boolean(urlLanguage));
    setLanguageChecked(Boolean(urlLanguage));
  }, [urlSessionId, urlLanguage]);

  useEffect(() => {
    if (!sessionId) return;
    if (typeof window === "undefined") return;
    if (urlLanguage) {
      window.localStorage.setItem(languageStorageKey, urlLanguage);
      setLanguage(urlLanguage);
      setLanguageLocked(true);
      setLanguageChecked(true);
      return;
    }
    const saved = window.localStorage.getItem(languageStorageKey);
    if (saved === "en" || saved === "zh") {
      setLanguage(saved);
      setLanguageLocked(true);
    }
    setLanguageChecked(true);
  }, [sessionId, languageStorageKey, urlLanguage]);

  useEffect(() => {
    if (!sessionId || !language) return;
    if (typeof window === "undefined") return;
    window.localStorage.setItem(languageStorageKey, language);
  }, [sessionId, language, languageStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const recognition =
      Boolean((window as any).SpeechRecognition) ||
      Boolean((window as any).webkitSpeechRecognition);
    const synthesis =
      "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
    setVoiceSupport({ recognition, synthesis });
  }, []);

  useEffect(() => {
    if (!language) return;
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.lang = languageCode;
    }
  }, [language, languageCode]);

  useEffect(() => {
    return () => {
      const recognition = recognitionRef.current;
      if (recognition) {
        try {
          recognition.onresult = null;
          recognition.onerror = null;
          recognition.onend = null;
          recognition.stop();
        } catch {
          // Ignore stop errors.
        }
      }
      if (typeof window !== "undefined") {
        window.speechSynthesis?.cancel();
      }
    };
  }, []);

  const statusText = ended
    ? "Interview completed"
    : speaking
    ? "Interviewer speaking"
    : listening
    ? "Listening..."
    : loading
    ? "Processing response..."
    : started
    ? "Waiting for your response"
    : "Ready to start";

  const waveActive = (speaking || listening) && !ended;
  const waveColor = speaking
    ? "bg-amber-400"
    : listening
    ? "bg-emerald-400"
    : loading
    ? "bg-blue-400"
    : "bg-slate-600";

  return (
    <div className="min-h-screen w-full bg-slate-950 text-white flex flex-col">
      <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold">Voice Call</h1>
          <p className="text-xs text-slate-300">AI Interviewer</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <span
            className={`h-2 w-2 rounded-full ${
              ended
                ? "bg-slate-500"
                : listening
                ? "bg-emerald-400"
                : speaking
                ? "bg-amber-400"
                : loading
                ? "bg-blue-400"
                : "bg-slate-400"
            }`}
          />
          <span>{statusText}</span>
        </div>
      </div>

      <div className="flex-1 p-6 flex flex-col items-center justify-center text-center gap-8">
        <div className="h-28 w-28 rounded-full bg-slate-800 flex items-center justify-center text-2xl font-semibold">
          AI
        </div>

        <div className={`voice-wave ${waveActive ? "active" : ""}`}>
          <div className={`voice-bar ${waveColor}`} />
          <div className={`voice-bar ${waveColor}`} />
          <div className={`voice-bar ${waveColor}`} />
          <div className={`voice-bar ${waveColor}`} />
          <div className={`voice-bar ${waveColor}`} />
        </div>

        {!started ? (
          <div className="space-y-4 w-full max-w-sm">
            <p className="text-sm text-slate-300">
              Tap to start the call. Microphone access is required.
            </p>
            {!language && !languageChecked && (
              <p className="text-sm text-slate-400">Checking saved language...</p>
            )}
            {!language && languageChecked && (
              <div className="flex gap-3">
                <button
                  onClick={() => handleSelectLanguage("en")}
                  className={`flex-1 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    language === "en"
                      ? "border-emerald-400 text-emerald-200"
                      : "border-slate-700 text-slate-300 hover:border-slate-500"
                  }`}
                  aria-pressed={language === "en"}
                >
                  English
                </button>
                <button
                  onClick={() => handleSelectLanguage("zh")}
                  className={`flex-1 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    language === "zh"
                      ? "border-emerald-400 text-emerald-200"
                      : "border-slate-700 text-slate-300 hover:border-slate-500"
                  }`}
                  aria-pressed={language === "zh"}
                >
                  Chinese
                </button>
              </div>
            )}
            {language && (
              <p className="text-xs text-slate-400">
                Language locked: {language === "zh" ? "Chinese" : "English"}
              </p>
            )}
            {!isVoiceSupported && (
              <div className="text-sm text-rose-300">
                Voice calls are not supported in this browser. Use the chat
                interview link instead.
              </div>
            )}
            {error && <div className="text-sm text-rose-300">{error}</div>}
            <button
              onClick={handleReady}
              disabled={!isVoiceSupported || !sessionId || !language}
              className="w-full bg-emerald-500 text-slate-950 py-3 rounded-full text-sm font-semibold hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start call
            </button>
          </div>
        ) : (
          <div className="space-y-4 w-full max-w-sm">
            <p className="text-sm text-slate-300">{statusText}</p>
            {ended && (
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Call ended
              </p>
            )}
            {error && <div className="text-sm text-rose-300">{error}</div>}
            <button
              onClick={listening ? stopListening : () => startListening()}
              disabled={loading || speaking || ended}
              className={`w-full py-3 rounded-full text-sm font-semibold transition-colors ${
                listening
                  ? "bg-rose-500 text-white hover:bg-rose-400"
                  : "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {listening ? "Stop talking" : "Start talking"}
            </button>
            <p className="text-xs text-slate-400">
              Speak when prompted. Tap to stop if needed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
