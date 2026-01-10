"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { v4 as uuidv4 } from "uuid";

function AdminDashboardContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const employer = searchParams.get("employer");

  const [role, setRole] = useState("software-developer");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Guard: missing token or employer
  if (!token || !employer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-600">
          ❌ Missing { !token ? "token" : "employer name" }
        </p>
      </div>
    );
  }

  const generateInterviewLink = () => {
    const sessionId = uuidv4();
    const url = `${window.location.origin}/room` +
      `?sessionId=${sessionId}` +
      `&role=${role}` +
      `&token=${token}`;

    setLink(url);
  };

  const copyToClipboard = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="bg-white p-6 rounded-xl shadow-lg space-y-4 max-w-lg w-full">

        <h1 className="text-xl font-semibold text-slate-800">
          Employer Dashboard
        </h1>

        <p className="text-sm text-slate-600">
          Hello <span className="font-medium">{employer}</span>! Generate an interview link for your candidate below.
        </p>

        {/* Role Selector */}
        <div>
          <label className="text-sm font-medium text-slate-800 mb-1 block">
            Candidate Role
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm text-black"
          >
            <option value="software-developer">Software Developer</option>
            <option value="accountant">Accountant</option>
          </select>
        </div>

        <button
          onClick={generateInterviewLink}
          className="w-full bg-slate-900 text-white py-2 rounded-lg hover:bg-slate-800"
        >
          Generate Interview Link
        </button>

        {link && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-black">Interview Link</label>
            <div className="flex gap-2">
              <input
                value={link}
                readOnly
                className="flex-1 border rounded-lg px-3 py-2 text-sm text-black"
              />
              <button
                onClick={copyToClipboard}
                className="bg-slate-800 text-white px-3 rounded-lg text-sm"
              >
                Copy
              </button>
            </div>
          </div>
        )}
      </div>

      {copied && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm">
          ✅ Link copied
        </div>
      )}
    </main>
  );
}

export default function AdminDashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-600">Loading...</p>
      </div>
    }>
      <AdminDashboardContent />
    </Suspense>
  );
}