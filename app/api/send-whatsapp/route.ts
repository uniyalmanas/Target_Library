import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateDueFeeWhatsAppMessage } from "@/lib/upi";
import { getLibraryBySlug, DEFAULT_LIBRARY_ID } from "@/lib/tenant";

// POST /api/send-whatsapp
// Body: { receipt_no: number, type?: "receipt" | "due_reminder", slug?: string }
export async function POST(req: Request) {
  try {
    const { receipt_no, type = "receipt", slug } = await req.json();

    if (!receipt_no) {
      return NextResponse.json({ error: "Missing receipt_no" }, { status: 400 });
    }

    // Fetch receipt, member and seat info
    let { data: receipt, error: fetchError } = await supabase
      .from("receipts")
      .select(`
        receipt_no,
        subscription_type,
        shift_type,
        has_sheet,
        amount_paid,
        payment_mode,
        start_date,
        end_date,
        library_id,
        members (name, phone),
        seats (seat_number)
      `)
      .eq("receipt_no", receipt_no)
      .single();

    if (fetchError && (fetchError.code === "42703" || fetchError.message?.includes("payment_mode") || fetchError.message?.includes("library_id"))) {
      const retry = await supabase
        .from("receipts")
        .select(`
          receipt_no,
          subscription_type,
          shift_type,
          has_sheet,
          amount_paid,
          start_date,
          end_date,
          members (name, phone),
          seats (seat_number)
        `)
        .eq("receipt_no", receipt_no)
        .single();
      receipt = retry.data as any;
      fetchError = retry.error;
    }

    if (fetchError || !receipt) {
      return NextResponse.json({ error: fetchError?.message || "Receipt not found" }, { status: 404 });
    }

    const member = receipt.members as any;
    const seat = receipt.seats as any;

    if (!member || !member.phone) {
      return NextResponse.json({ error: "Member phone number is missing. Cannot send WhatsApp." }, { status: 400 });
    }

    // Resolve library branding and UPI configurations
    let libraryName = "The Target Library";
    let upiId = "targetlibrary@upi";
    let upiName = "The Target Library";

    if (slug) {
      try {
        const lib = await getLibraryBySlug(slug);
        if (lib) {
          libraryName = lib.name || libraryName;
          upiId = lib.upi_id || upiId;
          upiName = lib.upi_name || lib.name || upiName;
        }
      } catch {
        // fallback
      }
    } else if ((receipt as any).library_id) {
      const { data: libData } = await supabase
        .from("libraries")
        .select("name, upi_id, upi_name")
        .eq("id", (receipt as any).library_id)
        .maybeSingle();
      if (libData) {
        libraryName = libData.name || libraryName;
        upiId = libData.upi_id || upiId;
        upiName = libData.upi_name || libData.name || upiName;
      }
    }

    const shiftLabel =
      receipt.subscription_type === "full_day"
        ? "Full day (6am–12am)"
        : `Half day (${receipt.shift_type === "morning" || receipt.shift_type === "shift_1" ? "6am–2pm" : "2pm–12am"})`;

    const paymentLabel = receipt.payment_mode === "online" ? "Online (UPI)" : "Cash";

    // Build absolute URL for the digital pass page
    const origin = req.headers.get("origin") || "http://localhost:3000";
    const digitalPassUrl = `${origin}/receipts/${receipt.receipt_no}`;

    let messageText = "";

    if (type === "due_reminder") {
      const today = new Date().toISOString().split("T")[0];
      const todayTime = new Date(`${today}T00:00:00`).getTime();
      const endTime = new Date(`${receipt.end_date}T00:00:00`).getTime();
      const daysOverdue = Math.max(0, Math.ceil((todayTime - endTime) / (1000 * 60 * 60 * 24)));

      messageText = generateDueFeeWhatsAppMessage({
        studentName: member.name,
        studentPhone: member.phone,
        seatNumber: seat.seat_number,
        shiftName: shiftLabel,
        daysOverdue,
        expiryDate: receipt.end_date,
        amountDue: receipt.amount_paid,
        libraryName,
        upiId,
        upiName,
        digitalPassUrl,
      });
    } else {
      // Format standard receipt message text
      messageText = `${libraryName}
Receipt No: ${receipt.receipt_no}
Name: ${member.name}
Seat No: ${seat.seat_number}
Type: ${shiftLabel}
Sheet Addon: ${receipt.has_sheet ? "Yes" : "No"}
Amount Paid: Rs ${receipt.amount_paid} (${paymentLabel})
Start Date: ${receipt.start_date}
Valid till: ${receipt.end_date}

Click below to view/print your Digital Membership Pass & Invoice:
${digitalPassUrl}

Thank you for choosing ${libraryName}!`;
    }

    // Read provider credentials from environment variables
    const instanceId = process.env.ULTRAMSG_INSTANCE_ID;
    const token = process.env.ULTRAMSG_TOKEN;

    const cleanPhone = member.phone.replace(/\D/g, "");
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    const encodedText = encodeURIComponent(messageText);
    const waUrl = `https://wa.me/${formattedPhone}?text=${encodedText}`;

    if (instanceId && token) {
      console.log(`Sending live background WhatsApp message to ${formattedPhone} via UltraMsg...`);

      const res = await fetch(`https://api.ultramsg.com/${instanceId}/messages/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          token: token,
          to: formattedPhone,
          body: messageText,
        }),
      });

      const resText = await res.text();
      if (!res.ok) {
        console.error("UltraMsg API error response:", resText);
        // Graceful fallback to wa.me if provider errors
        return NextResponse.json({
          success: true,
          live: false,
          wa_url: waUrl,
          message: "Third-party gateway busy. Use free direct WhatsApp link.",
          payload: { to: formattedPhone, text: messageText },
        });
      }

      console.log("UltraMsg message dispatched successfully.");
      return NextResponse.json({
        success: true,
        live: true,
        wa_url: waUrl,
        message: "Live message sent successfully.",
      });
    } else {
      // 100% Free wa.me direct fallback mode
      console.log(`--- WHATSAPP DIRECT MODE (Zero cost wa.me link ready) ---`);
      console.log(`To: +${formattedPhone}`);
      console.log(`Link: ${waUrl}`);
      console.log(`--------------------------------------------------------`);

      return NextResponse.json({
        success: true,
        live: false,
        simulated: true,
        wa_url: waUrl,
        message: "Direct WhatsApp link ready (₹0 free dispatch).",
        payload: {
          to: formattedPhone,
          text: messageText,
        },
      });
    }
  } catch (error: any) {
    console.error("POST /api/send-whatsapp error:", error);
    return NextResponse.json({ error: error.message || "Failed to dispatch WhatsApp message" }, { status: 500 });
  }
}
