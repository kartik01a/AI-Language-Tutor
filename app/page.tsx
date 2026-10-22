import Link from "next/link";
import { PhoneShell } from "@/components/ui/PhoneShell";
import { BubbleIcon } from "@/components/ui/icons";

export default function Home() {
  return (
    <PhoneShell>
      <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-gradient-to-b from-iris-100 to-paper-50 px-8 text-center">
        <span className="flex size-16 items-center justify-center rounded-3xl bg-iris-500 text-white shadow-lg">
          <BubbleIcon width={32} height={32} />
        </span>
        <div>
          <h1 className="font-display text-4xl font-bold text-ink-900">Lactice</h1>
          <p className="mt-2 text-base text-ink-600">Speak Japanese out loud with a tutor who listens, helps when you&apos;re stuck, and only corrects what she&apos;s sure about.</p>
        </div>
        <Link href="/practice" className="rounded-full bg-iris-500 px-8 py-3.5 text-lg font-bold text-white shadow-md transition active:scale-95">
          Start practising
        </Link>
      </main>
    </PhoneShell>
  );
}
