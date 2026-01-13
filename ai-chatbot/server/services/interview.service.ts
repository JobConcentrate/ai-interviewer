import { InterviewState, InterviewStage, AiReply, Message } from "../state/interview.state";
import { openAiService } from "./openai.service";
import { buildInterviewerPrompt } from "./../prompts/interviewer.prompt";

const interviewStates = new Map<string, InterviewState>();

export class InterviewService {
  private getState(
    sessionId: string,
    role?: string,
    employer?: string
  ): InterviewState {
    if (!interviewStates.has(sessionId)) {
      const state = new InterviewState();
      if (role) state.role = role;
      if (employer) state.employer = employer;
      interviewStates.set(sessionId, state);
    }

    const state = interviewStates.get(sessionId)!;

    // Safety: only set if missing
    if (role && !state.role) state.role = role;
    if (employer && !state.employer) state.employer = employer;

    return state;
  }

  async handleMessage(
    sessionId: string,
    userMessage = "",
    role?: string,
    employer?: string
  ): Promise<{ message: string; messages?: Message[]; ended: boolean }> {
    const state = this.getState(sessionId, role, employer);

    /* ---------- INITIAL GREETING ---------- */
    if (state.history.length === 0 && !userMessage) {
      const greeting = `Hello! Welcome to your interview with ${
        state.employer ?? "our company"
      }. Are you ready to begin?`;

      state.history.push({ role: "assistant", message: greeting });
      return { message: greeting, messages: this.mapHistory(state), ended: false };
    }

    /* ---------- INTRO ---------- */
    if (state.history.length === 1 && userMessage) {
      const intro = "Great. Could you briefly introduce yourself?";
      state.history.push({ role: "user", message: userMessage });
      state.history.push({ role: "assistant", message: intro });
      state.currentStage = InterviewStage.Introduction;
      return { message: intro, ended: false };
    }

    if (!userMessage)
      return { messages: this.mapHistory(state), message: "", ended: state.ended };

    if (state.ended)
      return { message: "The interview has ended. Thank you.", ended: true };

    /* ---------- AI RESPONSE ---------- */
    const aiReply: AiReply = await openAiService.getReply(userMessage, state);

    state.history.push({ role: "user", message: userMessage });
    state.history.push({ role: "assistant", message: aiReply.message });

    if (aiReply.questionAnswered) state.questionsAskedInStage++;
    this.advanceStageIfNeeded(state);

    if (
      aiReply.message.includes("INTERVIEW_ENDED") ||
      state.currentStage >= InterviewStage.Ended
    ) {
      state.ended = true;
      return {
        message:
          aiReply.message.replace("INTERVIEW_ENDED", "").trim() +
          "\n\nThe interview has concluded.",
        ended: true,
      };
    }

    return { message: aiReply.message, ended: false };
  }

  private mapHistory(state: InterviewState): Message[] {
    return state.history.map(h => ({ role: h.role === "assistant" ? "ai" : "user", content: h.message }));
  }

  private advanceStageIfNeeded(state: InterviewState) {
    const limits = [1, 3, 2, 1];
    if (state.currentStage < limits.length && state.questionsAskedInStage >= limits[state.currentStage]) {
      state.currentStage++;
      state.questionsAskedInStage = 0;
    }
  }

  private getStagePrompt(state: InterviewState): string {
    switch (state.currentStage) {
      case InterviewStage.Introduction:
        return "Hello! Could you briefly introduce yourself?";
      case InterviewStage.SkillsExperience:
        return "Can you describe your skills and relevant experience?";
      case InterviewStage.Technical:
        return buildInterviewerPrompt(state);
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