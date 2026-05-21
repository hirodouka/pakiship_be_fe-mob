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

  async logActivity(
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    descriptionOrBuilder: string | ((fullName: string) => string),
    severity: 'info' | 'warning' | 'error' = 'info',
  ) {
    try {
      const admin = this.createAdminClient();
      
      // Fetch user profile to get full_name
      let fullName = "User";
      const { data: profile } = await admin
        .schema("account")
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();

      if (profile) {
        fullName = profile.full_name || "User";
      }

      const description = typeof descriptionOrBuilder === 'function' 
        ? descriptionOrBuilder(fullName) 
        : descriptionOrBuilder;

      await admin
        .schema("partner")
        .from("activity_logs")
        .insert({
          userId,
          action,
          entityType,
          entityId,
          description,
          severity,
        });

      console.log(`[ActivityLog] Successfully logged action: ${action} for user: ${fullName}`);
    } catch (e) {
      console.error('[SupabaseService.logActivity] Failed:', e);
    }
  }
}
