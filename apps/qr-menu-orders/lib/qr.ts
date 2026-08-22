import QRCode from "qrcode";

/**
 * QR as an inline SVG string: no image request, no client JS, and it prints
 * at whatever size the paper needs because it's vector.
 */
export async function qrSvg(value: string, size = 256): Promise<string> {
  return QRCode.toString(value, {
    type: "svg",
    width: size,
    margin: 1,
    // High correction: these get printed, taped to a table and get greasy.
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#ffffff" },
  });
}
