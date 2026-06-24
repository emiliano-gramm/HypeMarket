"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "uge-viewer-id";

export function useViewerId(): string | null {
  const [viewerId, setViewerId] = useState<string | null>(null);

  useEffect(() => {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, id);
    }
    setViewerId(id);
  }, []);

  return viewerId;
}
