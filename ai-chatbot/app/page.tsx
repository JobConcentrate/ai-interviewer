/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/rules-of-hooks */
 
"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { Interview, InterviewMessage, Role } from "@/lib/supabase";
import {
  fetchRoles,
  createRole,
  deleteRole,
  sendInterviewInvite,
  fetchInterviews,
  fetchInterviewMessages,
} from "@/lib/api";

function AdminDashboardContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const employer = searchParams.get("employer");

  const [role, setRole] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("generate");
  const [subTab, setSubTab] = useState("generate-link");

  // Add role form state
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const [candidateEmail, setCandidateEmail] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loadingInterviews, setLoadingInterviews] = useState(false);
  const [interviewsError, setInterviewsError] = useState<string | null>(null);
  const [messagesByInterview, setMessagesByInterview] = useState<
    Record<string, InterviewMessage[]>
  >({});
  const [loadingMessagesByInterview, setLoadingMessagesByInterview] = useState<
    Record<string, boolean>
  >({});
  const [loadedMessagesByInterview, setLoadedMessagesByInterview] = useState<
    Record<string, boolean>
  >({});
  const [messagesErrorByInterview, setMessagesErrorByInterview] = useState<
    Record<string, string>
  >({});

  // Guard: missing token or employer
  if (!token || !employer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-600">
          ❌ Missing {!token ? "token" : "employer name"}
        </p>
      </div>
    );
  }

  // Fetch roles on mount
  useEffect(() => {
    loadRoles();
  }, [token]);

  useEffect(() => {
    if (activeTab === "candidates") {
      loadInterviews();
    }
  }, [activeTab, token]);

  const loadRoles = async () => {
    try {
      const data = await fetchRoles(token);
      if (data.roles) {
        setRoles(data.roles);
        // Set first role as default if available
        if (data.roles.length > 0 && !role) {
          setRole(data.roles[0].id);
        }
      }
    } catch (error) {
      console.error("Error fetching roles:", error);
    }
  };

  const loadInterviews = async () => {
    if (!token) return;
    setLoadingInterviews(true);
    setInterviewsError(null);

    try {
      const data = await fetchInterviews(token);
      setInterviews(data.interviews || []);
      setMessagesByInterview({});
      setLoadingMessagesByInterview({});
      setLoadedMessagesByInterview({});
      setMessagesErrorByInterview({});
    } catch (error) {
      console.error("Error fetching interviews:", error);
      setInterviewsError("Failed to load interviews");
    } finally {
      setLoadingInterviews(false);
    }
  };

  const loadMessagesForInterview = async (interviewId: string) => {
    if (!token) return;
    if (loadingMessagesByInterview[interviewId]) return;
    if (loadedMessagesByInterview[interviewId]) return;

    setLoadingMessagesByInterview((prev) => ({
      ...prev,
      [interviewId]: true,
    }));
    setMessagesErrorByInterview((prev) => ({
      ...prev,
      [interviewId]: "",
    }));

    try {
      const data = await fetchInterviewMessages(token, interviewId);
      setMessagesByInterview((prev) => ({
        ...prev,
        [interviewId]: data.messages || [],
      }));
      setLoadedMessagesByInterview((prev) => ({
        ...prev,
        [interviewId]: true,
      }));
    } catch (error) {
      console.error("Error fetching interview messages:", error);
      setMessagesErrorByInterview((prev) => ({
        ...prev,
        [interviewId]: "Failed to load messages",
      }));
    } finally {
      setLoadingMessagesByInterview((prev) => ({
        ...prev,
        [interviewId]: false,
      }));
    }
  };

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return;

    setLoading(true);
    try {
      await createRole(token, newRoleName, newRoleDescription);
      setNewRoleName("");
      setNewRoleDescription("");
      await loadRoles();
      alert("✅ Role created successfully");
    } catch (error) {
      console.error("Error creating role:", error);
      alert("Failed to create role");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm("Are you sure you want to delete this role?")) return;

    try {
      await deleteRole(roleId);
      await loadRoles();
    } catch (error) {
      console.error("Error deleting role:", error);
      alert("Failed to delete role");
    }
  };

  const generateInterviewLink = () => {
    const sessionId = uuidv4();
    // Find selected role object
    const selectedRole = roles.find((r) => r.id === role);
    if (!selectedRole) {
      alert("Role not found");
      return;
    }

    const roleName = selectedRole.name;

    const url =
      `${window.location.origin}/room` +
      `?sessionId=${sessionId}` +
      `&role=${encodeURIComponent(roleName)}` +
      `&roleId=${selectedRole.id}` +
      `&token=${encodeURIComponent(String(token))}` +
      `&employer=${encodeURIComponent(String(employer))}`;

    setLink(url);
  };

  const copyToClipboard = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendInvite = async () => {
    if (!link || !candidateEmail) return;

    setSending(true);
    try {
      await sendInterviewInvite(candidateEmail, employer, link);
      alert("✅ Email sent");
      setCandidateEmail("");
      setShowConfirm(false);
    } catch (error) {
      console.error("Error sending invite:", error);
      alert("❌ Failed to send email");
    } finally {
      setSending(false);
    }
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
                Link
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
                        Create a unique interview link for your candidate. Share
                        this link to begin the interview process.
                      </p>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-6">
                      {/* Role Selector */}
                      <div>
                        <label className="text-sm font-medium text-slate-900 mb-2 block">
                          Candidate Role
                        </label>
                        {roles.length > 0 ? (
                          <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                          >
                            {roles.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                            No roles available. Please add a role first.
                          </div>
                        )}
                      </div>

                      <button
                        onClick={generateInterviewLink}
                        disabled={roles.length === 0}
                        className="w-full bg-slate-900 text-white py-2.5 rounded-lg hover:bg-slate-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Generate Interview Link
                      </button>

                      {link && (
                        <div className="space-y-2 pt-4 border-t border-slate-200">
                          <label className="text-sm font-medium text-black block">
                            Interview Link
                          </label>
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

                      {link && (
                        <div className="space-y-4 pt-6 border-t border-slate-200">
                          <h3 className="text-sm font-medium text-slate-900">
                            Send interview link via email
                          </h3>
                          <input
                            type="email"
                            placeholder="Candidate email"
                            value={candidateEmail}
                            onChange={(e) => setCandidateEmail(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-slate-900"
                          />
                          <button
                            onClick={() => setShowConfirm(true)}
                            disabled={!candidateEmail}
                            className="w-full bg-slate-800 text-white py-2.5 rounded-lg hover:bg-slate-700 transition-colors font-medium disabled:opacity-50"
                          >
                            Send Interview Link
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {subTab === "add-role" && (
                  <>
                    <div className="mb-6">
                      <h2 className="text-2xl font-semibold text-slate-900 mb-2">
                        Manage Roles
                      </h2>
                      <p className="text-slate-600">
                        Create and manage custom roles for your interviews.
                      </p>
                    </div>

                    {/* Add New Role Form */}
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-6 mb-6">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Add New Role
                      </h3>

                      <div>
                        <label className="text-sm font-medium text-slate-900 mb-2 block">
                          Role Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g., Senior Backend Engineer"
                          value={newRoleName}
                          onChange={(e) => setNewRoleName(e.target.value)}
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
                          value={newRoleDescription}
                          onChange={(e) =>
                            setNewRoleDescription(e.target.value)
                          }
                          className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                        />
                      </div>

                      <button
                        onClick={handleCreateRole}
                        disabled={loading || !newRoleName.trim()}
                        className="w-full bg-slate-900 text-white py-2.5 rounded-lg hover:bg-slate-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? "Creating..." : "Create Role"}
                      </button>
                    </div>

                    {/* Existing Roles List */}
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                      <h3 className="text-lg font-semibold text-slate-900 mb-4">
                        Existing Roles
                      </h3>

                      {roles.length > 0 ? (
                        <div className="space-y-3">
                          {roles.map((r) => (
                            <div
                              key={r.id}
                              className="flex items-start justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                            >
                              <div className="flex-1">
                                <h4 className="font-medium text-slate-900">
                                  {r.name}
                                </h4>
                                {r.description && (
                                  <p className="text-sm text-slate-600 mt-1">
                                    {r.description}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => handleDeleteRole(r.id)}
                                className="ml-4 text-red-600 hover:text-red-800 text-sm font-medium"
                              >
                                Delete
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500 text-center py-8">
                          No roles created yet. Add your first role above.
                        </p>
                      )}
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
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                  {loadingInterviews && (
                    <div className="text-center text-slate-500">
                      Loading interviews...
                    </div>
                  )}

                  {interviewsError && (
                    <div className="text-center text-red-600">
                      {interviewsError}
                    </div>
                  )}

                  {!loadingInterviews && !interviewsError && interviews.length === 0 && (
                    <div className="text-center text-slate-500">
                      <svg
                        className="w-16 h-16 mx-auto mb-4 text-slate-300"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                      <p className="text-lg font-medium">No candidates yet</p>
                      <p className="text-sm mt-1">
                        Generated interview links will appear here once completed
                      </p>
                    </div>
                  )}

                  {!loadingInterviews && !interviewsError && interviews.length > 0 && (
                    <div className="space-y-4">
                      {interviews.map((interview) => {
                        const roleName =
                          interview.role_label ||
                          roles.find((r) => r.id === interview.role_id)?.name ||
                          "Unknown role";
                        const startedAt = interview.started_at || interview.created_at;
                        const ratingDisplay =
                          interview.rating !== null
                            ? `${interview.rating}/10`
                            : interview.status === "completed"
                              ? "Pending"
                              : "Not rated";
                        const messages = messagesByInterview[interview.id] || [];
                        const isLoadingMessages = loadingMessagesByInterview[interview.id];
                        const hasLoadedMessages = loadedMessagesByInterview[interview.id];
                        const messagesError = messagesErrorByInterview[interview.id];

                        return (
                          <details
                            key={interview.id}
                            className="rounded-lg border border-slate-200 p-4"
                            onToggle={(event) => {
                              if (event.currentTarget.open) {
                                loadMessagesForInterview(interview.id);
                              }
                            }}
                          >
                            <summary className="cursor-pointer list-none">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="text-sm font-medium text-slate-900">
                                    {interview.candidate_name || "Candidate"}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    Role: {roleName} | Session: {interview.session_id}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    Started: {startedAt ? new Date(startedAt).toLocaleString() : "Unknown"}
                                  </p>
                                </div>
                                <span
                                  className={`text-xs px-2 py-1 rounded-full ${
                                    interview.status === "completed"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-amber-100 text-amber-700"
                                  }`}
                                >
                                  {interview.status === "completed" ? "Completed" : "In progress"}
                                </span>
                              </div>
                            </summary>

                            <div className="mt-4 space-y-3">
                              <div className="rounded-md bg-slate-50 border border-slate-200 p-3">
                                <p className="text-xs text-slate-600">
                                  <span className="font-medium text-slate-900">AI Rating:</span>{" "}
                                  {ratingDisplay}
                                </p>
                                <p className="text-xs text-slate-600 mt-1">
                                  {interview.rating_comment ||
                                    (interview.status === "completed"
                                      ? "Rating comment pending."
                                      : "Rating will be generated after completion.")}
                                </p>
                              </div>
                              {isLoadingMessages && (
                                <p className="text-sm text-slate-500">
                                  Loading messages...
                                </p>
                              )}
                              {!isLoadingMessages && messagesError && (
                                <p className="text-sm text-red-600">
                                  {messagesError}
                                </p>
                              )}
                              {!isLoadingMessages &&
                                !messagesError &&
                                !hasLoadedMessages && (
                                  <p className="text-sm text-slate-500">
                                    Expand to load messages.
                                  </p>
                                )}
                              {!isLoadingMessages &&
                              !messagesError &&
                              hasLoadedMessages &&
                              messages.length === 0 ? (
                                <p className="text-sm text-slate-500">
                                  No messages yet.
                                </p>
                              ) : (
                                !isLoadingMessages &&
                                !messagesError &&
                                hasLoadedMessages &&
                                messages.map((msg) => (
                                  <div
                                    key={msg.id}
                                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                                  >
                                    <div
                                      className={`max-w-[80%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                                        msg.role === "user"
                                          ? "bg-slate-900 text-white"
                                          : "bg-slate-100 text-slate-900"
                                      }`}
                                    >
                                      {msg.message}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </details>
                        );
                      })}
                    </div>
                  )}
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

      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">
              Confirm Email
            </h3>
            <p className="text-sm text-slate-600">Send interview link to:</p>
            <p className="font-medium text-slate-900">{candidateEmail}</p>
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 border border-slate-300 rounded-lg py-2 text-sm text-black hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSendInvite}
                disabled={sending}
                className="flex-1 bg-slate-900 text-white rounded-lg py-2 text-sm hover:bg-slate-800 disabled:opacity-50"
              >
                {sending ? "Sending..." : "Confirm & Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function AdminDashboard() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-slate-600">Loading...</p>
        </div>
      }
    >
      <AdminDashboardContent />
    </Suspense>
  );
}
