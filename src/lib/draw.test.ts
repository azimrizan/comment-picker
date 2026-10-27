import { describe, expect, it } from "vitest";
import { shuffle } from "./draw";
import { parseFollowerFile } from "./followers";

describe("shuffle", () => {
  it("is deterministic for a seed and a permutation", () => {
    const items = Array.from({ length: 100 }, (_, i) => i);
    const a = shuffle(items, "seed-1");
    expect(shuffle(items, "seed-1")).toEqual(a);
    expect(shuffle(items, "seed-2")).not.toEqual(a);
    expect([...a].sort((x, y) => x - y)).toEqual(items);
  });
  it("is roughly uniform", () => {
    const counts = [0, 0, 0, 0];
    for (let s = 0; s < 8000; s++) counts[shuffle([0, 1, 2, 3], `s${s}`)[0]]++;
    for (const c of counts) expect(Math.abs(c - 2000)).toBeLessThan(200);
  });
});

describe("parseFollowerFile", () => {
  it("reads Instagram JSON export", () => {
    const set = new Set<string>();
    parseFollowerFile("followers_1.json", JSON.stringify([
      { title: "", media_list_data: [], string_list_data: [{ href: "https://www.instagram.com/Fan.One", value: "Fan.One", timestamp: 1 }] },
      { title: "fan_two", string_list_data: [{ href: "https://www.instagram.com/_u/fan_two", timestamp: 1 }] },
    ]), set);
    expect([...set]).toEqual(["fan.one", "fan_two"]);
  });
  it("rejects the following file", () => {
    expect(() => parseFollowerFile("following.json", JSON.stringify({ relationships_following: [] }), new Set())).toThrow(/following/);
  });
  it("reads HTML and plain lists", () => {
    const set = new Set<string>();
    parseFollowerFile("followers_1.html", '<html><title>Followers</title><a target="_blank" href="https://www.instagram.com/abc_1">abc_1</a></html>', set);
    parseFollowerFile("list.txt", "@xyz\nusername\nq.w", set);
    expect([...set]).toEqual(["abc_1", "xyz", "q.w"]);
  });
});
