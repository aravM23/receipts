import StanleyHeader from "@/components/StanleyHeader";
import HandleForm from "./HandleForm";

/**
 * Landing — Stanley-branded onboarding. Dark Stanley canvas, purple
 * glow, the mascot peeking in, and a gradient headline word — then the
 * single handle input that kicks off the receipt.
 */
export default function Home() {
  return (
    <div className="flex-1 flex flex-col relative overflow-hidden">
      {/* Ambient Stanley-purple glow + sparkles */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(80% 55% at 50% -8%, rgba(105,85,255,0.28), transparent 60%), radial-gradient(60% 40% at 85% 12%, rgba(232,90,163,0.12), transparent 60%)",
        }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/sparkle-lavender.png" alt="" aria-hidden className="pointer-events-none absolute left-[12%] top-[20%] w-5 opacity-70" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/sparkle-cream.png" alt="" aria-hidden className="pointer-events-none absolute right-[14%] top-[30%] w-5 opacity-60" />

      <div className="relative z-10">
        <StanleyHeader />
      </div>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-16 pt-4">
        <div className="w-full max-w-[560px] text-center">
          {/* Product lockup: Stanley mascot + "Stanley+" */}
          <div className="flex items-center justify-center gap-2.5 mb-7">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/stanley-mark.png" alt="" width={40} height={40} className="block" />
            <span
              className="font-stanley text-[24px] leading-none"
              style={{ fontWeight: 700 }}
            >
              Stanley<span className="stan-gradient-text" style={{ fontWeight: 700 }}>+</span>
            </span>
          </div>

          <h1
            className="font-serif"
            style={{ fontSize: "clamp(2.6rem, 6vw, 4.4rem)", lineHeight: 1.04, letterSpacing: "-0.02em", fontWeight: 500 }}
          >
            Let Stanley
            <br />
            <span className="stan-gradient-text italic" style={{ fontWeight: 500 }}>
              read you
            </span>
          </h1>

          <p className="mt-5 text-[15px] sm:text-[16px] leading-relaxed mx-auto max-w-[440px]" style={{ color: "rgba(243,239,230,0.66)" }}>
            Drop your Instagram handle. Stanley reads your last few months of
            posts and prints a receipt: three things we noticed, your creator
            type, and a drink that&rsquo;s on us.
          </p>

          <div className="mt-9 text-left">
            <HandleForm />
          </div>

          <div className="mt-7 flex items-center justify-center text-[12px]" style={{ color: "rgba(243,239,230,0.45)" }}>
            <a
              href="https://ig.getstanley.ai/?utm_source=stanley_receipts&utm_medium=footer"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-white transition-colors"
            >
              powered by Stanley for Instagram
            </a>
          </div>
        </div>
      </main>

      {/* Mascot peeking in from the bottom-right corner */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/stanley-peek.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute right-[-10px] bottom-[-12px] w-[120px] sm:w-[160px] lg:w-[210px] opacity-95 select-none"
        style={{ filter: "drop-shadow(0 12px 30px rgba(105,85,255,0.35))" }}
      />
    </div>
  );
}
