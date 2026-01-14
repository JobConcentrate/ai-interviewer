import { InterviewState, InterviewStage, AiReply, Message } from "../state/interview.state";
import { openAiService } from "./openai.service";
import { buildInterviewerPrompt } from "./../prompts/interviewer.prompt";
import { dbService } from "@/lib/db.service";

const interviewStates = new Map<string, InterviewState>();

export class InterviewService {
  private async getState(
    sessionId: string,
    role?: string,
    employer?: string,
    token?: string,
    roleId?: string
  ): Promise<InterviewState> {
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

    if (token && !state.loadedFromDb) {
      const employerRecord = await dbService.getOrCreateEmployer(
        token,
        employer ?? token
      );

      if (!state.employer) state.employer = employerRecord.name;
      state.employerId = employerRecord.id;

      let interview = await dbService.getInterviewBySession(sessionId);

      if (interview && interview.employer_id !== employerRecord.id) {
        throw new Error("Session does not belong to this employer");
      }

      if (!interview) {
        interview = await dbService.createInterview(
          sessionId,
          employerRecord.id,
          roleId,
          role
        );
      } else {
        if (roleId && interview.role_id && interview.role_id !== roleId) {
          throw new Error("Session role does not match interview");
        }

        const shouldUpdateRoleId = roleId && !interview.role_id;
        const shouldUpdateRoleLabel = role && !interview.role_label;

        if (shouldUpdateRoleId || shouldUpdateRoleLabel) {
          await dbService.updateInterviewRole(
            interview.id,
            shouldUpdateRoleId ? roleId : undefined,
            shouldUpdateRoleLabel ? role : undefined
          );
          if (shouldUpdateRoleId) interview.role_id = roleId!;
          if (shouldUpdateRoleLabel) interview.role_label = role!;
        }
      }

      state.interviewId = interview.id;
      state.ended = interview.status === "completed";

      const messages = await dbService.getMessagesByInterview(interview.id);
      if (messages.length > 0 && state.history.length === 0) {
        state.history = messages.map(m => ({ role: m.role, message: m.message }));
      }

      state.loadedFromDb = true;
    }

    return state;
  }

  async handleMessage(
    sessionId: string,
    userMessage = "",
    role?: string,
    employer?: string,
    token?: string,
    roleId?: string
  ): Promise<{ message: string; messages?: Message[]; ended: boolean }> {
    const state = await this.getState(sessionId, role, employer, token, roleId);

    /* ---------- INITIAL GREETING ---------- */
    if (state.history.length === 0 && !userMessage) {
      const greeting = `Hello! Welcome to your interview with ${
        state.employer ?? "our company"
      }. Are you ready to begin?`;

      state.history.push({ role: "assistant", message: greeting });
      await this.persistMessage(state, "assistant", greeting);
      return { message: greeting, messages: this.mapHistory(state), ended: false };
    }

    /* ---------- INTRO ---------- */
    if (state.history.length === 1 && userMessage) {
      const intro = "Great. Could you briefly introduce yourself?";
      state.history.push({ role: "user", message: userMessage });
      state.history.push({ role: "assistant", message: intro });
      await this.persistMessage(state, "user", userMessage);
      await this.persistMessage(state, "assistant", intro);
      state.currentStage = InterviewStage.Introduction;
      return { message: intro, ended: false };
    }

    if (!userMessage)
      return { messages: this.mapHistory(state), message: "", ended: state.ended };

    if (state.ended)
      return { message: "The interview has ended. Thank you.", ended: true };

    /* ---------- AI RESPONSE ---------- */
    const aiReply: AiReply = await openAiService.getReply(userMessage, state);
    const aiMessage = aiReply.message.includes("INTERVIEW_ENDED")
      ? aiReply.message.replace("INTERVIEW_ENDED", "").trim() +
        "\n\nThe interview has concluded."
      : aiReply.message;

    state.history.push({ role: "user", message: userMessage });
    state.history.push({ role: "assistant", message: aiMessage });
    await this.persistMessage(state, "user", userMessage);
    await this.persistMessage(state, "assistant", aiMessage);

    if (aiReply.questionAnswered) state.questionsAskedInStage++;
    this.advanceStageIfNeeded(state);

    if (
      aiReply.message.includes("INTERVIEW_ENDED") ||
      state.currentStage >= InterviewStage.Ended
    ) {
      state.ended = true;
      if (state.interviewId) {
        await dbService.updateInterviewStatus(state.interviewId, "completed");
        const rating = await openAiService.getInterviewRating(state);
        if (rating) {
          await dbService.updateInterviewRating(
            state.interviewId,
            rating.rating,
            rating.comment || null
          );
        }
      }
      return {
        message: aiMessage,
        ended: true,
      };
    }

    return { message: aiMessage, ended: false };
  }

  private mapHistory(state: InterviewState): Message[] {
    return state.history.map(h => ({ role: h.role === "assistant" ? "ai" : "user", content: h.message }));
  }

  private async persistMessage(
    state: InterviewState,
    role: "user" | "assistant",
    message: string
  ) {
    if (!state.interviewId) return;
    await dbService.saveMessage(state.interviewId, role, message);
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
