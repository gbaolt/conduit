import { Resend } from 'resend';

import { getAppUrl } from '@/infrastructure/app.config';

export const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export const appURL = getAppUrl();
export const emailFrom = `Gia Bảo from Conduit <${process.env.AUTH_EMAIL_FROM ?? 'conduit@giabao.dev'}>`;
