import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

/**
 * Client-side middleware that attaches the user's auth token
 * to server function requests.
 */
export const withAuthHeaders = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    let token: string | null = null;
    if (typeof window !== "undefined") {
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token ?? null;
    }

    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  })
  .server(async ({ next }) => {
    return next();
  });
