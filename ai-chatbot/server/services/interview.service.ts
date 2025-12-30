import { InterviewState, InterviewStage, AiReply, Message } from "../state/interview.state";
import { openAiService } from "./openai.service";

// Map sessionId -> InterviewState
const interviewStates = new Map<string, InterviewState>();

export class InterviewService {
  private getState(sessionId: string): InterviewState {
    if (!interviewStates.has(sessionId)) {
      interviewStates.set(sessionId, new InterviewState());
    }
    return interviewStates.get(sessionId)!;
  }

  async handleMessage(sessionId: string, userMessage = ""): Promise<{ message: string; messages?: Message[]; ended: boolean }> {
    const state = this.getState(sessionId);

    // Auto-send first introduction if history is empty
    if (state.history.length === 0) {
      const intro = this.getStagePrompt(state.currentStage);
      state.history.push({ role: "assistant", message: intro });
      return {
        message: intro,
        messages: state.history.map(h => ({ role: h.role === "assistant" ? "ai" : "user", content: h.message })),
        ended: false
      };
    }

    // Return history if no user message
    if (!userMessage) {
      return {
        messages: state.history.map(h => ({ role: h.role === "assistant" ? "ai" : "user", content: h.message })),
        ended: state.ended,
        message: ""
      };
    }

    if (state.ended) {
      return { message: "The interview has ended. Thank you.", ended: true };
    }

    // Skip / next stage
    const lower = userMessage.toLowerCase();
    if (lower.includes("next stage") || lower.includes("skip")) {
      state.currentStage++;
      state.questionsAskedInStage = 0;
      const prompt = this.getStagePrompt(state.currentStage);
      state.history.push({ role: "assistant", message: prompt });
      return { message: prompt, ended: false };
    }

    // Call AI
    const aiReply: AiReply = await openAiService.getReply(userMessage, state);
    state.history.push({ role: "user", message: userMessage });
    state.history.push({ role: "assistant", message: aiReply.message });

    if (aiReply.questionAnswered) state.questionsAskedInStage++;
    this.advanceStageIfNeeded(state);

    if (aiReply.message.includes("INTERVIEW_ENDED") || state.currentStage > InterviewStage.CandidateQuestions) {
      state.ended = true;
      return {
        message: aiReply.message.replace("INTERVIEW_ENDED", "").trim() + "\n\nThank you. The interview has concluded.",
        ended: true
      };
    }

    return { message: aiReply.message, ended: false };
  }

  private advanceStageIfNeeded(state: InterviewState) {
    const limits = [1, 3, 1, 1];
    if (state.currentStage < limits.length && state.questionsAskedInStage >= limits[state.currentStage]) {
      state.currentStage++;
      state.questionsAskedInStage = 0;
    }
  }

  private getStagePrompt(stage: number): string {
    switch (stage) {
      case InterviewStage.Introduction:
        return "Hello! Could you briefly introduce yourself?";
      case InterviewStage.SkillsExperience:
        return "Can you describe your skills and relevant experience?";
      case InterviewStage.Expectations:
        return "What are your salary expectations?";
      case InterviewStage.CandidateQuestions:
        return "Do you have any questions for us?";
      default:
        return "";
    }
  }
}

export const interviewService = new InterviewService();
