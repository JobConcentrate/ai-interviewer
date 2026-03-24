import { NextResponse } from "next/server";
import { interviewService } from "@/server/services/interview.service";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const {
      message,
      sessionId,
      role,
      employer,
      token,
      roleId,
      candidateEmail,
      accessToken,
      startInterview,
      language,
    } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ message: "No sessionId provided", ended: true }, { status: 400 });
    }

    const result = await interviewService.handleMessage(
      sessionId,
      message,
      role,
      employer,
      token,
      roleId,
      candidateEmail,
      accessToken,
      startInterview,
      language
    );
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Interview message error:", err);
    return NextResponse.json(
      {
        message: `Server error: ${message}`,
        ended: true,
      },
      { status: 500 }
    );
  }
}
