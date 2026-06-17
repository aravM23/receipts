import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
      <div className="flex items-center gap-2.5 mb-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/stanley-mark.png" alt="" width={36} height={36} />
        <span className="font-stanley text-[20px]" style={{ fontWeight: 700 }}>
          Stanley<span className="stan-gradient-text">+</span>
        </span>
      </div>
      <h1 className="font-serif" style={{ fontWeight: 500, fontSize: 34 }}>
        No receipt here.
      </h1>
      <p className="text-[14px] font-sans" style={{ color: "rgba(243,239,230,0.6)" }}>
        That ticket doesn&rsquo;t exist or expired.
      </p>
      <Link
        href="/"
        className="stan-gradient-bg font-sans text-white mt-2 rounded-full px-6 h-11 flex items-center"
        style={{ fontWeight: 700, boxShadow: "0 12px 30px -10px rgba(168,86,232,0.55)" }}
      >
        Get yours
      </Link>
    </main>
  );
}
