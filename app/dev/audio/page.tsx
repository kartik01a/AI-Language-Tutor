import { notFound } from "next/navigation";
import { AudioSelfTest } from "@/components/avatar/AudioSelfTest";

export const metadata = { title: "Audio self-test (dev)" };

export default async function Page({ searchParams }: { searchParams: Promise<{ auto?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { auto } = await searchParams;
  return <AudioSelfTest auto={auto === "1"} />;
}
