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
    roleId?: string,
    candidateEmail?: string,
    accessToken?: string,
    language?: "en" | "zh"
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
    if (language && !state.language) state.language = language;

    if (!state.loadedFromDb && (token || accessToken)) {
      let interview = null;

      if (token) {
        const employerRecord = await dbService.getOrCreateEmployer(
          token,
          employer ?? token
        );

        if (!state.employer) state.employer = employerRecord.name;
        state.employerId = employerRecord.id;

        interview = await dbService.getInterviewBySession(sessionId);

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
      } else if (accessToken) {
        interview = await dbService.getInterviewBySessionAndAccessToken(
          sessionId,
          accessToken
        );
        if (!interview) {
          throw new Error("Interview not found");
        }
      }

      if (interview) {
        state.interviewId = interview.id;
        state.startedAt = interview.started_at ?? null;
        if (interview.role_label && !state.role) {
          state.role = interview.role_label;
        }
        if (interview.candidate_name && !state.candidateName) {
          state.candidateName = interview.candidate_name;
        }
        if (interview.candidate_email && !state.candidateEmail) {
          state.candidateEmail = interview.candidate_email;
        }
        state.ended = interview.status === "completed";

        const messages = await dbService.getMessagesByInterview(interview.id);
        if (messages.length > 0 && state.history.length === 0) {
          state.history = messages.map(m => ({ role: m.role, message: m.message }));
        }

        const normalizedCandidateEmail = candidateEmail?.trim();
        if (normalizedCandidateEmail && !state.candidateEmail) {
          state.candidateEmail = normalizedCandidateEmail;
          await dbService.updateInterviewCandidateEmail(
            interview.id,
            normalizedCandidateEmail
          );
        }

        state.loadedFromDb = true;
      }
    }

    return state;
  }

  async handleMessage(
    sessionId: string,
    userMessage = "",
    role?: string,
    employer?: string,
    token?: string,
    roleId?: string,
    candidateEmail?: string,
    accessToken?: string,
    startInterview?: boolean,
    language?: "en" | "zh"
  ): Promise<{ message: string; messages?: Message[]; ended: boolean }> {
    const state = await this.getState(
      sessionId,
      role,
      employer,
      token,
      roleId,
      candidateEmail,
      accessToken,
      language
    );
    if (!state.language) state.language = language ?? "en";

    const strings =
      state.language === "zh"
        ? {
            greetingName: (name: string, employerName: string) =>
              `你好，${name}！欢迎参加你在${employerName}的面试。准备好开始了吗？`,
            greetingNoName: (employerName: string) =>
              `你好！欢迎参加你在${employerName}的面试。为了开始，请告诉我你的全名。`,
            introName: (name: string) => `谢谢，${name}。请简单介绍一下你自己。`,
            introNoName: "谢谢。请简单介绍一下你自己。",
            interviewEnded: "面试已结束。谢谢。",
            concluded: "面试已结束。",
          }
        : {
            greetingName: (name: string, employerName: string) =>
              `Hello ${name}! Welcome to your interview with ${employerName}. Are you ready to begin?`,
            greetingNoName: (employerName: string) =>
              `Hello! Welcome to your interview with ${employerName}. To get started, what is your full name?`,
            introName: (name: string) =>
              `Thanks, ${name}. Could you briefly introduce yourself?`,
            introNoName: "Thanks. Could you briefly introduce yourself?",
            interviewEnded: "The interview has ended. Thank you.",
            concluded: "The interview has concluded.",
          };

    const hasUserMessage = Boolean(userMessage?.trim());
    const shouldStart = Boolean(startInterview) || hasUserMessage;
    if (shouldStart && state.interviewId && !state.startedAt) {
      await dbService.markInterviewStarted(state.interviewId);
      state.startedAt = new Date().toISOString();
    }

    /* ---------- INITIAL GREETING ---------- */
    if (state.history.length === 0 && !userMessage) {
      const employerName =
        state.employer ?? (state.language === "zh" ? "我们的公司" : "our company");
      const greeting = state.candidateName
        ? strings.greetingName(state.candidateName, employerName)
        : strings.greetingNoName(employerName);

      state.history.push({ role: "assistant", message: greeting });
      await this.persistMessage(state, "assistant", greeting);
      return { message: greeting, messages: this.mapHistory(state), ended: false };
    }

    /* ---------- INTRO ---------- */
    if (state.history.length === 1 && userMessage) {
      const candidateName = this.extractCandidateName(userMessage);
      if (candidateName && !state.candidateName) {
        state.candidateName = candidateName;
        if (state.interviewId) {
          await dbService.updateInterviewCandidateName(
            state.interviewId,
            candidateName
          );
        }
      }
      const intro = state.candidateName
        ? strings.introName(state.candidateName)
        : strings.introNoName;
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
      return { message: strings.interviewEnded, ended: true };

    /* ---------- AI RESPONSE ---------- */
    const aiReply: AiReply = await openAiService.getReply(userMessage, state);
    const aiMessage = aiReply.interviewEnded
      ? (aiReply.message
          ? `${aiReply.message}\n\n${strings.concluded}`
          : strings.concluded)
      : aiReply.message;

    state.history.push({ role: "user", message: userMessage });
    state.history.push({ role: "assistant", message: aiMessage });
    await this.persistMessage(state, "user", userMessage);
    await this.persistMessage(state, "assistant", aiMessage);

    if (aiReply.questionAnswered) state.questionsAskedInStage++;
    this.advanceStageIfNeeded(state);

    if (aiReply.interviewEnded || state.currentStage >= InterviewStage.Ended) {
      state.ended = true;
      if (state.interviewId) {
        await dbService.updateInterviewStatus(state.interviewId, "completed");
        if (!state.ratingRequested) {
          state.ratingRequested = true;
          void this.generateRating(state);
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

  private async generateRating(state: InterviewState) {
    if (!state.interviewId) return;

    const rating = await openAiService.getInterviewRating(state);
    if (rating) {
      await dbService.updateInterviewRating(
        state.interviewId,
        rating.rating,
        rating.comment || null,
        rating.languageRating ?? null,
        rating.languageComment ?? null
      );
      return;
    }

    await dbService.updateInterviewRatingComment(
      state.interviewId,
      "Failed to generate rating."
    );
  }

  private extractCandidateName(input: string): string {
    const trimmed = input.trim().replace(/\s+/g, " ");
    if (!trimmed) return "";

    const prefixes = [
      /^my name is\s+/i,
      /^i am\s+/i,
      /^i'm\s+/i,
      /^this is\s+/i,
      /^its\s+/i,
      /^it's\s+/i,
    ];

    let name = trimmed;
    for (const prefix of prefixes) {
      if (prefix.test(name)) {
        name = name.replace(prefix, "");
        break;
      }
    }

    name = name.replace(/[,.;!?].*$/, "").trim();

    if (!name) return trimmed;
    return name.length > 80 ? name.slice(0, 80) : name;
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
