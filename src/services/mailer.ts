/**
 * Mailer alert ApexPulse — SMTP lewat nodemailer, dengan antrean sederhana.
 *
 * Pengiriman email TIDAK boleh menahan permintaan HTTP: route cukup menaruh
 * tugas di antrean (`antreEmail`) lalu langsung menjawab. Antrean dikuras satu
 * per satu di latar belakang.
 *
 * Kalau `SMTP_HOST` / `ALERT_EMAIL_TO` belum diisi, mailer dianggap NONAKTIF:
 * tugas di antrean dilewati dan dicatat di log. Tidak pernah ada email yang
 * dilaporkan terkirim padahal tidak dikirim.
 */
import nodemailer from 'nodemailer';

export interface EmailAlert {
  subject: string;
  text: string;
  html: string;
  /** Dipanggil HANYA setelah SMTP benar-benar menerima email. */
  onSent?: () => void;
}

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const MAIL_FROM = process.env.MAIL_FROM || SMTP_USER || 'ApexPulse <no-reply@apexpulse.local>';

/** Daftar penerima notifikasi email (dipisah koma di env `ALERT_EMAIL_TO`). */
export function penerimaAlert(): string[] {
  return (process.env.ALERT_EMAIL_TO || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Mailer hanya aktif kalau host SMTP dan minimal satu penerima tersedia. */
export function mailerAktif(): boolean {
  return Boolean(SMTP_HOST && penerimaAlert().length > 0);
}

type Transporter = ReturnType<typeof nodemailer.createTransport>;

let transport: Transporter | null = null;

function ambilTransport(): Transporter | null {
  if (!mailerAktif()) return null;
  if (!transport) {
    transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true' || SMTP_PORT === 465,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
  }
  return transport;
}

const antrean: EmailAlert[] = [];
let sedangKirim = false;
let jumlahTerkirim = 0;

/** Status antrean — dipakai panel admin & skrip QA. */
export function statusMailer() {
  return {
    aktif: mailerAktif(),
    host: SMTP_HOST || null,
    port: SMTP_PORT,
    pengirim: MAIL_FROM,
    penerima: penerimaAlert(),
    menungguAntre: antrean.length,
    jumlahTerkirim,
  };
}

/** Taruh email di antrean. Tidak menunggu pengiriman (fire-and-forget). */
export function antreEmail(alert: EmailAlert): void {
  antrean.push(alert);
  if (!sedangKirim) void kurasAntrean();
}

async function kurasAntrean(): Promise<void> {
  sedangKirim = true;
  while (antrean.length > 0) {
    const email = antrean.shift()!;
    const ke = penerimaAlert();
    const tp = ambilTransport();
    if (!tp || ke.length === 0) {
      console.warn(
        `[mailer] dilewati (SMTP_HOST/ALERT_EMAIL_TO belum diisi): "${email.subject}"`
      );
      continue;
    }
    try {
      const info = await tp.sendMail({
        from: MAIL_FROM,
        to: ke.join(', '),
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
      jumlahTerkirim++;
      console.log(`[mailer] terkirim "${email.subject}" -> ${ke.join(', ')} (${info.messageId})`);
      email.onSent?.();
    } catch (err: any) {
      // Gagal kirim: notifikasi in-app tetap ada, `sentEmail` tetap false.
      console.error(`[mailer] gagal kirim "${email.subject}": ${err?.message || err}`);
    }
  }
  sedangKirim = false;
}
