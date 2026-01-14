import { buildInterviewerPrompt } from "../prompts/interviewer.prompt";
import {
  InterviewState,
  HistoryItem,
  AiReply,
  OpenAiResponse,
  InterviewRating,
} from "../state/interview.state";

export class OpenAiService {
  async getReply(message: string, state: InterviewState): Promise<AiReply> {
    const messages: { role: string; content: string }[] = [
      { role: "system", content: buildInterviewerPrompt(state) },
      ...state.history.map((h: HistoryItem) => ({ role: h.role, content: h.message })),
      ...(message ? [{ role: "user", content: message }] : [])
    ];

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
        return {
          message: `OpenAI API Error: ${json.error.message}`,
          questionAnswered: false
        };
      }

      if (!json.choices || !Array.isArray(json.choices) || json.choices.length === 0) {
        return { message: "OpenAI returned no response", questionAnswered: false };
      }

      const content: string = json.choices[0].message?.content ?? "";

      const answered: boolean = content.includes("CountAnswer: YES");
      const cleanedMessage: string = content.replace(/CountAnswer:.*/g, "").trim();

      return { message: cleanedMessage, questionAnswered: answered };
    } catch (err: unknown) {
      return {
        message: `OpenAI request failed: ${err instanceof Error ? err.message : String(err)}`,
        questionAnswered: false
      };
    }
  }

  async getInterviewRating(state: InterviewState): Promise<InterviewRating | null> {
    const systemPrompt = [
      "You are an interview evaluator.",
      "Review the full transcript and assign a performance rating.",
      "Return strict JSON only: {\"rating\": number, \"comment\": \"...\"}.",
      "Rating must be an integer from 1 to 10.",
      "Comment must be concise (max 240 characters) and mention strengths and weaknesses.",
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

  private parseRating(content: string): InterviewRating | null {
    const trimmed = content.trim().replace(/^```json/i, "").replace(/^```/i, "").replace(/```$/i, "").trim();
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    const jsonText = start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed;

    try {
      const parsed = JSON.parse(jsonText) as { rating?: number | string; comment?: string };
      const rawRating = typeof parsed.rating === "number" ? parsed.rating : Number.parseInt(String(parsed.rating), 10);
      if (!Number.isFinite(rawRating)) return null;

      const rating = Math.min(10, Math.max(1, Math.round(rawRating)));
      const comment = typeof parsed.comment === "string" ? parsed.comment.trim() : "";
      const normalizedComment = comment.slice(0, 240);

      return { rating, comment: normalizedComment };
    } catch {
      return null;
    }
  }
}

export const openAiService = new OpenAiService();
