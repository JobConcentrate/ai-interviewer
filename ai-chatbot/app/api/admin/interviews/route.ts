import { NextRequest, NextResponse } from "next/server";
import { dbService } from "@/lib/db.service";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  try {
    const employer = await dbService.getEmployerByToken(token);
    if (!employer) {
      return NextResponse.json({ error: "Employer not found" }, { status: 404 });
    }

    const interviews = await dbService.getInterviewsByEmployer(employer.id);
    return NextResponse.json({ interviews });
  } catch (error) {
    console.error("Error fetching interviews:", error);
    return NextResponse.json(
      { error: "Failed to fetch interviews" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { token, roleId, roleLabel } = await request.json();

    if (!token || !roleId || !roleLabel) {
      return NextResponse.json(
        { error: "Token, roleId, and roleLabel required" },
        { status: 400 }
      );
    }

    const employer = await dbService.getEmployerByToken(token);
    if (!employer) {
      return NextResponse.json({ error: "Employer not found" }, { status: 404 });
    }

    const sessionId = crypto.randomUUID();
    const accessToken = crypto.randomUUID();

    await dbService.createInterview(
      sessionId,
      employer.id,
      roleId,
      roleLabel,
      accessToken
    );

    return NextResponse.json({ sessionId, accessToken });
  } catch (error) {
    console.error("Error creating interview:", error);
    return NextResponse.json(
      { error: "Failed to create interview" },
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
    await dbService.deleteInterview(interview.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting interview:", error);
    return NextResponse.json(
      { error: "Failed to delete interview" },
      { status: 500 }
    );
  }
}
