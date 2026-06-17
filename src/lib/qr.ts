import QRCode from "qrcode";

/**
 * Render a QR code to a PNG data URL. Tuned for a thermal-receipt look:
 * pure black on white, chunky modules, generous margin so phone cameras
 * lock on fast even off a printed slip.
 */
export async function qrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 2,
    scale: 6,
    color: { dark: "#000000", light: "#ffffff" },
  });
}
