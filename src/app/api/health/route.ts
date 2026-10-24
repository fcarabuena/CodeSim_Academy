// Render's health check. Deliberately does not touch the database, so a
// sleeping Neon compute never makes the service look unhealthy.
export function GET() {
  return Response.json({ status: "ok", time: new Date().toISOString() });
}
