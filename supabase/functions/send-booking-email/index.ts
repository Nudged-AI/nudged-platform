import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function generateICS(booking: any): string {
  const dt = (s: string) => s.replace(/[-:]/g, '').replace('.000', 'Z');
  const start = new Date(`${booking.booking_date}T${booking.start_time}:00`);
  const end = new Date(`${booking.booking_date}T${booking.end_time}:00`);
  const uid = `booking-${booking.id}@nudged.app`;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nudged//Booking//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dt(new Date().toISOString())}`,
    `DTSTART:${dt(start.toISOString())}`,
    `DTEND:${dt(end.toISOString())}`,
    `SUMMARY:Coaching Session${booking.coachee_name ? ' with ' + booking.coachee_name : ''}`,
    `DESCRIPTION:${booking.remarks || 'Coaching session via Nudged'}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  try {
    const { booking, coachEmail, coachName } = await req.json();
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: "RESEND_API_KEY not configured" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const ics = generateICS(booking);
    const icsBase64 = btoa(ics);

    const emails = [
      { to: booking.coachee_email, subject: `Booking confirmed with ${coachName}`, name: booking.coachee_name },
      { to: coachEmail, subject: `New booking from ${booking.coachee_name || 'coachee'}`, name: coachName },
    ];

    for (const e of emails) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Nudged <noreply@nudged.app>",
          to: e.to,
          subject: e.subject,
          html: `<p>Hi ${e.name},</p><p>Your coaching session is confirmed.</p><p><strong>Date:</strong> ${booking.booking_date}<br><strong>Time:</strong> ${booking.start_time} - ${booking.end_time}</p>${booking.remarks ? `<p><strong>Remarks:</strong> ${booking.remarks}</p>` : ''}<p>The calendar invite is attached.</p><p>Powered by Nudged</p>`,
          attachments: [{ filename: "invite.ics", content: icsBase64, content_type: "text/calendar" }],
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error("Resend error:", errText);
      }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
