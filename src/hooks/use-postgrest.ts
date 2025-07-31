import { useEffect, useState } from "react";
import { PostgrestClient } from "@supabase/postgrest-js";

import { useAuth } from "@/hooks/use-auth";

const postgrestWithHeaders = (headers: Record<string, string>) => {
  return new PostgrestClient(import.meta.env.VITE_HERCULES_DATA_API_URL!, {
    fetch: async (...args) => {
      const [url, options = {}] = args;
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          ...headers,
        },
      });
    },
  });
};

export function usePostgrest() {
  const { user } = useAuth();
  const [postgrest, setPostgrest] = useState<PostgrestClient | null>(null);

  const accessToken = user?.access_token;
  useEffect(() => {
    if (accessToken) {
      setPostgrest(
        postgrestWithHeaders({
          Authorization: `Bearer ${accessToken}`,
        }),
      );
    }
  }, [accessToken]);

  return postgrest;
}
