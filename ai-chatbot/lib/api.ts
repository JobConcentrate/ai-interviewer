export async function sendInterviewMessage(message: string, sessionId: string) {
  const res = await fetch("/api/interview/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, sessionId })
  });

  if (!res.ok) throw new Error("API error");

  return res.json();
}

export async function fetchPreviousChat(sessionId: string) {
  const res = await fetch("/api/interview/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "", sessionId }) // empty message fetches current state
  });

  if (!res.ok) throw new Error("Failed to fetch previous chat");

  return res.json();
}

// export async function validateAccess(code: string) {
//   const res = await fetch(
//     "https://localhost:5001/api/interview/validate",
//     {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ code })
//     }
//   );

//   if (!res.ok) {
//     throw new Error("Invalid code");
//   }

//   return res.json() as Promise<{ role: "user" | "admin" }>;
// }

// export async function generateCode() {
//   const res = await fetch("https://localhost:5001/api/interview/generateCode", {
//         method: "POST",
//       });
//   if (!res.ok) throw new Error("Error generating code");
//   return res.json() as Promise<{ code: string }>;
// }

// export async function getLatestCode() {
//   const res = await fetch("https://localhost:5001/api/interview/getCode");
//   if (!res.ok) throw new Error("Error fetching latest code");
//   return res.json() as Promise<{ code: string }>;
// }
