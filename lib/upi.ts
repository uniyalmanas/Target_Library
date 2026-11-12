/**
 * Dynamic UPI Intent & QR Generator for LibraryOS
 * Compliant with NPCI (National Payments Corporation of India) UPI Deep-Linking Specs
 */

export interface UpiPaymentDetails {
  upiId: string;
  payeeName: string;
  amount: number;
  note?: string;
  transactionRef?: string;
}

/**
 * Generates an NPCI compliant upi://pay URI.
 * On mobile devices (Android & iOS), clicking this link directly opens
 * Google Pay, PhonePe, Paytm, or BHIM with the payee and exact amount pre-filled.
 */
export function generateUpiIntentUrl({
  upiId,
  payeeName,
  amount,
  note = "Library Fee Payment",
  transactionRef,
}: UpiPaymentDetails): string {
  const cleanUpiId = (upiId || "targetlibrary@upi").trim();
  const cleanName = (payeeName || "Study Library").trim();
  const cleanAmount = Number(amount) > 0 ? Number(amount).toFixed(2) : "0.00";
  const cleanNote = note.trim();
  const tr = transactionRef || `REF_${Date.now()}`;

  const params = new URLSearchParams({
    pa: cleanUpiId,
    pn: cleanName,
    am: cleanAmount,
    cu: "INR",
    tn: cleanNote,
    tr: tr,
  });

  return `upi://pay?${params.toString()}`;
}

/**
 * Generates a dynamic QR code URL encoding the exact UPI intent payload.
 * When scanned by PhonePe / GPay from a phone, the amount and payee are pre-filled.
 */
export function generateUpiQrCodeUrl(
  details: UpiPaymentDetails,
  size: number = 300
): string {
  const upiIntent = generateUpiIntentUrl(details);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
    upiIntent
  )}`;
}

export interface DueFeeWhatsAppMessageParams {
  studentName: string;
  studentPhone?: string | null;
  seatNumber: number | string;
  shiftName?: string;
  daysOverdue?: number;
  expiryDate?: string;
  amountDue: number;
  libraryName: string;
  upiId: string;
  upiName?: string;
  digitalPassUrl?: string;
}

/**
 * Generates a clean, simple, and polite WhatsApp fee renewal reminder
 * with clear payment details and a direct QR code / online payment link.
 */
export function generateDueFeeWhatsAppMessage({
  studentName,
  seatNumber,
  shiftName,
  daysOverdue,
  expiryDate,
  amountDue,
  libraryName,
  upiId,
  upiName,
  digitalPassUrl,
}: DueFeeWhatsAppMessageParams): string {
  const cleanUpiId = (upiId || "targetlibrary@upi").trim();
  const cleanLibName = (libraryName || "The Target Library").trim();
  const cleanAmount = Number(amountDue) > 0 ? Number(amountDue) : 0;

  // Direct QR Code fallback if no pass URL is provided
  const qrFallbackUrl = generateUpiQrCodeUrl(
    {
      upiId: cleanUpiId,
      payeeName: upiName || cleanLibName,
      amount: cleanAmount,
      note: `Fee Seat #${seatNumber} - ${cleanLibName}`,
    },
    300
  );

  const payUrl = digitalPassUrl || qrFallbackUrl;
  const seatDisplay =
    typeof seatNumber === "string" && seatNumber.toLowerCase().includes("seat")
      ? seatNumber
      : `Seat #${seatNumber}`;
  const shiftText = shiftName ? ` (${shiftName})` : "";

  return `Dear *${studentName}*,

Your library fee of *₹${cleanAmount}* for *${seatDisplay}*${shiftText} is due for renewal.

📲 *Pay via UPI:*
• UPI ID: \`${cleanUpiId}\`
• Scan QR & Pay Online:
${payUrl}

Please complete the payment to keep your seat reserved. If already paid, kindly ignore this message.

Thank you,
*${cleanLibName}*`;
}
