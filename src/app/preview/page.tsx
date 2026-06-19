import Receipt from "@/components/Receipt";
import ReceiptFrame from "@/components/ReceiptFrame";
import { MOCK_CARD } from "@/lib/mock";
import { qrDataUrl } from "@/lib/qr";
import { receiptDateLabels } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Design check for the receipt — static mock data, no Hiker/LLM keys. */
export default async function PreviewPage() {
  const qr = await qrDataUrl("https://example.com/c/preview");
  const { dateLabel, timeLabel, relativeLabel } = receiptDateLabels(MOCK_CARD.generated_at);
  return (
    <main className="flex-1 flex items-center justify-center py-12 px-4">
      <ReceiptFrame maxDisplayWidth={440}>
        <Receipt
          card={MOCK_CARD}
          qrDataUrl={qr}
          dateLabel={dateLabel}
          timeLabel={timeLabel}
          relativeLabel={relativeLabel}
        />
      </ReceiptFrame>
    </main>
  );
}
