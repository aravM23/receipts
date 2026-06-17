import Link from "next/link";

/**
 * Stanley-branded top bar. Real logo mark + Advercase wordmark on the
 * left; a purple "Try Stanley for Instagram" pill on the right that
 * links to Stanley for Instagram — so Stanley is a visible part of the
 * experience on every screen.
 */
export default function StanleyHeader() {
  return (
    <header className="w-full">
      <div className="max-w-[1100px] mx-auto w-full px-5 sm:px-8 h-[68px] flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/stanley-mark.png"
            alt="Stanley"
            width={34}
            height={34}
            className="block transition-transform group-hover:-rotate-6"
          />
          <span
            className="font-stanley text-[20px] leading-none"
            style={{ fontWeight: 700, color: "#f3efe6", letterSpacing: "0.01em" }}
          >
            Stanley
          </span>
        </Link>

        <a
          href="https://ig.getstanley.ai/?utm_source=stanley_receipts&utm_medium=header"
          target="_blank"
          rel="noreferrer"
          className="stan-gradient-bg inline-flex items-center gap-1.5 h-9 sm:h-10 px-3.5 sm:px-4 rounded-full text-white text-[12.5px] sm:text-[13px] font-semibold whitespace-nowrap transition-transform active:scale-[0.98]"
          style={{ boxShadow: "0 8px 24px -8px rgba(168,86,232,0.55)" }}
        >
          Try Stanley for Instagram
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17L17 7" />
            <path d="M8 7h9v9" />
          </svg>
        </a>
      </div>
    </header>
  );
}
