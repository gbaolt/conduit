import { Resend } from 'resend';

export const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export const appURL = process.env.APP_URL ?? 'https://localhost:3000';
export const emailFrom = `Gia Bảo from Conduit <${process.env.AUTH_EMAIL_FROM ?? 'conduit@giabao.dev'}>`;
