// Parses the followers list from Instagram's "Download your information" export
// (Accounts Center → Your information and permissions → Download your information →
//  Some of your information → Followers and following). JSON and HTML formats both work,
// as does a plain list of usernames (one per line / first CSV column).

const USERNAME = /^[a-z0-9._]{1,30}$/;
const PROFILE_URL = /https?:\/\/(?:www\.)?instagram\.com\/(?:_u\/)?([A-Za-z0-9._]{1,30})\/?(?=["'?#\s<]|$)/g;

export class FollowersParseError extends Error {}

function clean(u: string): string | null {
  const s = u.trim().replace(/^@/, "").replace(/\.+$/, "").toLowerCase();
  return USERNAME.test(s) ? s : null;
}

function fromJson(data: unknown, out: Set<string>, fileName: string) {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const keys = Object.keys(data);
    if (keys.some((k) => /following|close_friends|blocked|pending|recently_unfollowed|hide_story/i.test(k))) {
      throw new FollowersParseError(
        `${fileName} looks like a "${keys[0]}" file, not your followers list. Upload followers_1.json (and followers_2.json… if present).`,
      );
    }
  }
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    if (Array.isArray(obj.string_list_data)) {
      for (const item of obj.string_list_data as Record<string, unknown>[]) {
        const v = typeof item.value === "string" ? clean(item.value) : null;
        if (v) out.add(v);
        else if (typeof item.href === "string") {
          for (const m of item.href.matchAll(PROFILE_URL)) {
            const h = clean(m[1]);
            if (h) out.add(h);
          }
        }
      }
      if (typeof obj.title === "string" && obj.title && !(obj.string_list_data as unknown[]).length) {
        const t = clean(obj.title);
        if (t) out.add(t);
      }
      return;
    }
    Object.values(obj).forEach(walk);
  };
  walk(data);
}

export function parseFollowerFile(fileName: string, content: string, out: Set<string>) {
  const trimmed = content.trim();
  if (fileName.toLowerCase().endsWith(".json") || trimmed.startsWith("[") || trimmed.startsWith("{")) {
    let data: unknown;
    try {
      data = JSON.parse(trimmed);
    } catch {
      throw new FollowersParseError(`${fileName} is not valid JSON.`);
    }
    fromJson(data, out, fileName);
    return;
  }
  if (/<html|<a\s/i.test(trimmed)) {
    const title = trimmed.match(/<title>([^<]*)<\/title>/i)?.[1] ?? "";
    if (/following/i.test(title)) throw new FollowersParseError(`${fileName} is the "Following" page, not Followers.`);
    for (const m of trimmed.matchAll(PROFILE_URL)) {
      const u = clean(m[1]);
      if (u) out.add(u);
    }
    return;
  }
  for (const line of trimmed.split(/\r?\n/)) {
    const first = line.split(/[,\t;]/)[0].replace(/^"|"$/g, "");
    const u = clean(first);
    if (u && u !== "username") out.add(u);
  }
}
