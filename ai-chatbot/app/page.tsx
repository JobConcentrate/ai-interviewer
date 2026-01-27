/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/rules-of-hooks */
 
"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense, useEffect } from "react";
import { Interview, InterviewMessage, Role } from "@/lib/supabase";
import {
  fetchRoles,
  createRole,
  updateRole,
  deleteRole,
  sendInterviewInvite,
  fetchInterviews,
  fetchInterviewMessages,
  deleteInterview,
  createInterviewSession,
} from "@/lib/api";

function AdminDashboardContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const employer = searchParams.get("employer");

  const [role, setRole] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [link, setLink] = useState<string | null>(null);
  const [linkExpiresAt, setLinkExpiresAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [interviewMode, setInterviewMode] = useState<"chat" | "voice">("chat");
  const [interviewLanguage, setInterviewLanguage] = useState<"en" | "zh">("en");
  const [activeTab, setActiveTab] = useState("generate");
  const [subTab, setSubTab] = useState("generate-link");

  // Add role form state
  const [newRoleName, setNewRoleName] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteRoleConfirmId, setDeleteRoleConfirmId] = useState<string | null>(
    null
  );
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editRoleName, setEditRoleName] = useState("");
  const [editRoleDescription, setEditRoleDescription] = useState("");
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);

  const [candidateEmail, setCandidateEmail] = useState("");
  const [candidateEmailWasPasted, setCandidateEmailWasPasted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [emailToast, setEmailToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
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
  const [deletingHistoryByInterview, setDeletingHistoryByInterview] = useState<
    Record<string, boolean>
  >({});
  const [deleteConfirmInterviewId, setDeleteConfirmInterviewId] = useState<
    string | null
  >(null);
  const [messagesErrorByInterview, setMessagesErrorByInterview] = useState<
    Record<string, string>
  >({});

  // Guard: missing token or employer
  if (!token || !employer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-600">
          âŒ Missing {!token ? "token" : "employer name"}
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

  useEffect(() => {
    setLink(null);
    setLinkExpiresAt(null);
    setCopied(false);
  }, [interviewMode, interviewLanguage, role]);

  const loadRoles = async (attempt = 1) => {
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
      if (attempt < 3) {
        setTimeout(() => loadRoles(attempt + 1), attempt * 800);
      } else {
        showEmailToast("error", "Failed to fetch roles");
      }
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
      setDeletingHistoryByInterview({});
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

  const handleDeleteInterview = async (interviewId: string) => {
    if (!token) return;

    setDeletingHistoryByInterview((prev) => ({
      ...prev,
      [interviewId]: true,
    }));
    setMessagesErrorByInterview((prev) => ({
      ...prev,
      [interviewId]: "",
    }));

    try {
      await deleteInterview(token, interviewId);
      setInterviews((prev) => prev.filter((item) => item.id !== interviewId));
      showEmailToast("success", "Interview deleted");
      setMessagesByInterview((prev) => ({
        ...prev,
        [interviewId]: [],
      }));
      setLoadedMessagesByInterview((prev) => ({
        ...prev,
        [interviewId]: true,
      }));
      setLoadingMessagesByInterview((prev) => ({
        ...prev,
        [interviewId]: false,
      }));
      setMessagesErrorByInterview((prev) => ({
        ...prev,
        [interviewId]: "",
      }));
    } catch (error) {
      console.error("Error deleting interview:", error);
      showEmailToast("error", "Failed to delete interview");
      setMessagesErrorByInterview((prev) => ({
        ...prev,
        [interviewId]: "Failed to delete interview",
      }));
    } finally {
      setDeletingHistoryByInterview((prev) => ({
        ...prev,
        [interviewId]: false,
      }));
      setDeleteConfirmInterviewId(null);
    }
  };

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return;

    setLoading(true);
    try {
      await createRole(token, newRoleName);
      setNewRoleName("");
      await loadRoles();
      showEmailToast("success", "Role created successfully");
    } catch (error) {
      console.error("Error creating role:", error);
      showEmailToast("error", "Failed to create role");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRole = (roleId: string) => {
    setDeleteRoleConfirmId(roleId);
  };

  const handleStartEditRole = (roleId: string) => {
    const roleToEdit = roles.find((item) => item.id === roleId);
    if (!roleToEdit) return;
    setEditingRoleId(roleId);
    setEditRoleName(roleToEdit.name);
    setEditRoleDescription(roleToEdit.description || "");
  };

  const handleCancelEditRole = () => {
    setEditingRoleId(null);
    setEditRoleName("");
    setEditRoleDescription("");
  };

  const handleSaveRole = async (roleId: string) => {
    if (!token) return;
    if (!editRoleName.trim()) return;
    setSavingRoleId(roleId);
    try {
      const data = await updateRole(token, roleId, {
        name: editRoleName.trim(),
        description: editRoleDescription.trim(),
      });
      setRoles((prev) =>
        prev.map((item) => (item.id === roleId ? data.role : item))
      );
      showEmailToast("success", "Role updated");
      handleCancelEditRole();
    } catch (error) {
      console.error("Error updating role:", error);
      showEmailToast("error", "Failed to update role");
    } finally {
      setSavingRoleId(null);
    }
  };

  const handleConfirmDeleteRole = async () => {
    if (!deleteRoleConfirmId) return;

    setDeletingRoleId(deleteRoleConfirmId);
    try {
      await deleteRole(deleteRoleConfirmId);
      await loadRoles();
      showEmailToast("success", "Role deleted");
    } catch (error) {
      console.error("Error deleting role:", error);
      showEmailToast("error", "Failed to delete role");
    } finally {
      setDeletingRoleId(null);
      setDeleteRoleConfirmId(null);
    }
  };

  const generateInterviewLink = async () => {
    const selectedRole = roles.find((r) => r.id === role);
    if (!selectedRole) {
      showEmailToast("error", "Role not found");
      return;
    }

    try {
      const data = await createInterviewSession(
        token,
        selectedRole.id,
        selectedRole.name
      );

      const basePath = interviewMode === "voice" ? "/voice" : "/room";
      const interviewUrl =
        `${window.location.origin}${basePath}` +
        `?sessionId=${data.sessionId}` +
        `&role=${encodeURIComponent(selectedRole.name)}` +
        `&roleId=${selectedRole.id}` +
        `&employer=${encodeURIComponent(String(employer))}` +
        `&accessToken=${encodeURIComponent(data.accessToken)}` +
        `&language=${interviewLanguage}`;

      setLink(interviewUrl);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      setLinkExpiresAt(expiresAt.toISOString());
      setCopied(false);
    } catch (error) {
      console.error("Error creating interview link:", error);
      showEmailToast("error", "Failed to create interview link");
    }
  };

  const showEmailToast = (type: "success" | "error", message: string) => {
    setEmailToast({ type, message });
    setTimeout(() => setEmailToast(null), 2500);
  };

  const handleCopyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      showEmailToast("success", "Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Error copying link:", error);
      showEmailToast("error", "Copy not supported in this window");
    }
  };

  const isValidEmail = (value: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  };

  const getSelectedInviteLink = () => link;
  const linkExpiresLabel = linkExpiresAt
    ? new Date(linkExpiresAt).toLocaleDateString()
    : null;
  const selectedRoleName = roles.find((r) => r.id === role)?.name ?? "Not set";

  const handleOpenEmailConfirm = () => {
    const trimmedEmail = candidateEmail.trim();
    const selectedLink = getSelectedInviteLink();
    if (!trimmedEmail) return;
    if (!selectedLink) return;
    if (!isValidEmail(trimmedEmail)) {
      showEmailToast("error", "Enter a valid email address");
      return;
    }
    setShowConfirm(true);
  };

  const getCandidateEmailForRecord = (rawEmail: string) => {
    const trimmed = rawEmail.trim();
    if (!trimmed) return "";
    return candidateEmailWasPasted ? "N/A" : trimmed;
  };

  const buildInviteLink = (baseLink: string, emailForRecord: string) => {
    if (!emailForRecord) return baseLink;
    try {
      const url = new URL(baseLink);
      url.searchParams.set("candidateEmail", emailForRecord);
      return url.toString();
    } catch {
      return baseLink;
    }
  };

  const handleSendInvite = async () => {
    const trimmedEmail = candidateEmail.trim();
    const selectedLink = getSelectedInviteLink();
    if (!selectedLink || !trimmedEmail) return;
    if (!isValidEmail(trimmedEmail)) {
      showEmailToast("error", "Enter a valid email address");
      return;
    }

    setSending(true);
    try {
      const emailForRecord = getCandidateEmailForRecord(trimmedEmail);
      const inviteLink = buildInviteLink(selectedLink, emailForRecord);
      await sendInterviewInvite(trimmedEmail, employer, inviteLink);
      showEmailToast("success", "Email sent");
      setCandidateEmail("");
      setCandidateEmailWasPasted(false);
      setShowConfirm(false);
    } catch (error) {
      console.error("Error sending invite:", error);
      showEmailToast("error", "Failed to send email");
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
                    <div className="mb-8 space-y-4">
                      <div>
                        <h2 className="text-3xl font-semibold text-slate-900">
                          Generate Interview Link
                        </h2>
                        <p className="text-slate-600 mt-2">
                          Configure the interview, generate a secure link, then
                          optionally send it to your candidate.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Step 1
                          </p>
                          <h3 className="text-lg font-semibold text-slate-900 mt-1">
                            Configure Interview
                          </h3>
                        </div>
                        {/* Role Selector */}
                        <div>
                        <label className="text-sm font-medium text-slate-900 mb-2 block">
                          Candidate Role
                        </label>
                        {roles.length > 0 ? (
                          <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                          >
                            {roles.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                            No roles available. Please add a role first.
                          </div>
                        )}
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                          <p className="text-sm font-medium text-slate-900">
                            Interview Type
                          </p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <button
                              type="button"
                              onClick={() => setInterviewMode("chat")}
                              aria-pressed={interviewMode === "chat"}
                              className={`w-full rounded-xl border p-4 text-left transition-all ${
                                interviewMode === "chat"
                                  ? "border-slate-900 bg-white shadow-sm ring-1 ring-slate-900"
                                  : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                              }`}
                            >
                              <div className="space-y-1">
                                <p className="text-sm font-semibold text-slate-900">
                                  Chat
                                </p>
                                <p className="text-xs text-slate-500">
                                  Text-based interview.
                                </p>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => setInterviewMode("voice")}
                              aria-pressed={interviewMode === "voice"}
                              className={`w-full rounded-xl border p-4 text-left transition-all ${
                                interviewMode === "voice"
                                  ? "border-slate-900 bg-white shadow-sm ring-1 ring-slate-900"
                                  : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                              }`}
                            >
                              <div className="space-y-1">
                                <p className="text-sm font-semibold text-slate-900">
                                  Voice
                                </p>
                                <p className="text-xs text-slate-500">
                                  Real-time voice call.
                                </p>
                              </div>
                            </button>
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                          <p className="text-sm font-medium text-slate-900">
                            Interview Language
                          </p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <button
                              type="button"
                              onClick={() => setInterviewLanguage("en")}
                              aria-pressed={interviewLanguage === "en"}
                              className={`w-full rounded-xl border p-4 text-left transition-all ${
                                interviewLanguage === "en"
                                  ? "border-slate-900 bg-white shadow-sm ring-1 ring-slate-900"
                                  : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                              }`}
                            >
                              <div className="space-y-1">
                                <p className="text-sm font-semibold text-slate-900">
                                  English
                                </p>
                                <p className="text-xs text-slate-500">
                                  Interview conducted in English.
                                </p>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => setInterviewLanguage("zh")}
                              aria-pressed={interviewLanguage === "zh"}
                              className={`w-full rounded-xl border p-4 text-left transition-all ${
                                interviewLanguage === "zh"
                                  ? "border-slate-900 bg-white shadow-sm ring-1 ring-slate-900"
                                  : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                              }`}
                            >
                              <div className="space-y-1">
                                <p className="text-sm font-semibold text-slate-900">
                                  Chinese
                                </p>
                                <p className="text-xs text-slate-500">
                                  Interview conducted in Chinese.
                                </p>
                              </div>
                            </button>
                          </div>
                        </div>
                      </div>
                      </section>

                      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Step 2
                          </p>
                          <h3 className="text-lg font-semibold text-slate-900 mt-1">
                            Generate Link
                          </h3>
                        </div>
                        <button
                          onClick={generateInterviewLink}
                          disabled={roles.length === 0}
                          className="w-full rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 text-white py-4 text-base font-semibold shadow-lg hover:from-slate-800 hover:via-slate-800 hover:to-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Generate Interview Link
                        </button>

                        {link && (
                          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-emerald-900">
                                  Interview Link Ready
                                </p>
                                <p className="text-xs text-emerald-800 mt-1">
                                  {interviewMode === "voice" ? "Voice" : "Chat"} interview in{" "}
                                  {interviewLanguage === "zh" ? "Chinese" : "English"}.
                                </p>
                              </div>
                              <div className="flex flex-col sm:flex-row gap-2">
                                <button
                                  type="button"
                                  onClick={handleCopyLink}
                                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                                    copied
                                      ? "bg-emerald-700 text-white"
                                      : "bg-slate-900 text-white hover:bg-slate-800"
                                  }`}
                                >
                                  {copied ? "Copied" : "Copy Link"}
                                </button>
                              </div>
                            </div>
                            <div className="text-xs text-emerald-900/80">
                              {linkExpiresLabel
                                ? `Link expires on ${linkExpiresLabel}.`
                                : "Link expires in 7 days."}
                            </div>
                          </div>
                        )}
                      </section>

                      <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-6 shadow-sm space-y-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Step 3 (Optional)
                          </p>
                          <h3 className="text-lg font-semibold text-slate-900 mt-1">
                            Send to Candidate
                          </h3>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-3 text-xs text-slate-600">
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                            Role:{" "}
                            <span className="font-semibold text-slate-900">
                              {selectedRoleName}
                            </span>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 capitalize">
                            Type:{" "}
                            <span className="font-semibold text-slate-900">
                              {interviewMode}
                            </span>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                            Language:{" "}
                            <span className="font-semibold text-slate-900">
                              {interviewLanguage === "zh" ? "Chinese" : "English"}
                            </span>
                          </div>
                        </div>

                        {!link && (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                            Generate the interview link above before sending an email.
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-3">
                          <input
                            type="email"
                            placeholder="Candidate email"
                            value={candidateEmail}
                            onChange={(e) => {
                              setCandidateEmail(e.target.value);
                              if (!e.target.value) {
                                setCandidateEmailWasPasted(false);
                              }
                            }}
                            onPaste={() => setCandidateEmailWasPasted(true)}
                            disabled={!link}
                            className="flex-1 border border-slate-300 rounded-xl px-4 py-3 text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
                          />
                          <button
                            onClick={handleOpenEmailConfirm}
                            disabled={!link || !candidateEmail.trim()}
                            className="w-full sm:w-auto bg-slate-800 text-white px-6 py-3 rounded-xl hover:bg-slate-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Send Interview Link
                          </button>
                        </div>
                      </section>
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
                        <p className="mt-2 text-xs text-slate-500">
                          Description will be generated automatically.
                        </p>
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
                                {editingRoleId === r.id ? (
                                  <div className="space-y-3">
                                    <div>
                                      <label className="text-xs font-medium text-slate-700 block mb-1">
                                        Role Name
                                      </label>
                                      <input
                                        type="text"
                                        value={editRoleName}
                                        onChange={(event) =>
                                          setEditRoleName(event.target.value)
                                        }
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs font-medium text-slate-700 block mb-1">
                                        Description
                                      </label>
                                      <textarea
                                        rows={3}
                                        value={editRoleDescription}
                                        onChange={(event) =>
                                          setEditRoleDescription(event.target.value)
                                        }
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <h4 className="font-medium text-slate-900">
                                      {r.name}
                                    </h4>
                                    {r.description && (
                                      <p className="text-sm text-slate-600 mt-1">
                                        {r.description}
                                      </p>
                                    )}
                                  </>
                                )}
                              </div>
                              <div className="ml-4 flex flex-col items-end gap-2">
                                {editingRoleId === r.id ? (
                                  <>
                                    <button
                                      onClick={() => handleSaveRole(r.id)}
                                      disabled={savingRoleId === r.id || !editRoleName.trim()}
                                      className="text-emerald-700 hover:text-emerald-900 text-sm font-medium disabled:opacity-50"
                                    >
                                      {savingRoleId === r.id ? "Saving..." : "Save"}
                                    </button>
                                    <button
                                      onClick={handleCancelEditRole}
                                      className="text-slate-500 hover:text-slate-700 text-sm font-medium"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => handleStartEditRole(r.id)}
                                      className="text-slate-700 hover:text-slate-900 text-sm font-medium"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteRole(r.id)}
                                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                                    >
                                      Delete
                                    </button>
                                  </>
                                )}
                              </div>
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
                          typeof interview.rating === "number"
                            ? `${interview.rating}/10`
                            : interview.status === "completed"
                              ? "Pending"
                              : "Not rated";
                        const languageRatingDisplay =
                          typeof interview.language_rating === "number"
                            ? `${interview.language_rating}/10`
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
                                    Email: {interview.candidate_email || "N/A"}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    Started: {startedAt ? new Date(startedAt).toLocaleString() : "Unknown"}
                                  </p>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  <span
                                    className={`text-xs px-2 py-1 rounded-full ${
                                      interview.status === "completed"
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-amber-100 text-amber-700"
                                    }`}
                                  >
                                    {interview.status === "completed" ? "Completed" : "In progress"}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      setDeleteConfirmInterviewId(interview.id);
                                    }}
                                    disabled={deletingHistoryByInterview[interview.id]}
                                    className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-red-700 hover:bg-red-100 disabled:opacity-50"
                                  >
                                    {deletingHistoryByInterview[interview.id]
                                      ? "Deleting..."
                                      : "Delete"}
                                  </button>
                                </div>
                              </div>
                            </summary>

                            <div className="mt-4 space-y-3">
                              <div className="rounded-md bg-slate-50 border border-slate-200 p-3">
                                <p className="text-xs text-slate-600">
                                  <span className="font-medium text-slate-900">AI Rating:</span>{" "}
                                  {ratingDisplay}
                                </p>
                                <p className="text-xs text-slate-600 mt-1">
                                  <span className="font-medium text-slate-900">
                                    Language Skill:
                                  </span>{" "}
                                  {languageRatingDisplay}
                                </p>
                                <p className="text-xs text-slate-600 mt-1">
                                  {interview.rating_comment ||
                                    (interview.status === "completed"
                                      ? "Rating comment pending."
                                      : "Rating will be generated after completion.")}
                                </p>
                                {interview.language_rating_comment && (
                                  <p className="text-xs text-slate-600 mt-1">
                                    {interview.language_rating_comment}
                                  </p>
                                )}
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

      {emailToast && (
        <div className="fixed bottom-6 right-6 space-y-2 z-50">
          {emailToast && (
            <div
              className={`px-4 py-2.5 rounded-lg text-sm shadow-lg text-white ${
                emailToast.type === "success" ? "bg-emerald-600" : "bg-red-600"
              }`}
            >
              {emailToast.message}
            </div>
          )}
        </div>
      )}

      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">
              Confirm Email
            </h3>
            <p className="text-sm text-slate-600">
              Send {interviewMode} interview link to:
            </p>
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

      {deleteRoleConfirmId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">
              Delete Role
            </h3>
            <p className="text-sm text-slate-600">
              This will permanently delete
              {" "}
              {roles.find((item) => item.id === deleteRoleConfirmId)?.name ||
                "this role"}
              .
            </p>
            <p className="text-sm text-red-600">
              This action cannot be undone.
            </p>
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setDeleteRoleConfirmId(null)}
                className="flex-1 border border-slate-300 rounded-lg py-2 text-sm text-black hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteRole}
                disabled={deletingRoleId === deleteRoleConfirmId}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm hover:bg-red-700 disabled:opacity-50"
              >
                {deletingRoleId === deleteRoleConfirmId
                  ? "Deleting..."
                  : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmInterviewId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">
              Delete Interview
            </h3>
            <p className="text-sm text-slate-600">
              This will remove the interview session and all chat messages for
              {" "}
              {interviews.find((item) => item.id === deleteConfirmInterviewId)
                ?.candidate_name || "this candidate"}
              .
            </p>
            <p className="text-sm text-red-600">
              This action cannot be undone.
            </p>
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setDeleteConfirmInterviewId(null)}
                className="flex-1 border border-slate-300 rounded-lg py-2 text-sm text-black hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  deleteConfirmInterviewId &&
                  handleDeleteInterview(deleteConfirmInterviewId)
                }
                disabled={
                  !!deletingHistoryByInterview[deleteConfirmInterviewId]
                }
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm hover:bg-red-700 disabled:opacity-50"
              >
                {deletingHistoryByInterview[deleteConfirmInterviewId]
                  ? "Deleting..."
                  : "Delete"}
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
