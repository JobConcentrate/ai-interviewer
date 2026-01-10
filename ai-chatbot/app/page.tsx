"use client";

import { useState } from "react";
import { v4 as uuidv4 } from "uuid";

export default function AdminDashboard() {
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [role, setRole] = useState<string>("software-developer");

  const generateInterviewLink = () => {
    const sessionId = uuidv4();
    const url = `${window.location.origin}/room?sessionId=${sessionId}&role=${role}`;
    setLink(url);
  };

  const copyToClipboard = async () => {
    if (!link) return;

    await navigator.clipboard.writeText(link);
    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="bg-white p-6 rounded-xl shadow-lg space-y-4 max-w-lg w-full">
        <h1 className="text-xl font-semibold text-slate-800">
          Admin Dashboard
        </h1>

        <p className="text-sm text-slate-600">
          Generate a private interview link for a candidate.
        </p>

        {/* Role dropdown */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-slate-800 mb-1">
            Select Role
          </label>
          <select
            className="border rounded-lg px-3 py-2 text-sm bg-white text-black"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="software-developer">Software Developer</option>
            <option value="accountant">Accountant</option>
          </select>
        </div>

        <button
          onClick={generateInterviewLink}
          className="w-full bg-slate-900 text-white py-2 rounded-lg hover:bg-slate-800 transition"
        >
          Generate New Link
        </button>

        {link && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-800">
              Interview Link
            </label>

            <div className="flex gap-2">
              <input
                className="flex-1 border rounded-lg px-3 py-2 text-sm bg-white text-black cursor-text select-all"
                value={link}
                readOnly
              />

              <button
                onClick={copyToClipboard}
                disabled={copied}
                className="bg-slate-800 text-white px-3 rounded-lg text-sm disabled:opacity-50"
              >
                Copy
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {copied && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
          ✅ Link copied to clipboard
        </div>
      )}
    </main>
  );
}
