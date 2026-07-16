import { NextResponse } from "next/server";
import { resolveIdentity } from "@/lib/identity";
import { hueFromId } from "@/lib/guest-identity";

export async function GET() {
  const identity = await resolveIdentity();
  return NextResponse.json({ ...identity, hue: hueFromId(identity.id) });
}
