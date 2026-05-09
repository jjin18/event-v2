import { Resend } from "resend";

let _resend: Resend | null = null;
function resend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY is not set");
    _resend = new Resend(key);
  }
  return _resend;
}

const FROM = process.env.RESEND_FROM_EMAIL ?? "events@example.com";

export async function sendVerificationCodeEmail(to: string, code: string): Promise<void> {
  await resend().emails.send({
    from: FROM,
    to,
    subject: `Your event verification code: ${code}`,
    text: `Your verification code is ${code}. It expires in 15 minutes.\n\nIf you didn't request this, you can ignore this email.`,
  });
}

export async function sendApplicationReceivedEmail(to: string, eventName: string): Promise<void> {
  await resend().emails.send({
    from: FROM,
    to,
    subject: `Application received: ${eventName}`,
    text: `Thanks for applying to ${eventName}. We review applications within 48 hours and will email you with a decision.`,
  });
}

export async function sendAcceptanceEmail(
  to: string,
  eventName: string,
  qrCodeUrl: string,
): Promise<void> {
  await resend().emails.send({
    from: FROM,
    to,
    subject: `You're in: ${eventName}`,
    text: `You're confirmed for ${eventName}. Your check-in QR is here: ${qrCodeUrl}\n\nWe'll send a composition update three days before the event.`,
  });
}

export async function sendRejectionEmail(to: string, eventName: string): Promise<void> {
  await resend().emails.send({
    from: FROM,
    to,
    subject: `Update on your ${eventName} application`,
    text: `Thanks for applying to ${eventName}. Unfortunately we couldn't fit you into the room this time. We hope to see you at a future event.`,
  });
}
