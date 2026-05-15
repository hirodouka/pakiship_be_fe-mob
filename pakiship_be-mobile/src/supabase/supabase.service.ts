import { Injectable } from "@nestjs/common";
import { createClient } from "@supabase/supabase-js";

@Injectable()
export class SupabaseService {
  private readonly supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  private readonly supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  private readonly supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  constructor() {
    if (!this.supabaseUrl) {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
    }

    if (!this.supabaseAnonKey) {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }
  }

  createServerClient() {
    return createClient(this.supabaseUrl!, this.supabaseAnonKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  createAdminClient() {
    if (!this.supabaseServiceRoleKey) {
      throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
    }

    return createClient(this.supabaseUrl!, this.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
}
