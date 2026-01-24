import { supabase, Employer, Role, Interview, InterviewMessage } from './supabase';

export class DatabaseService {
  // Employer operations
  async getOrCreateEmployer(token: string, name: string): Promise<Employer> {
    const { data } = await supabase
      .from('employers')
      .select('*')
      .eq('token', token)
      .single();
    
    if (data) return data;

    // Create new employer if doesn't exist
    const { data: newEmployer, error: createError } = await supabase
      .from('employers')
      .insert({ token, name })
      .select()
      .single();

    if (createError) throw createError;
    return newEmployer!;
  }

  async getEmployerByToken(token: string): Promise<Employer | null> {
    const { data, error } = await supabase
      .from('employers')
      .select('*')
      .eq('token', token)
      .single();

    if (error) return null;
    return data;
  }

  // Role operations
  async getRolesByEmployer(employerId: string): Promise<Role[]> {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .eq('employer_id', employerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async createRole(employerId: string, name: string, description?: string): Promise<Role> {
    const { data, error } = await supabase
      .from('roles')
      .insert({
        employer_id: employerId,
        name,
        description: description || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data!;
  }

  async deleteRole(roleId: string): Promise<void> {
    const { error } = await supabase
      .from('roles')
      .delete()
      .eq('id', roleId);

    if (error) throw error;
  }

  async updateRole(
    roleId: string,
    name?: string,
    description?: string
  ): Promise<Role> {
    const updates: { name?: string; description?: string | null } = {};
    if (typeof name === "string" && name.trim()) {
      updates.name = name.trim();
    }
    if (typeof description === "string") {
      updates.description = description.trim() || null;
    }

    if (Object.keys(updates).length === 0) {
      const existing = await this.getRoleById(roleId);
      if (!existing) throw new Error("Role not found");
      return existing;
    }

    const { data, error } = await supabase
      .from('roles')
      .update(updates)
      .eq('id', roleId)
      .select()
      .single();

    if (error) throw error;
    return data!;
  }

  async getRoleById(roleId: string): Promise<Role | null> {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .eq('id', roleId)
      .single();

    if (error) return null;
    return data;
  }

  // Interview operations
  async createInterview(
    sessionId: string,
    employerId: string,
    roleId?: string,
    roleLabel?: string,
    accessToken?: string
  ): Promise<Interview> {
    const { data, error } = await supabase
      .from('interviews')
      .insert({
        session_id: sessionId,
        employer_id: employerId,
        role_id: roleId || null,
        role_label: roleLabel || null,
        access_token: accessToken || null,
        started_at: null,
      })
      .select()
      .single();

    if (error) throw error;
    return data!; 
  }

  async getInterviewBySession(sessionId: string): Promise<Interview | null> {
    const { data, error } = await supabase
      .from('interviews')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (error) return null;
    return data;
  }

  async getInterviewBySessionAndAccessToken(
    sessionId: string,
    accessToken: string
  ): Promise<Interview | null> {
    const { data, error } = await supabase
      .from('interviews')
      .select('*')
      .eq('session_id', sessionId)
      .eq('access_token', accessToken)
      .single();

    if (error) return null;
    return data;
  }

  async getInterviewById(interviewId: string): Promise<Interview | null> {
    const { data, error } = await supabase
      .from('interviews')
      .select('*')
      .eq('id', interviewId)
      .single();

    if (error) return null;
    return data;
  }

  async getInterviewsByEmployer(employerId: string): Promise<Interview[]> {
    const { data, error } = await supabase
      .from('interviews')
      .select('*')
      .eq('employer_id', employerId)
      .not('started_at', 'is', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async markInterviewStarted(interviewId: string): Promise<void> {
    const { error } = await supabase
      .from('interviews')
      .update({
        started_at: new Date().toISOString(),
        status: 'in_progress',
      })
      .eq('id', interviewId);

    if (error) throw error;
  }

  async updateInterviewStatus(
    interviewId: string,
    status: 'in_progress' | 'completed'
  ): Promise<void> {
    const { error } = await supabase
      .from('interviews')
      .update({
        status,
        ended_at: status === 'completed' ? new Date().toISOString() : null,
      })
      .eq('id', interviewId);

    if (error) throw error;
  }

  async updateInterviewRating(
    interviewId: string,
    rating: number,
    comment?: string | null,
    languageRating?: number | null,
    languageComment?: string | null
  ): Promise<void> {
    const updates: {
      rating?: number;
      rating_comment?: string | null;
      language_rating?: number | null;
      language_rating_comment?: string | null;
    } = {
      rating,
      rating_comment: comment ?? null,
    };

    if (languageRating !== undefined) {
      updates.language_rating = languageRating;
    }
    if (languageComment !== undefined) {
      updates.language_rating_comment = languageComment ?? null;
    }

    const { error } = await supabase
      .from('interviews')
      .update(updates)
      .eq('id', interviewId);

    if (error) throw error;
  }

  async updateInterviewRatingComment(
    interviewId: string,
    comment?: string | null
  ): Promise<void> {
    const { error } = await supabase
      .from('interviews')
      .update({
        rating_comment: comment ?? null,
        language_rating_comment: comment ?? null,
      })
      .eq('id', interviewId);

    if (error) throw error;
  }

  async updateInterviewCandidateName(
    interviewId: string,
    candidateName: string
  ): Promise<void> {
    const { error } = await supabase
      .from('interviews')
      .update({ candidate_name: candidateName })
      .eq('id', interviewId);

    if (error) throw error;
  }

  async updateInterviewCandidateEmail(
    interviewId: string,
    candidateEmail: string
  ): Promise<void> {
    const { error } = await supabase
      .from('interviews')
      .update({ candidate_email: candidateEmail })
      .eq('id', interviewId);

    if (error) throw error;
  }

  async updateInterviewRole(
    interviewId: string,
    roleId?: string | null,
    roleLabel?: string | null
  ): Promise<void> {
    const updates: { role_id?: string | null; role_label?: string | null } = {};

    if (roleId !== undefined) updates.role_id = roleId;
    if (roleLabel !== undefined) updates.role_label = roleLabel;

    if (Object.keys(updates).length === 0) return;

    const { error } = await supabase
      .from('interviews')
      .update(updates)
      .eq('id', interviewId);

    if (error) throw error;
  }

  // Interview message operations
  async saveMessage(
    interviewId: string,
    role: 'user' | 'assistant',
    message: string
  ): Promise<InterviewMessage> {
    const { data, error } = await supabase
      .from('interview_messages')
      .insert({
        interview_id: interviewId,
        role,
        message,
      })
      .select()
      .single();

    if (error) throw error;
    return data!;
  }

  async getMessagesByInterview(interviewId: string): Promise<InterviewMessage[]> {
    const { data, error } = await supabase
      .from('interview_messages')
      .select('*')
      .eq('interview_id', interviewId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async deleteMessagesByInterview(interviewId: string): Promise<void> {
    const { error } = await supabase
      .from('interview_messages')
      .delete()
      .eq('interview_id', interviewId);

    if (error) throw error;
  }

  async deleteInterview(interviewId: string): Promise<void> {
    const { error } = await supabase
      .from('interviews')
      .delete()
      .eq('id', interviewId);

    if (error) throw error;
  }
}

export const dbService = new DatabaseService();
