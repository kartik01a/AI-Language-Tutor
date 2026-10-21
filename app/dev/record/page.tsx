import { notFound } from "next/navigation";
import prompts from "@/eval/prompts/ja.json";
import { ClipRecorder } from "@/components/dev/ClipRecorder";

export const metadata = { title: "Record clips (dev)" };

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ClipRecorder prompts={prompts.prompts} />;
}
