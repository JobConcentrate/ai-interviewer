"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { fetchPreviousChat, sendInterviewMessage } from "@/lib/api";
import { Message } from "../server/state/interview.state";

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

  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ended, setEnded] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceSupport, setVoiceSupport] = useState<VoiceSupport>({
    recognition: false,
    synthesis: false,
  });

  const recognitionRef = useRef<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isVoiceSupported =
    voiceSupport.recognition && voiceSupport.synthesis;

  const getSpeechRecognition = () => {
    if (typeof window === "undefined") return null;
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    if (!recognitionRef.current) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = "en-US";
      recognitionRef.current.interimResults = false;
      recognitionRef.current.continuous = false;
      recognitionRef.current.maxAlternatives = 1;
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
        urlAccessToken
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
        true
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
          true
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
    if (!sessionId || started || !isVoiceSupported) return;
    setError(null);
    const permissionOk = await requestMicPermission();
    if (!permissionOk) return;
    setStarted(true);
    await bootstrapInterview();
  };

  useEffect(() => {
    const sid = urlSessionId ?? uuidv4();
    setSessionId(sid);
  }, [urlSessionId]);

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
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, listening]);

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

  return (
    <div className="w-full bg-white rounded-xl shadow-lg flex flex-col overflow-hidden border border-slate-200">
      <div className="px-6 py-4 border-b bg-slate-900">
        <h1 className="text-lg font-semibold text-slate-100">
          Voice Interview
        </h1>
        <p className="text-sm text-slate-300">
          Answer out loud. We will speak each question to you.
        </p>
      </div>

      <div className="p-6 space-y-6">
        {!started ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              When you are ready, press the button to start the voice interview.
              Microphone access will be requested.
            </p>
            {!isVoiceSupported && (
              <div className="text-sm text-red-600">
                Voice interviews are not supported in this browser. Use the
                chat interview link instead.
              </div>
            )}
            {error && (
              <div className="text-sm text-red-600">{error}</div>
            )}
            <button
              onClick={handleReady}
              disabled={!isVoiceSupported || !sessionId}
              className="w-full bg-slate-900 text-white py-3 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              I am ready
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span
                  className={`h-2 w-2 rounded-full ${
                    ended
                      ? "bg-slate-400"
                      : listening
                      ? "bg-emerald-500"
                      : speaking
                      ? "bg-amber-500"
                      : loading
                      ? "bg-blue-500"
                      : "bg-slate-300"
                  }`}
                />
                <span>{statusText}</span>
              </div>
              {ended && (
                <span className="text-xs uppercase tracking-wide text-slate-500">
                  Ended
                </span>
              )}
            </div>

            {error && (
              <div className="text-sm text-red-600">{error}</div>
            )}

            <div className="space-y-2">
              <h2 className="text-sm font-medium text-slate-700">Transcript</h2>
              <div className="max-h-[360px] overflow-y-auto border border-slate-200 rounded-lg bg-slate-50 p-4 space-y-4">
                {messages.length === 0 && !loading && (
                  <p className="text-sm text-slate-500">
                    Waiting for the interviewer...
                  </p>
                )}
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${
                      message.role === "user"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] px-4 py-2 rounded-lg text-sm leading-relaxed ${
                        message.role === "user"
                          ? "bg-slate-900 text-white"
                          : "bg-white text-slate-900 border border-slate-200"
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-slate-200 px-4 py-2 rounded-lg text-sm text-slate-500">
                      Interviewer is thinking...
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={
                  listening ? stopListening : () => startListening()
                }
                disabled={loading || speaking || ended}
                className={`w-full py-3 rounded-lg text-sm font-medium transition-colors ${
                  listening
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-slate-900 text-white hover:bg-slate-800"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {listening ? "Listening... tap to stop" : "Start answer"}
              </button>
              <p className="text-xs text-slate-500">
                Speak clearly. Tap the button again if you want to retry.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
