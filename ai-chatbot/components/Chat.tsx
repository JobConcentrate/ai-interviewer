"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { sendInterviewMessage, fetchPreviousChat } from "@/lib/api";
import type { Message } from "../server/state/interview.state";

export default function Chat() {
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

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ended, setEnded] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [language, setLanguage] = useState<"en" | "zh" | null>(null);
  const [languageLocked, setLanguageLocked] = useState(false);
  const [languageChecked, setLanguageChecked] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [initializing, setInitializing] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const languageStorageKey = sessionId
    ? `ai-interviewer-language:${sessionId}`
    : "ai-interviewer-language";

  useEffect(() => {
    const sid = urlSessionId ?? uuidv4();
    setSessionId(sid);
    setMessages([]);
    setEnded(false);
    setInitialized(false);
    setInitializing(false);
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
    if (!sessionId || !language || initialized) return;

    const loadPreviousChat = async () => {
      setInitializing(true);
      try {
        const data = await fetchPreviousChat(
          sessionId,
          urlRole,
          urlEmployer,
          urlToken,
          urlRoleId,
          urlCandidateEmail,
          urlAccessToken,
          undefined,
          language
        );
        if (data.messages) setMessages(data.messages);
        if (data.ended) setEnded(true);

        if (!data.messages || data.messages.length === 0) {
          const intro = await sendInterviewMessage(
            "",
            sessionId,
            urlRole,
            urlEmployer,
            urlToken,
            urlRoleId,
            urlCandidateEmail,
            urlAccessToken,
            undefined,
            language
          );
          if (intro.message) {
            setMessages([{ role: "ai", content: intro.message }]);
          }
        }
      } catch (err) {
        console.error("Error fetching previous chat:", err);
      } finally {
        setInitializing(false);
        setInitialized(true);
      }
    };

    loadPreviousChat();
  }, [
    sessionId,
    language,
    initialized,
    urlRole,
    urlEmployer,
    urlToken,
    urlRoleId,
    urlCandidateEmail,
    urlAccessToken,
  ]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSendMessage = async () => {
    if (!input.trim() || loading || ended || !sessionId) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const data = await sendInterviewMessage(
        input,
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
      }
      if (data.ended) setEnded(true);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: "Warning: Unable to reach the interviewer." },
      ]);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectLanguage = (value: "en" | "zh") => {
    if (languageLocked) return;
    setLanguage(value);
    setLanguageLocked(true);
  };

  if (!language && !languageChecked) {
    return (
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b bg-slate-900">
          <h1 className="text-lg font-semibold text-slate-100">AI Interviewer</h1>
          <p className="text-sm text-slate-300">Loading interview...</p>
        </div>
        <div className="p-6">
          <p className="text-sm text-slate-600">Checking saved language...</p>
        </div>
      </div>
    );
  }

  if (!language) {
    return (
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b bg-slate-900">
          <h1 className="text-lg font-semibold text-slate-100">AI Interviewer</h1>
          <p className="text-sm text-slate-300">Choose your interview language.</p>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600">
            Select the language you want to interview in.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => handleSelectLanguage("en")}
              className="flex-1 border border-slate-300 rounded-lg py-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              English
            </button>
            <button
              onClick={() => handleSelectLanguage("zh")}
              className="flex-1 border border-slate-300 rounded-lg py-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              Chinese
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b bg-slate-900">
        <h1 className="text-lg font-semibold text-slate-100">AI Interviewer</h1>
        <p className="text-sm text-slate-300">Please answer one question at a time.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {initializing && messages.length === 0 && (
          <div className="text-sm text-slate-500">Starting interview...</div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] px-4 py-2 rounded-lg text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-900"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 px-4 py-2 rounded-lg text-sm text-slate-500">
              Interviewer is typing...
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="border-t px-4 py-3 flex gap-2">
        <input
          className="flex-1 border rounded-lg px-3 py-2 text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
          placeholder="Type your answer..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
          disabled={loading || ended || initializing}
        />
        <button
          className="bg-slate-900 text-white px-4 rounded-lg text-sm disabled:opacity-50"
          onClick={handleSendMessage}
          disabled={loading || !input.trim() || ended || initializing}
        >
          Send
        </button>
      </div>
    </div>
  );
}
