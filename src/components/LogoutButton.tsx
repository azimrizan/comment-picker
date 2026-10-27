"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch("/api/login", { method: "DELETE" });
        router.push("/login");
        router.refresh();
      }}
      className="rounded-lg px-3 py-1.5 text-white/60 transition hover:bg-white/10 hover:text-kbfc-yellow"
    >
      Log out
    </button>
  );
}
