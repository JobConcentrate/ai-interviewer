import { NextRequest, NextResponse } from "next/server";
import { dbService } from "@/lib/db.service";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const interviewId = request.nextUrl.searchParams.get("interviewId");

  if (!token || !interviewId) {
    return NextResponse.json(
      { error: "Token and interviewId required" },
      { status: 400 }
    );
  }

  try {
    const employer = await dbService.getEmployerByToken(token);
    if (!employer) {
      return NextResponse.json({ error: "Employer not found" }, { status: 404 });
    }

    const interview = await dbService.getInterviewById(interviewId);
    if (!interview || interview.employer_id !== employer.id) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    const messages = await dbService.getMessagesByInterview(interview.id);
    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Error fetching interview messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch interview messages" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const interviewId = request.nextUrl.searchParams.get("interviewId");

  if (!token || !interviewId) {
    return NextResponse.json(
      { error: "Token and interviewId required" },
      { status: 400 }
    );
  }

  try {
    const employer = await dbService.getEmployerByToken(token);
    if (!employer) {
      return NextResponse.json({ error: "Employer not found" }, { status: 404 });
    }

    const interview = await dbService.getInterviewById(interviewId);
    if (!interview || interview.employer_id !== employer.id) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    await dbService.deleteMessagesByInterview(interview.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting interview messages:", error);
    return NextResponse.json(
      { error: "Failed to delete interview messages" },
      { status: 500 }
    );
  }
}
