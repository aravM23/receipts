import { notFound } from "next/navigation";
import { getCard } from "@/lib/store";
import { getOrigin } from "@/lib/site";
import { qrDataUrl } from "@/lib/qr";
import { receiptDateLabels } from "@/lib/format";
import ReceiptClient from "./ReceiptClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const card = await getCard(slug);
  if (!card) notFound();

  const origin = await getOrigin();
  const shareUrl = `${origin}/c/${card.slug}`;
  const qr = await qrDataUrl(shareUrl);
  const { dateLabel, timeLabel, relativeLabel } = receiptDateLabels(card.generated_at);

  return (
    <ReceiptClient
      card={card}
      qrDataUrl={qr}
      shareUrl={shareUrl}
      dateLabel={dateLabel}
      timeLabel={timeLabel}
      relativeLabel={relativeLabel}
    />
  );
}
