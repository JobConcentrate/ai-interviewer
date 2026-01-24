import { buildInterviewerPrompt } from "../prompts/interviewer.prompt";
import {
  InterviewState,
  HistoryItem,
  AiReply,
  OpenAiResponse,
  InterviewRating,
} from "../state/interview.state";

export class OpenAiService {
  async generateRoleDescription(
    roleName: string,
    employer?: string
  ): Promise<string | null> {
    const systemPrompt = [
      "You write concise job role descriptions.",
      "Return strict JSON only: {\"description\": \"...\"}.",
      "Keep it professional and specific.",
      "Max 300 characters.",
    ].join(" ");

    const userPrompt = employer
      ? `Role: ${roleName}\nCompany: ${employer}`
      : `Role: ${roleName}`;

    const messages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
      { role: "user", content: "Provide the JSON now." },
    ];

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          messages,
          temperature: 0.3,
        }),
      });

      const json: OpenAiResponse & { error?: { message: string } } =
        await res.json();

      if (json.error) return null;
      if (!json.choices || !Array.isArray(json.choices) || json.choices.length === 0) {
        return null;
      }

      const content: string = json.choices[0].message?.content ?? "";
      const trimmed = content
        .trim()
        .replace(/^```json/i, "")
        .replace(/^```/i, "")
        .replace(/```$/i, "")
        .trim();
      const start = trimmed.indexOf("{");
      const end = trimmed.lastIndexOf("}");
      const jsonText = start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed;
      const parsed = JSON.parse(jsonText) as { description?: string };
      const description =
        typeof parsed.description === "string" ? parsed.description.trim() : "";
      if (!description) return null;
      return description.slice(0, 300);
    } catch {
      return null;
    }
  }

  async getReply(message: string, state: InterviewState): Promise<AiReply> {
    const messages: { role: string; content: string }[] = [
      { role: "system", content: buildInterviewerPrompt(state) },
      ...state.history.map((h: HistoryItem) => ({ role: h.role, content: h.message })),
      ...(message ? [{ role: "user", content: message }] : [])
    ];

    const maxAttempts = 2;
    let lastError = "";

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "gpt-4.1-mini",
            messages,
            temperature: 0.3
          })
        });

        const json: OpenAiResponse & { error?: { message: string } } = await res.json();

        if (json.error) {
          lastError = json.error.message;
        } else if (!json.choices || !Array.isArray(json.choices) || json.choices.length === 0) {
          lastError = "OpenAI returned no response";
        } else {
          const content: string = json.choices[0].message?.content ?? "";

          const ended: boolean = content.includes("INTERVIEW_ENDED");
          const answered: boolean = content.includes("CountAnswer: YES");
          const cleanedMessage: string = content
            .replace(/CountAnswer:.*/g, "")
            .replace(/INTERVIEW_ENDED/g, "")
            .trim();

          return {
            message: cleanedMessage,
            questionAnswered: answered,
            interviewEnded: ended,
          };
        }
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : String(err);
      }

      if (attempt < maxAttempts) {
        await this.sleep(1500);
      }
    }

    return {
      message: `OpenAI request failed: ${lastError || "Unknown error"}`,
      questionAnswered: false,
      interviewEnded: false,
    };
  }

  async getInterviewRating(state: InterviewState): Promise<InterviewRating | null> {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const rating = await this.requestInterviewRating(state);
      if (rating) return rating;

      if (attempt < maxAttempts) {
        await this.sleep(60000);
      }
    }

    return null;
  }

  private async requestInterviewRating(
    state: InterviewState
  ): Promise<InterviewRating | null> {
    const languageLabel =
      state.language === "zh" ? "Chinese (Simplified)" : "English";
    const systemPrompt = [
      "You are an interview evaluator.",
      "Review the full transcript and assign a performance rating.",
      `Also rate the candidate's language skill in ${languageLabel}.`,
      "Return strict JSON only: {\"rating\": number, \"comment\": \"...\", \"language_rating\": number, \"language_comment\": \"...\"}.",
      "Rating must be an integer from 1 to 10.",
      "Language rating must be an integer from 1 to 10.",
      "Comments must be concise (max 240 characters) and mention strengths and weaknesses.",
    ].join(" ");

    const messages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
      ...state.history.map((h: HistoryItem) => ({ role: h.role, content: h.message })),
      { role: "user", content: "Provide the JSON rating now." },
    ];

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          messages,
          temperature: 0.2,
        }),
      });

      const json: OpenAiResponse & { error?: { message: string } } = await res.json();

      if (json.error) {
        return null;
      }

      if (!json.choices || !Array.isArray(json.choices) || json.choices.length === 0) {
        return null;
      }

      const content: string = json.choices[0].message?.content ?? "";
      return this.parseRating(content);
    } catch {
      return null;
    }
  }

  private async sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private parseRating(content: string): InterviewRating | null {
    const trimmed = content.trim().replace(/^```json/i, "").replace(/^```/i, "").replace(/```$/i, "").trim();
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    const jsonText = start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed;

    try {
      const parsed = JSON.parse(jsonText) as {
        rating?: number | string;
        comment?: string;
        language_rating?: number | string;
        languageRating?: number | string;
        language_comment?: string;
        languageComment?: string;
      };
      const rawRating = typeof parsed.rating === "number" ? parsed.rating : Number.parseInt(String(parsed.rating), 10);
      if (!Number.isFinite(rawRating)) return null;

      const rating = Math.min(10, Math.max(1, Math.round(rawRating)));
      const comment = typeof parsed.comment === "string" ? parsed.comment.trim() : "";
      const normalizedComment = comment.slice(0, 240);

      const rawLanguageRating =
        typeof parsed.language_rating === "number"
          ? parsed.language_rating
          : typeof parsed.languageRating === "number"
          ? parsed.languageRating
          : Number.parseInt(
              String(parsed.language_rating ?? parsed.languageRating ?? ""),
              10
            );

      const languageRating = Number.isFinite(rawLanguageRating)
        ? Math.min(10, Math.max(1, Math.round(rawLanguageRating)))
        : undefined;
      const languageCommentRaw =
        typeof parsed.language_comment === "string"
          ? parsed.language_comment
          : typeof parsed.languageComment === "string"
          ? parsed.languageComment
          : "";
      const languageComment = languageCommentRaw.trim().slice(0, 240);

      return {
        rating,
        comment: normalizedComment,
        languageRating,
        languageComment: languageComment || undefined,
      };
    } catch {
      return null;
    }
  }
}

export const openAiService = new OpenAiService();
