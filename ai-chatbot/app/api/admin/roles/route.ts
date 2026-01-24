import { NextRequest, NextResponse } from "next/server";
import { dbService } from "@/lib/db.service";
import { openAiService } from "@/server/services/openai.service";

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

    const roles = await dbService.getRolesByEmployer(employer.id);
    return NextResponse.json({ roles });
  } catch (error) {
    console.error("Error fetching roles:", error);
    return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { token, name, description } = await request.json();

    if (!token || !name) {
      return NextResponse.json(
        { error: "Token and name required" },
        { status: 400 }
      );
    }

    const employer = await dbService.getOrCreateEmployer(token, token); // Use token as name for now
    let roleDescription = description;
    if (!roleDescription) {
      roleDescription = await openAiService.generateRoleDescription(
        name,
        employer.name
      );
      if (!roleDescription) {
        return NextResponse.json(
          { error: "Failed to generate role description" },
          { status: 500 }
        );
      }
    }
    const role = await dbService.createRole(employer.id, name, roleDescription);

    return NextResponse.json({ role });
  } catch (error) {
    console.error("Error creating role:", error);
    return NextResponse.json({ error: "Failed to create role" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const roleId = request.nextUrl.searchParams.get("roleId");

  if (!roleId) {
    return NextResponse.json({ error: "Role ID required" }, { status: 400 });
  }

  try {
    await dbService.deleteRole(roleId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting role:", error);
    return NextResponse.json({ error: "Failed to delete role" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { token, roleId, name, description } = await request.json();

    if (!token || !roleId) {
      return NextResponse.json(
        { error: "Token and roleId required" },
        { status: 400 }
      );
    }

    const employer = await dbService.getEmployerByToken(token);
    if (!employer) {
      return NextResponse.json({ error: "Employer not found" }, { status: 404 });
    }

    const role = await dbService.getRoleById(roleId);
    if (!role || role.employer_id !== employer.id) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    const updated = await dbService.updateRole(roleId, name, description);
    return NextResponse.json({ role: updated });
  } catch (error) {
    console.error("Error updating role:", error);
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }
}
