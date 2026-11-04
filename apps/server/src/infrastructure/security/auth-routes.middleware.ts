import { type ArcjetNest, detectBot, protectSignup } from '@arcjet/nest';
import type { NextFunction, Request, Response } from 'express';

const signupPaths = new Set([
  '/auth/sign-up/email',
  '/auth/email-otp/send-verification-otp',
]);

const maxBodyBytes = 16 * 1024;

// Better Auth skips Nest's body parser, so read the JSON body here; better-call reuses `req.body` once the stream is consumed.
async function readJsonBody(req: Request): Promise<unknown> {
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (text.length > maxBodyBytes) {
      throw new RangeError('Request body too large');
    }
  }
  req.body = text ? JSON.parse(text) : {};
  return req.body;
}

function emailOf(body: unknown): string | undefined {
  if (typeof body === 'object' && body !== null && 'email' in body) {
    return typeof body.email === 'string' ? body.email : undefined;
  }
  return undefined;
}

export function arcjetAuthMiddleware(aj: ArcjetNest) {
  const signupAj = aj.withRule(
    protectSignup({
      email: { mode: 'LIVE', deny: ['DISPOSABLE', 'INVALID', 'NO_MX_RECORDS'] },
      bots: { mode: 'LIVE', allow: [] },
      rateLimit: { mode: 'LIVE', interval: '1m', max: 10 },
    })
  );
  const botAj = aj.withRule(detectBot({ mode: 'LIVE', allow: [] }));

  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'POST') {
      next();
      return;
    }

    let email: string | undefined;
    if (signupPaths.has(req.path)) {
      try {
        email = emailOf(await readJsonBody(req));
      } catch (error) {
        res
          .status(error instanceof RangeError ? 413 : 400)
          .json({ message: 'Invalid request body.' });
        return;
      }
    }

    try {
      const decision = email
        ? await signupAj.protect(req, { email })
        : await botAj.protect(req);

      if (decision.isErrored()) {
        console.warn('[arcjet] auth decision errored', decision.reason);
      }

      if (decision.isDenied()) {
        if (decision.reason.isRateLimit()) {
          res
            .status(429)
            .json({ message: 'Too many requests. Please try again later.' });
          return;
        }

        if (decision.reason.isEmail()) {
          const { emailTypes } = decision.reason;
          const message = emailTypes.includes('DISPOSABLE')
            ? 'We do not allow disposable email addresses.'
            : emailTypes.includes('NO_MX_RECORDS')
              ? 'Your email domain does not have an MX record. Is there a typo?'
              : 'Email address format is invalid. Is there a typo?';
          res.status(400).json({ message });
          return;
        }

        res.status(403).json({ message: 'Request blocked.' });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
