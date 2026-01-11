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
  const [activeTab, setActiveTab] = useState("generate");
  const [subTab, setSubTab] = useState("generate-link");

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
    <main className="min-h-screen bg-slate-50">
      {/* Header with Company Name and Tabs */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-6">
          <div className="flex items-center gap-8">
            {/* Company Name - Fixed width container */}
            <div className="w-64 shrink-0">
              <h1 className="text-2xl font-bold text-slate-900 py-4 pr-8 border-r border-slate-200">
                {employer}
              </h1>
            </div>

            {/* Tabs - Left aligned */}
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab("generate")}
                className={`px-4 py-4 text-sm font-medium transition-colors relative ${
                  activeTab === "generate"
                    ? "text-slate-900"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Generate Link
                {activeTab === "generate" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900" />
                )}
              </button>
              
              <button
                onClick={() => setActiveTab("candidates")}
                className={`px-4 py-4 text-sm font-medium transition-colors relative ${
                  activeTab === "candidates"
                    ? "text-slate-900"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Candidates
                {activeTab === "candidates" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 py-8">
        {activeTab === "generate" && (
          <div className="flex gap-6">
            {/* Left Sidebar - Same width as company name */}
            <div className="w-64 shrink-0">
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2">
                <button
                  onClick={() => setSubTab("generate-link")}
                  className={`w-full text-left px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                    subTab === "generate-link"
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Generate Link
                </button>
                <button
                  onClick={() => setSubTab("add-role")}
                  className={`w-full text-left px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                    subTab === "add-role"
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Add Role
                </button>
              </div>
            </div>

            {/* Main Content Area - Centered */}
            <div className="flex-1 flex justify-center">
              <div className="w-full max-w-3xl">
                {subTab === "generate-link" && (
                  <>
                    <div className="mb-6">
                      <h2 className="text-2xl font-semibold text-slate-900 mb-2">
                        Generate Interview Link
                      </h2>
                      <p className="text-slate-600">
                        Create a unique interview link for your candidate. Share this link to begin the interview process.
                      </p>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-6">
                      {/* Role Selector */}
                      <div>
                        <label className="text-sm font-medium text-slate-900 mb-2 block">
                          Candidate Role
                        </label>
                        <select
                          value={role}
                          onChange={(e) => setRole(e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                        >
                          <option value="software-developer">Software Developer</option>
                          <option value="accountant">Accountant</option>
                        </select>
                      </div>

                      <button
                        onClick={generateInterviewLink}
                        className="w-full bg-slate-900 text-white py-2.5 rounded-lg hover:bg-slate-800 transition-colors font-medium"
                      >
                        Generate Interview Link
                      </button>

                      {link && (
                        <div className="space-y-2 pt-4 border-t border-slate-200">
                          <label className="text-sm font-medium text-black block">Interview Link</label>
                          <div className="flex gap-2">
                            <input
                              value={link}
                              readOnly
                              className="flex-1 border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-black bg-slate-50 focus:outline-none"
                            />
                            <button
                              onClick={copyToClipboard}
                              className="bg-slate-900 text-white px-4 rounded-lg text-sm hover:bg-slate-800 transition-colors font-medium"
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {subTab === "add-role" && (
                  <>
                    <div className="mb-6">
                      <h2 className="text-2xl font-semibold text-slate-900 mb-2">
                        Add New Role
                      </h2>
                      <p className="text-slate-600">
                        Create a custom role with specific interview questions and requirements.
                      </p>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-6">
                      <div>
                        <label className="text-sm font-medium text-slate-900 mb-2 block">
                          Role Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g., Senior Backend Engineer"
                          className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-slate-900 mb-2 block">
                          Description
                        </label>
                        <textarea
                          placeholder="Brief description of the role..."
                          rows={4}
                          className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                        />
                      </div>

                      <button
                        className="w-full bg-slate-900 text-white py-2.5 rounded-lg hover:bg-slate-800 transition-colors font-medium"
                      >
                        Create Role
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "candidates" && (
          <div className="flex gap-6">
            {/* Empty space to match sidebar width */}
            <div className="w-64 shrink-0" />
            
            {/* Content centered */}
            <div className="flex-1 flex justify-center">
              <div className="w-full max-w-5xl">
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold text-slate-900 mb-2">
                    Candidates
                  </h2>
                  <p className="text-slate-600">
                    View and manage all candidates who have completed interviews.
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
                  <div className="text-center text-slate-500">
                    <svg className="w-16 h-16 mx-auto mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p className="text-lg font-medium">No candidates yet</p>
                    <p className="text-sm mt-1">Generated interview links will appear here once completed</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {copied && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-2.5 rounded-lg text-sm shadow-lg">
          ✅ Link copied to clipboard
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