import { NextResponse } from "next/server";

/**
 * Owner guard stub — vault/credentials system has been archived.
 * Always returns null (authorized) in local dev mode.
 */
export async function requireOwner(
  _body: Record<string, unknown>,
): Promise<NextResponse | null> {
  return null;
}
