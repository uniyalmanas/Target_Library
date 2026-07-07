import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// POST /api/send-whatsapp
// Body: { receipt_no: number }
export async function POST(req: Request) {
  try {
    const { receipt_no } = await req.json();

    if (!receipt_no) {
      return NextResponse.json({ error: "Missing receipt_no" }, { status: 400 });
    }

    // Fetch receipt, member and seat info
    const { data: receipt, error: fetchError } = await supabase
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

    if (fetchError || !receipt) {
      return NextResponse.json({ error: fetchError?.message || "Receipt not found" }, { status: 404 });
    }

    const member = receipt.members as any;
    const seat = receipt.seats as any;

    if (!member || !member.phone) {
      return NextResponse.json({ error: "Member phone number is missing. Cannot send WhatsApp." }, { status: 400 });
    }

    const shiftLabel =
      receipt.subscription_type === "full_day"
        ? "Full day (6am–12am)"
        : `Half day (${receipt.shift_type === "morning" ? "6am–2pm" : "2pm–12am"})`;

    // Build absolute URL for the digital pass page
    const origin = req.headers.get("origin") || "http://localhost:3000";
    const digitalPassUrl = `${origin}/receipts/${receipt.receipt_no}`;

    // Format message text
    const messageText = `The Target Library
Receipt No: ${receipt.receipt_no}
Name: ${member.name}
Seat No: ${seat.seat_number}
Type: ${shiftLabel}
Sheet Addon: ${receipt.has_sheet ? "Yes" : "No"}
Amount Paid: Rs ${receipt.amount_paid}
Start Date: ${receipt.start_date}
Valid till: ${receipt.end_date}

Click below to view/print your Digital Membership Pass & Invoice:
${digitalPassUrl}

Thank you for choosing The Target Library!`;

    // Read provider credentials from environment variables
    const instanceId = process.env.ULTRAMSG_INSTANCE_ID;
    const token = process.env.ULTRAMSG_TOKEN;

    const cleanPhone = member.phone.replace(/\D/g, "");
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

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
        throw new Error(`UltraMsg sending failed: ${resText}`);
      }

      console.log("UltraMsg message dispatched successfully.");
      return NextResponse.json({ success: true, message: "Live message sent successfully." });
    } else {
      // Simulation Mode
      console.log(`--- WHATSAPP SIMULATION MODE (No credentials configured) ---`);
      console.log(`To: +${formattedPhone}`);
      console.log(`Message:\n${messageText}`);
      console.log(`-----------------------------------------------------------`);

      return NextResponse.json({
        success: true,
        simulated: true,
        message: "No live WhatsApp API key configured. Message was logged in terminal simulation mode.",
        payload: {
          to: formattedPhone,
          text: messageText,
        }
      });
    }
  } catch (error: any) {
    console.error("POST /api/send-whatsapp error:", error);
    return NextResponse.json({ error: error.message || "Failed to dispatch WhatsApp message" }, { status: 500 });
  }
}
