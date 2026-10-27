import type { ContestRules } from "@/lib/rules/types";

export interface Detail {
  contest: {
    id: number;
    name: string;
    postUrl: string;
    mediaId: string;
    permalink: string | null;
    caption: string | null;
    mediaType: string | null;
    thumbnailUrl: string | null;
    apiCommentsCount: number | null;
    hostUsername: string | null;
    evaluatedAt: string | null;
  };
  rules: ContestRules;
  ruleErrors: string[];
  fetch: {
    status: "idle" | "running" | "done" | "error" | "interrupted";
    fetched: number;
    note: string | null;
    error: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    canResume: boolean;
  };
  stats: { total: number; top_level: number | null; replies: number | null; deleted: number | null; hidden: number | null; users: number };
  followers: { count: number; uploadedAt: string; files: string[] } | null;
  counts: { eligible: number; review: number; rejected: number; total: number; overridden: number };
  draw: {
    status: "committed" | "drawn";
    seedHash: string;
    poolHash: string;
    poolSize: number;
    numWinners: number;
    numBackups: number;
    committedAt: string;
    drawnAt: string | null;
    seed: string | null;
  } | null;
  aiAvailable: boolean;
}

export interface TabProps {
  detail: Detail;
  reload: () => Promise<void>;
}
