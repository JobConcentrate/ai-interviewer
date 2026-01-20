import { NextResponse } from "next/server";
import { interviewService } from "@/server/services/interview.service";

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
      accessToken
    );
    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json({
      message: `Server error: ${err instanceof Error ? err.message : String(err)}`,
      ended: true
    }, { status: 500 });
  }
}
