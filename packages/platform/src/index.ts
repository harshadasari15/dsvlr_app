/**
 * Ports (interfaces) the app depends on. Adapters (Supabase now; Postgres,
 * S3, etc. later) implement them and are chosen by NEXT_PUBLIC_PLATFORM_DRIVER.
 * App code must never import a vendor SDK directly.
 */

export interface User {
  id: string;
  email: string;
}

export interface AuthProvider {
  /** Throws PlatformError("CONFIRM_EMAIL") when the account needs email confirmation first. */
  signUp(email: string, password: string): Promise<User>;
  signIn(email: string, password: string): Promise<User>;
  signOut(): Promise<void>;
  currentUser(): Promise<User | null>;
}

export interface RunRecord {
  id: string;
  userId: string;
  toolId: string;
  toolVersion: string;
  createdAt: string; // ISO
  inputNames: string[];
  rowCounts: Record<string, number>;
  warnings: string[];
  /** Key of the stored output in the FileStore, or null when none (never stored / expired). */
  outputPath: string | null;
  /** File name the output was downloaded as (includes the run timestamp). */
  outputName: string | null;
}

export type NewRun = Omit<RunRecord, "id" | "createdAt"> & {
  /** Client-generated id so the output file can be keyed before the row exists. */
  id?: string;
  /** When the run happened (defaults to now). Also used in output file names. */
  createdAt?: string;
};

export interface RunRepository {
  save(run: NewRun): Promise<RunRecord>;
  get(id: string): Promise<RunRecord | null>;
  listForUser(userId: string, limit?: number): Promise<RunRecord[]>;
  /** Runs that still reference an output but are older than `beforeIso`. */
  listWithOutputBefore(beforeIso: string, limit?: number): Promise<RunRecord[]>;
  /** Forget the stored output of a run (after the file was deleted). */
  clearOutput(id: string): Promise<void>;
}

/** Blob storage for run outputs. */
export interface FileStore {
  put(key: string, data: ArrayBuffer): Promise<void>;
  get(key: string): Promise<ArrayBuffer | null>;
  delete(key: string): Promise<void>;
}

export interface Platform {
  auth: AuthProvider;
  runs: RunRepository;
  files?: FileStore;
}

export {
  PlatformError,
  createSupabasePlatform,
  SupabaseAuth,
  SupabaseFileStore,
  SupabaseRunRepository,
} from "./supabase";
