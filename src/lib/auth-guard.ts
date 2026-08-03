import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

/**
 * Checks if a user is authenticated using the Supabase JWT.
 * This is intended for use in TanStack Router's beforeLoad guards on the client side.
 * Returns the user object if authenticated, or null otherwise.
 */
export async function requireAuthenticatedUser(): Promise<User | null> {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return user;
  } catch (err) {
    console.error("Auth guard error:", err);
    return null;
  }
}
