import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("*")
    .eq("student_id", id)
    .single();

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 404 });
  }

  const { data: receipts, error: receiptsError } = await supabase
    .from("receipts")
    .select("*, seats(seat_number)")
    .eq("student_id", id)
    .order("start_date", { ascending: false });

  if (receiptsError) {
    return NextResponse.json({ error: receiptsError.message }, { status: 500 });
  }

  return NextResponse.json({ member, receipts });
}
