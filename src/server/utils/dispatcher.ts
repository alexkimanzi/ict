import { db } from '../db.ts';

export type EmailProvider = 'sendgrid' | 'mailgun';

interface DispatchRecipient {
  userId: number;
  fullName: string;
  email: string;
  phone: string | null;
  emailEnabled: boolean;
  smsEnabled: boolean;
}

function getRecipient(userId: number): DispatchRecipient | null {
  const row = db.prepare(`
    SELECT id, full_name, email, phone,
           COALESCE(email_notifications, 1) AS email_notifications,
           COALESCE(sms_notifications, 1) AS sms_notifications
    FROM users
    WHERE id = ? AND is_active = 1
  `).get(userId) as {
    id: number;
    full_name: string;
    email: string;
    phone: string | null;
    email_notifications: number;
    sms_notifications: number;
  } | undefined;

  if (!row) return null;
  return {
    userId: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    emailEnabled: row.email_notifications === 1,
    smsEnabled: row.sms_notifications === 1,
  };
}

function recordDelivery(params: {
  notificationId?: number | null;
  userId: number;
  channel: 'email' | 'sms';
  recipient: string;
  provider: string;
  subject: string;
  body: string;
  status: 'sent' | 'logged' | 'failed';
  providerMessageId?: string | null;
  errorMessage?: string | null;
}): void {
  try {
    db.prepare(`
      INSERT INTO notification_deliveries (
        notification_id, user_id, channel, recipient, provider,
        subject, body, status, provider_message_id, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.notificationId ?? null,
      params.userId,
      params.channel,
      params.recipient,
      params.provider,
      params.subject,
      params.body,
      params.status,
      params.providerMessageId ?? null,
      params.errorMessage ?? null
    );
  } catch (err) {
    console.error('Failed to log notification delivery:', err);
  }
}

async function sendViaSendGrid(toEmail: string, toName: string, subject: string, textBody: string, htmlBody: string): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'SENDGRID_API_KEY not configured' };
  }

  const fromEmail = process.env.EMAIL_FROM || 'ICT Helpdesk <noreply@ictportal.edu>';
  const match = fromEmail.match(/^(.*)<(.+)>$/);
  const fromObj = match
    ? { name: match[1].trim(), email: match[2].trim() }
    : { email: fromEmail.trim() };

  const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: toEmail, name: toName }] }],
      from: fromObj,
      subject,
      content: [
        { type: 'text/plain', value: textBody },
        { type: 'text/html', value: htmlBody },
      ],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    return { ok: false, error: `SendGrid HTTP ${resp.status}: ${errText.slice(0, 200)}` };
  }

  return { ok: true, messageId: resp.headers.get('x-message-id') || undefined };
}

async function sendViaMailgun(toEmail: string, subject: string, textBody: string, htmlBody: string): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  if (!apiKey || !domain) {
    return { ok: false, error: 'MAILGUN_API_KEY or MAILGUN_DOMAIN not configured' };
  }

  const fromEmail = process.env.EMAIL_FROM || `ICT Helpdesk <noreply@${domain}>`;
  const form = new URLSearchParams();
  form.set('from', fromEmail);
  form.set('to', toEmail);
  form.set('subject', subject);
  form.set('text', textBody);
  form.set('html', htmlBody);

  const authToken = Buffer.from(`api:${apiKey}`).toString('base64');
  const resp = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    return { ok: false, error: `Mailgun HTTP ${resp.status}: ${errText.slice(0, 200)}` };
  }

  const data = (await resp.json().catch(() => ({}))) as { id?: string };
  return { ok: true, messageId: data.id };
}

async function sendViaTwilioSms(toPhone: string, textBody: string): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !fromNumber) {
    return { ok: false, error: 'Twilio SMS credentials not configured' };
  }

  const cleanPhone = toPhone.replace(/\s+/g, '');
  const form = new URLSearchParams();
  form.set('To', cleanPhone);
  form.set('From', fromNumber);
  form.set('Body', textBody);

  const authToken = Buffer.from(`${sid}:${token}`).toString('base64');
  const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    return { ok: false, error: `Twilio HTTP ${resp.status}: ${errText.slice(0, 200)}` };
  }

  const data = (await resp.json().catch(() => ({}))) as { sid?: string };
  return { ok: true, messageId: data.sid };
}

function buildHtmlEmail(title: string, recipientName: string, message: string): string {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #0f172a; padding: 20px 24px; color: #ffffff;">
        <div style="font-size: 16px; font-weight: 700;">AKHIM ICT Support Desk</div>
      </div>
      <div style="padding: 24px; background-color: #ffffff; color: #0f172a;">
        <p style="margin: 0 0 12px; font-size: 14px;">Hello ${recipientName},</p>
        <h2 style="margin: 0 0 12px; font-size: 18px; color: #1d4ed8;">${title}</h2>
        <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #334155;">${message}</p>
        <div style="padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
          Automated ICT Service Notification · Sign in to the ICT Portal to view full ticket and asset details.
        </div>
      </div>
    </div>
  `.trim();
}

export async function dispatchMultiChannelNotification(params: {
  notificationId?: number | null;
  userId: number;
  title: string;
  message: string;
}): Promise<void> {
  const recipient = getRecipient(params.userId);
  if (!recipient) return;

  const emailProvider: EmailProvider = process.env.EMAIL_PROVIDER === 'mailgun' ? 'mailgun' : 'sendgrid';

  // 1. Transactional Email Dispatch (SendGrid / Mailgun)
  if (recipient.emailEnabled && recipient.email) {
    const htmlBody = buildHtmlEmail(params.title, recipient.fullName, params.message);
    try {
      const hasEmailCreds =
        emailProvider === 'mailgun'
          ? Boolean(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN)
          : Boolean(process.env.SENDGRID_API_KEY);

      if (!hasEmailCreds) {
        recordDelivery({
          notificationId: params.notificationId,
          userId: recipient.userId,
          channel: 'email',
          recipient: recipient.email,
          provider: emailProvider,
          subject: params.title,
          body: params.message,
          status: 'logged',
          errorMessage: `Queued locally (${emailProvider.toUpperCase()} API key not set in environment)`,
        });
      } else {
        const res =
          emailProvider === 'mailgun'
            ? await sendViaMailgun(recipient.email, params.title, params.message, htmlBody)
            : await sendViaSendGrid(recipient.email, recipient.fullName, params.title, params.message, htmlBody);

        recordDelivery({
          notificationId: params.notificationId,
          userId: recipient.userId,
          channel: 'email',
          recipient: recipient.email,
          provider: emailProvider,
          subject: params.title,
          body: params.message,
          status: res.ok ? 'sent' : 'failed',
          providerMessageId: res.messageId,
          errorMessage: res.error,
        });
      }
    } catch (err) {
      recordDelivery({
        notificationId: params.notificationId,
        userId: recipient.userId,
        channel: 'email',
        recipient: recipient.email,
        provider: emailProvider,
        subject: params.title,
        body: params.message,
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : 'Email dispatch failed',
      });
    }
  }

  // 2. SMS / Phone Number Dispatch (Twilio)
  if (recipient.smsEnabled && recipient.phone) {
    const smsText = `[ICT Helpdesk] ${params.title}: ${params.message}`;
    try {
      const hasSmsCreds = Boolean(
        process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER
      );

      if (!hasSmsCreds) {
        recordDelivery({
          notificationId: params.notificationId,
          userId: recipient.userId,
          channel: 'sms',
          recipient: recipient.phone,
          provider: 'twilio',
          subject: params.title,
          body: smsText,
          status: 'logged',
          errorMessage: 'Queued locally (Twilio SMS credentials not set in environment)',
        });
      } else {
        const res = await sendViaTwilioSms(recipient.phone, smsText);
        recordDelivery({
          notificationId: params.notificationId,
          userId: recipient.userId,
          channel: 'sms',
          recipient: recipient.phone,
          provider: 'twilio',
          subject: params.title,
          body: smsText,
          status: res.ok ? 'sent' : 'failed',
          providerMessageId: res.messageId,
          errorMessage: res.error,
        });
      }
    } catch (err) {
      recordDelivery({
        notificationId: params.notificationId,
        userId: recipient.userId,
        channel: 'sms',
        recipient: recipient.phone,
        provider: 'twilio',
        subject: params.title,
        body: smsText,
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : 'SMS dispatch failed',
      });
    }
  }
}
