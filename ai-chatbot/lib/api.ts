import { Interview, InterviewMessage, Role } from "./supabase";

export async function sendInterviewMessage(
  message: string,
  sessionId: string,
  role?: string,
  employer?: string,
  token?: string,
  roleId?: string
) {
  const res = await fetch("/api/interview/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, sessionId, role, employer, token, roleId })
  });

  if (!res.ok) throw new Error("API error");

  return res.json();
}

export async function fetchPreviousChat(
  sessionId: string,
  role?: string,
  employer?: string,
  token?: string,
  roleId?: string
) {
  const res = await fetch("/api/interview/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "", sessionId, role, employer, token, roleId })
  });

  if (!res.ok) throw new Error("Failed to fetch previous chat");

  return res.json();
}

// Admin Role API calls
export async function fetchRoles(token: string): Promise<{ roles: Role[] }> {
  const response = await fetch(`/api/admin/roles?token=${token}`);
  if (!response.ok) throw new Error("Failed to fetch roles");
  return response.json();
}

export async function createRole(
  token: string,
  name: string,
  description: string
): Promise<{ role: Role }> {
  const response = await fetch("/api/admin/roles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, name, description }),
  });
  if (!response.ok) throw new Error("Failed to create role");
  return response.json();
}

export async function deleteRole(roleId: string): Promise<{ success: boolean }> {
  const response = await fetch(`/api/admin/roles?roleId=${roleId}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete role");
  return response.json();
}

// Admin Invite API call
export async function sendInterviewInvite(
  candidateEmail: string,
  employer: string,
  interviewLink: string
): Promise<{ success: boolean }> {
  const response = await fetch("/api/admin/send-invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      candidateEmail,
      employer,
      interviewLink,
    }),
  });
  if (!response.ok) throw new Error("Failed to send invite");
  return response.json();
}

export async function fetchInterviews(
  token: string
): Promise<{ interviews: Interview[] }> {
  const response = await fetch(`/api/admin/interviews?token=${encodeURIComponent(token)}`);
  if (!response.ok) throw new Error("Failed to fetch interviews");
  return response.json();
}

export async function fetchInterviewMessages(
  token: string,
  interviewId: string
): Promise<{ messages: InterviewMessage[] }> {
  const response = await fetch(
    `/api/admin/interview-messages?token=${encodeURIComponent(token)}&interviewId=${encodeURIComponent(interviewId)}`
  );
  if (!response.ok) throw new Error("Failed to fetch interview messages");
  return response.json();
}
