import { randomBytes } from "node:crypto";

export function generateQrCode(): string {
  return randomBytes(16).toString("base64url");
}

export function qrCheckInUrl(baseUrl: string, qrCode: string): string {
  return `${baseUrl.replace(/\/$/, "")}/check-in/${qrCode}`;
}
