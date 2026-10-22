import type { ReactNode } from "react";

/**
 * Every screen lives in one fixed-width, phone-sized column (docs/02 §5.1: designed at 360–430 px).
 * On a phone it fills the screen; on a laptop it is a centred "device" so the layout never stretches.
 */
export function PhoneShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center md:p-6">
      <div className="relative flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-paper-50 md:h-[min(calc(100dvh-3rem),880px)] md:rounded-[32px] md:shadow-[0_24px_64px_rgba(28,27,46,0.18)] md:ring-1 md:ring-ink-900/5">
        {children}
      </div>
    </div>
  );
}
