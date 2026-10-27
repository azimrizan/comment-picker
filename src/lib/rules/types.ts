export type Status = "pass" | "fail" | "review";
export type ParticipantStatus = "eligible" | "rejected" | "review";

interface Base {
  id: string;
  enabled: boolean;
}

export interface DeadlineRule extends Base {
  type: "deadline";
  start: string | null; // ISO
  end: string | null; // ISO
}

export interface MustFollowRule extends Base {
  type: "must_follow";
}

export interface MentionsRule extends Base {
  type: "mentions";
  min: number;
  max: number | null;
  excludeSelf: boolean;
  excludeHost: boolean;
  excludeAccounts: string[];
}

export interface KeywordsRule extends Base {
  type: "keywords";
  terms: string[];
  mode: "all" | "any";
}

export interface ForbiddenWordsRule extends Base {
  type: "forbidden_words";
  terms: string[];
}

export interface MinWordsRule extends Base {
  type: "min_words";
  count: number;
}

export interface ExcludeUsersRule extends Base {
  type: "exclude_users";
  usernames: string[];
}

export interface NotHiddenRule extends Base {
  type: "not_hidden";
}

export interface ScorePredictionRule extends Base {
  type: "score_prediction";
  homeTeam: string;
  homeAliases: string[];
  awayTeam: string;
  awayAliases: string[];
  homeScore: number | null; // actual result, filled in after the match
  awayScore: number | null;
  multiple: "review" | "fail"; // comment contains two different scores
  useAI: boolean;
}

export interface AnswerRule extends Base {
  type: "answer";
  label: string; // e.g. "First goal scorer"
  correct: string[]; // one answer per entry, aliases separated by "|"
  others: string[]; // other options (used to detect hedged answers)
  mode: "any" | "all";
  multiple: "review" | "fail";
  fuzzy: boolean;
}

export type Rule =
  | DeadlineRule
  | MustFollowRule
  | MentionsRule
  | KeywordsRule
  | ForbiddenWordsRule
  | MinWordsRule
  | ExcludeUsersRule
  | NotHiddenRule
  | ScorePredictionRule
  | AnswerRule;

export type RuleType = Rule["type"];

export interface ContestRules {
  includeReplies: boolean;
  entryPolicy: "best" | "first_only" | "disqualify_multiple";
  rules: Rule[];
}

export interface RuleResult {
  ruleId: string;
  type: RuleType;
  status: Status;
  reason: string;
  evidence?: Record<string, unknown>;
  aiEligible?: boolean;
}

export const RULE_CATALOG: Record<RuleType, { label: string; description: string }> = {
  deadline: {
    label: "Comment time window",
    description: "Comment must be posted between the start and end time.",
  },
  must_follow: {
    label: "Must follow the account",
    description: "Commenter must appear in the uploaded followers export.",
  },
  mentions: {
    label: "Tag friends",
    description: "Comment must @mention a minimum number of distinct accounts.",
  },
  keywords: {
    label: "Required hashtags / words",
    description: "Comment must contain all (or any) of these words or hashtags.",
  },
  forbidden_words: {
    label: "Forbidden words",
    description: "Reject comments containing any of these words.",
  },
  min_words: {
    label: "Minimum words",
    description: "Comment must have at least N words (mentions not counted).",
  },
  exclude_users: {
    label: "Excluded accounts",
    description: "These accounts can never win (admins, past winners, etc.).",
  },
  not_hidden: {
    label: "Not hidden",
    description: "Reject comments that are hidden on the post.",
  },
  score_prediction: {
    label: "Correct score prediction",
    description: "Comment must predict the exact final score.",
  },
  answer: {
    label: "Correct answer (scorer, MOTM…)",
    description: "Comment must name the correct answer, e.g. first goal scorer.",
  },
};

let counter = 0;
export function newRuleId() {
  counter += 1;
  return `r${Date.now().toString(36)}${counter}`;
}

export function defaultRule(type: RuleType): Rule {
  const base = { id: newRuleId(), enabled: true };
  switch (type) {
    case "deadline":
      return { ...base, type, start: null, end: null };
    case "must_follow":
      return { ...base, type };
    case "mentions":
      return { ...base, type, min: 2, max: null, excludeSelf: true, excludeHost: true, excludeAccounts: [] };
    case "keywords":
      return { ...base, type, terms: [], mode: "all" };
    case "forbidden_words":
      return { ...base, type, terms: [] };
    case "min_words":
      return { ...base, type, count: 1 };
    case "exclude_users":
      return { ...base, type, usernames: [] };
    case "not_hidden":
      return { ...base, type };
    case "score_prediction":
      return {
        ...base,
        type,
        homeTeam: "Kerala Blasters",
        homeAliases: ["kbfc", "kerala", "blasters", "kerala blasters", "manjappada", "മഞ്ഞപ്പട", "കേരള", "ബ്ലാസ്റ്റേഴ്സ്"],
        awayTeam: "",
        awayAliases: [],
        homeScore: null,
        awayScore: null,
        multiple: "review",
        useAI: false,
      };
    case "answer":
      return { ...base, type, label: "First goal scorer", correct: [], others: [], mode: "any", multiple: "review", fuzzy: true };
  }
}

/** Rules the simple "Rules & pick" checklist shows; everything else lives under "More rules". */
export const QUICK_RULES: RuleType[] = ["mentions", "keywords", "deadline", "must_follow", "not_hidden", "exclude_users"];

export function defaultContestRules(): ContestRules {
  // Nothing that needs extra setup is on by default, so a new contest can be picked from straight away.
  const off = <R extends Rule>(r: R): R => ({ ...r, enabled: false });
  const mentions = defaultRule("mentions") as MentionsRule;
  return {
    includeReplies: false,
    entryPolicy: "best",
    rules: [
      off({ ...mentions, min: 1 }),
      off(defaultRule("keywords")),
      off(defaultRule("deadline")),
      off(defaultRule("must_follow")),
      defaultRule("not_hidden"),
      defaultRule("exclude_users"),
    ],
  };
}
