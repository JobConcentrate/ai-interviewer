"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { sendInterviewMessage, fetchPreviousChat } from "@/lib/api";
import { Message } from "../server/state/interview.state";

export default function Chat() {
  const searchParams = useSearchParams();
  const urlSessionId = searchParams.get("sessionId");
  const urlRole = searchParams.get("role") ?? undefined;
  const urlEmployer = searchParams.get("employer") ?? undefined;
  const urlToken = searchParams.get("token") ?? undefined;
  const urlRoleId = searchParams.get("roleId") ?? undefined;
  const urlCandidateEmail = searchParams.get("candidateEmail") ?? undefined;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ended, setEnded] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sid = urlSessionId ?? uuidv4();
    setSessionId(sid);

    const loadPreviousChat = async () => {
      try {
        const data = await fetchPreviousChat(
          sid,
          urlRole,
          urlEmployer,
          urlToken,
          urlRoleId,
          urlCandidateEmail
        );
        if (data.messages) setMessages(data.messages);
        if (data.ended) setEnded(true);

        if (!data.messages || data.messages.length === 0) {
          const intro = await sendInterviewMessage(
            "",
            sid,
            urlRole,
            urlEmployer,
            urlToken,
            urlRoleId,
            urlCandidateEmail
          );
          if (intro.message) setMessages([{ role: "ai", content: intro.message }]);
        }
      } catch (err) {
        console.error("Error fetching previous chat:", err);
      }
    };

    loadPreviousChat();
  }, [urlSessionId, urlRole, urlEmployer, urlToken, urlRoleId, urlCandidateEmail]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSendMessage = async () => {
    if (!input.trim() || loading || ended || !sessionId) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
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
        urlCandidateEmail
      );
      if (data.message) setMessages(prev => [...prev, { role: "ai", content: data.message }]);
      if (data.ended) setEnded(true);
    } catch (err) {
      setMessages(prev => [...prev, { role: "ai", content: "⚠️ Unable to reach the interviewer." }]);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-slate-900">
        <h1 className="text-lg font-semibold text-slate-100">AI Interviewer</h1>
        <p className="text-sm text-slate-300">Please answer one question at a time.</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] px-4 py-2 rounded-lg text-sm leading-relaxed ${m.role === "user" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-900"}`}>
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 px-4 py-2 rounded-lg text-sm text-slate-500">Interviewer is typing…</div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t px-4 py-3 flex gap-2">
        <input
          className="flex-1 border rounded-lg px-3 py-2 text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
          placeholder="Type your answer..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSendMessage()}
          disabled={loading || ended}
        />
        <button
          className="bg-slate-900 text-white px-4 rounded-lg text-sm disabled:opacity-50"
          onClick={handleSendMessage}
          disabled={loading || !input.trim() || ended}
        >
          Send
        </button>
      </div>
    </div>
  );
}
