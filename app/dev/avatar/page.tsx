import { readFileSync } from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import { AvatarLab } from "@/components/avatar/AvatarLab";

export const metadata = { title: "Avatar Lab (dev)" };

export default function Page() {
  // Dev-only tool: never exposed in production builds.
  if (process.env.NODE_ENV === "production") notFound();
  const svg = readFileSync(path.join(process.cwd(), "assets/avatars/src/ja-yuki.svg"), "utf8");
  return <AvatarLab svg={svg} />;
}
