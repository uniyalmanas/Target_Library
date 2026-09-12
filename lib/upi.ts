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
  studentPhone: string;
  seatNumber: number;
  shiftName: string;
  daysOverdue: number;
  expiryDate: string;
  amountDue: number;
  libraryName: string;
  upiId: string;
  upiName?: string;
  digitalPassUrl?: string;
}

/**
 * Generates a high-converting, professional WhatsApp reminder message
 * with embedded dynamic UPI intent link and payment breakdown.
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
  const upiIntent = generateUpiIntentUrl({
    upiId: upiId || "targetlibrary@upi",
    payeeName: upiName || libraryName,
    amount: amountDue,
    note: `Fee Seat #${seatNumber} - ${libraryName}`,
  });

  const overdueUrgency =
    daysOverdue > 7
      ? `🚨 *CRITICAL ALERT:* Seat #${seatNumber} is *${daysOverdue} days overdue* and pending reallocation to the waiting queue.`
      : daysOverdue >= 4
      ? `⚠️ *URGENT:* Seat #${seatNumber} is *${daysOverdue} days overdue*.`
      : `ℹ️ *Friendly Notice:* Seat #${seatNumber} expired ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} ago (${expiryDate}).`;

  return `📚 *${libraryName} — Fee Renewal Notice*

Dear *${studentName}*,

${overdueUrgency}

━━━━━━━━━━━━━━━━━━━━━
🪑 *Seat Reserved:* Seat #${seatNumber}
⏰ *Shift Timing:* ${shiftName}
📅 *Expired On:* ${expiryDate}
💰 *Renewal Amount Due:* *₹${amountDue}*
━━━━━━━━━━━━━━━━━━━━━

⚡ *PAY IN 1-CLICK VIA UPI (PhonePe / GPay / Paytm):*
${upiIntent}

_UPI ID:_ \`${upiId || "targetlibrary@upi"}\`
_Account Name:_ ${upiName || libraryName}
${digitalPassUrl ? `\n🎟️ *View / Download Your Digital Pass:*\n${digitalPassUrl}` : ""}

_Please complete payment today to keep your seat reserved. If you have already paid or vacated, please notify the front desk._

Warm regards,  
*${libraryName} Front Desk*`;
}
