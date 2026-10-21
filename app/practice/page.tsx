import { readFileSync } from "node:fs";
import path from "node:path";
import { Conversation } from "@/components/conversation/Conversation";
import { loadConfig } from "@/lib/config";

export const metadata = { title: "Practice · Lactice" };

export default function Page() {
  const cfg = loadConfig();
  const svg = readFileSync(path.join(process.cwd(), "assets/avatars/src/ja-yuki.svg"), "utf8");
  return (
    <Conversation
      svg={svg}
      tutorName="Yuki"
      level="A2"
      hintPulseSeconds={cfg.SILENCE_HINT_PULSE_SECONDS}
      nudgeSeconds={cfg.SILENCE_NUDGE_SECONDS}
      maxRecordingSeconds={cfg.MAX_RECORDING_SECONDS}
    />
  );
}
