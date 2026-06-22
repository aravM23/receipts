import HandleForm from "./HandleForm";

/**
 * Landing — full-bleed looping video background (the Stanley mascot/bubble
 * lives in the video) with the headline, blurb, and handle input overlaid in
 * the lower half. Built to fill any screen aspect (portrait panel PC included)
 * via object-cover on the video.
 *
 * Drop the background clip at `public/landing-bg.mp4` (optionally a still
 * frame at `public/landing-poster.jpg` for instant first paint). Until then
 * the dark Stanley canvas shows through.
 */
export default function Home() {
  return (
    <div className="relative flex-1 min-h-[100svh] overflow-hidden" style={{ background: "var(--color-stan-canvas)" }}>
      {/* Looping background video */}
      <video
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        poster="/landing-poster.jpg"
        aria-hidden
      >
        <source src="/landing-bg.mp4" type="video/mp4" />
      </video>

      {/* Legibility gradient — keeps the lower-half text crisp over the video */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, rgba(10,8,22,0) 0%, rgba(10,8,22,0.12) 40%, rgba(10,8,22,0.62) 70%, rgba(10,8,22,0.92) 90%, rgba(10,8,22,0.97) 100%)",
        }}
      />

      {/* Overlaid content, anchored to the lower half */}
      <main className="relative z-10 min-h-[100svh] flex flex-col justify-end items-center px-6 pb-[7svh] text-center">
        <div className="w-full max-w-[460px]">
          <h1
            className="font-sans text-white"
            style={{
              fontSize: "clamp(2.1rem, 7.5vw, 3.1rem)",
              lineHeight: 1.06,
              letterSpacing: "-0.02em",
              fontWeight: 700,
            }}
          >
            Let Stanley mix your
            <br />
            Creator cocktail
          </h1>

          <p
            className="mt-4 mx-auto max-w-[360px] text-[14px] sm:text-[15px]"
            style={{ color: "rgba(243,239,230,0.62)", lineHeight: 1.55 }}
          >
            Stanley is your AI head of content. Drop your Instagram handle below
            and we&rsquo;ll mix up a personalized creator cocktail based on your
            content, style, and personality.
          </p>

          <div className="mt-7 text-left">
            <HandleForm />
          </div>
        </div>
      </main>
    </div>
  );
}
