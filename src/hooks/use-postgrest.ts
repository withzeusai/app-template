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
          "Content-Type": "application/json",
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

  const token = user?.id_token;
  useEffect(() => {
    if (token) {
      setPostgrest(
        postgrestWithHeaders({
          Authorization: `Bearer ${token}`,
        }),
      );
    }
  }, [token]);

  return postgrest;
}
