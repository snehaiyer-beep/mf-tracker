/** Cron routes require "Authorization: Bearer <CRON_SECRET>" (Vercel Cron sends this automatically). */
export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
