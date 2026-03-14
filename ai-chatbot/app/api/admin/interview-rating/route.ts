import { NextResponse } from "next/server";
import { dbService } from "@/lib/db.service";
import { interviewService } from "@/server/services/interview.service";

export async function POST(request: Request) {
  try {
    const { token, interviewId } = await request.json();

    if (!token || !interviewId) {
      return NextResponse.json(
        { error: "Token and interviewId required" },
        { status: 400 }
      );
    }

    const employer = await dbService.getEmployerByToken(token);
    if (!employer) {
      return NextResponse.json({ error: "Employer not found" }, { status: 404 });
    }

    const interview = await dbService.getInterviewById(interviewId);
    if (!interview || interview.employer_id !== employer.id) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    if (interview.status !== "completed") {
      return NextResponse.json(
        { error: "Interview not completed" },
        { status: 400 }
      );
    }

    await dbService.updateInterviewRatingComment(
      interview.id,
      "Manual retry requested. Retrying rating generation now."
    );

    void interviewService.regenerateRatingForInterview(
      interview.id,
      employer.name
    );

    return NextResponse.json({ started: true });
  } catch (error) {
    console.error("Error retrying interview rating:", error);
    return NextResponse.json(
      { error: "Failed to retry interview rating" },
      { status: 500 }
    );
  }
}
