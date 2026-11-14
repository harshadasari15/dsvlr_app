import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthProvider, FileStore, NewRun, Platform, RunRecord, RunRepository, User } from "./index";

/** Raised for auth/database failures with a user-presentable message. */
export class PlatformError extends Error {}

function toUser(u: { id: string; email?: string | null }): User {
  return { id: u.id, email: u.email ?? "" };
}

export class SupabaseAuth implements AuthProvider {
  constructor(private readonly db: SupabaseClient) {}

  async signUp(email: string, password: string): Promise<User> {
    const { data, error } = await this.db.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw new PlatformError(error.message);
    if (!data.user) throw new PlatformError("Sign up did not return a user.");
    // With "Confirm email" on, there is a user but no session yet.
    if (!data.session) throw new PlatformError("CONFIRM_EMAIL");
    return toUser(data.user);
  }

  async signIn(email: string, password: string): Promise<User> {
    const { data, error } = await this.db.auth.signInWithPassword({ email, password });
    if (error) throw new PlatformError(error.message);
    return toUser(data.user);
  }

  async signOut(): Promise<void> {
    const { error } = await this.db.auth.signOut();
    if (error) throw new PlatformError(error.message);
  }

  async currentUser(): Promise<User | null> {
    const { data } = await this.db.auth.getUser();
    return data.user ? toUser(data.user) : null;
  }
}

interface RunRow {
  id: string;
  user_id: string;
  tool_id: string;
  tool_version: string;
  created_at: string;
  input_names: string[];
  row_counts: Record<string, number>;
  warnings: string[];
  output_path: string | null;
  output_name: string | null;
}

const fromRow = (r: RunRow): RunRecord => ({
  id: r.id,
  userId: r.user_id,
  toolId: r.tool_id,
  toolVersion: r.tool_version,
  createdAt: r.created_at,
  inputNames: r.input_names,
  rowCounts: r.row_counts,
  warnings: r.warnings,
  outputPath: r.output_path,
  outputName: r.output_name,
});

export class SupabaseRunRepository implements RunRepository {
  constructor(private readonly db: SupabaseClient) {}

  async save(run: NewRun): Promise<RunRecord> {
    // user_id is filled by the database default (auth.uid()) and enforced by RLS.
    const { data, error } = await this.db
      .from("runs")
      .insert({
        ...(run.id ? { id: run.id } : {}),
        ...(run.createdAt ? { created_at: run.createdAt } : {}),
        tool_id: run.toolId,
        tool_version: run.toolVersion,
        input_names: run.inputNames,
        row_counts: run.rowCounts,
        warnings: run.warnings,
        output_path: run.outputPath,
        output_name: run.outputName,
      })
      .select()
      .single();
    if (error) throw new PlatformError(error.message);
    return fromRow(data as RunRow);
  }

  async get(id: string): Promise<RunRecord | null> {
    const { data, error } = await this.db.from("runs").select("*").eq("id", id).maybeSingle();
    if (error) throw new PlatformError(error.message);
    return data ? fromRow(data as RunRow) : null;
  }

  async listForUser(_userId: string, limit = 10): Promise<RunRecord[]> {
    // RLS already restricts rows to the signed-in user.
    const { data, error } = await this.db
      .from("runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new PlatformError(error.message);
    return (data as RunRow[]).map(fromRow);
  }

  async listWithOutputBefore(beforeIso: string, limit = 50): Promise<RunRecord[]> {
    const { data, error } = await this.db
      .from("runs")
      .select("*")
      .not("output_path", "is", null)
      .lt("created_at", beforeIso)
      .limit(limit);
    if (error) throw new PlatformError(error.message);
    return (data as RunRow[]).map(fromRow);
  }

  async clearOutput(id: string): Promise<void> {
    const { error } = await this.db.from("runs").update({ output_path: null }).eq("id", id);
    if (error) throw new PlatformError(error.message);
  }
}

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Private Supabase Storage bucket; keys must start with "<user_id>/" (enforced by policies). */
export class SupabaseFileStore implements FileStore {
  constructor(
    private readonly db: SupabaseClient,
    private readonly bucket = "run-outputs",
  ) {}

  async put(key: string, data: ArrayBuffer): Promise<void> {
    const { error } = await this.db.storage.from(this.bucket).upload(key, data, { contentType: XLSX_MIME, upsert: false });
    if (error) throw new PlatformError(error.message);
  }

  async get(key: string): Promise<ArrayBuffer | null> {
    const { data, error } = await this.db.storage.from(this.bucket).download(key);
    if (error || !data) return null;
    return data.arrayBuffer();
  }

  async delete(key: string): Promise<void> {
    const { error } = await this.db.storage.from(this.bucket).remove([key]);
    if (error) throw new PlatformError(error.message);
  }
}

export function createSupabasePlatform(client: SupabaseClient): Platform {
  return {
    auth: new SupabaseAuth(client),
    runs: new SupabaseRunRepository(client),
    files: new SupabaseFileStore(client),
  };
}
