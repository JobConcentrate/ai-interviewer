import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { candidateEmail, employer, interviewLink } = await req.json();

    if (!candidateEmail || !employer || !interviewLink) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const WIX_ACCOUNT_ID = process.env.WIX_ACCOUNT_ID!;
    const WIX_SITE_ID = process.env.WIX_SITE_ID!;
    const WIX_API_KEY = process.env.WIX_API_KEY!;

    // Verify all credentials are present
    if (!WIX_ACCOUNT_ID || !WIX_SITE_ID || !WIX_API_KEY) {
      console.error("Missing credentials:", {
        hasAccountId: !!WIX_ACCOUNT_ID,
        hasSiteId: !!WIX_SITE_ID,
        hasApiKey: !!WIX_API_KEY,
      });
      return NextResponse.json(
        { error: "Missing Wix credentials in environment variables" },
        { status: 500 }
      );
    }

    console.log("Using Site ID:", WIX_SITE_ID);
    console.log("Using Account ID:", WIX_ACCOUNT_ID);
    console.log("API Key exists:", !!WIX_API_KEY);

    const wixApiUrl = `https://www.wixapis.com/wix-data/v2/items`;

    const requestBody = {
      dataCollectionId: "InterviewLinks",
      dataItem: {
        data: {
          candidateEmail,
          employerName: employer,
          interviewLink
        },
      },
    };

    console.log("Request body:", JSON.stringify(requestBody, null, 2));

    const headers = {
      "Content-Type": "application/json",
      "Authorization": WIX_API_KEY,
      "wix-site-id": WIX_SITE_ID,
      "wix-account-id": WIX_ACCOUNT_ID,
    };

    console.log("Request headers:", {
      ...headers,
      Authorization: "***" + WIX_API_KEY.slice(-4), // Only show last 4 chars
    });

    const wixRes = await fetch(wixApiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });

    const responseText = await wixRes.text();
    console.log("Wix Response Status:", wixRes.status);
    console.log("Wix Response:", responseText);

    if (!wixRes.ok) {
      console.error("Wix API Error:", responseText);
      return NextResponse.json(
        { error: "Failed to insert data into Wix", details: responseText },
        { status: 500 }
      );
    }

    const data = JSON.parse(responseText);
    console.log("Successfully added to Wix:", data);

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("Server error:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}