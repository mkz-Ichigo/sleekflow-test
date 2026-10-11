/**
 * Gmail IMAP & Plus-Addressing Helper
 *
 * Utilizes Gmail's plus-addressing (e.g. yourname+test123@gmail.com) and IMAP
 * access via app passwords to retrieve OTP verification codes and links.
 */

import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import dotenv from 'dotenv';
import path from 'path';

// Ensure .env is loaded even if imported outside of Playwright runner
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ============================================================
// Types & Interfaces
// ============================================================

export interface GetGmailCodeOptions {
  /** Maximum time in milliseconds to wait before failing. Default: 60_000 */
  timeout?: number;
  /** Delay between polling attempts in milliseconds. Default: 3_000 */
  pollInterval?: number;
  /** Custom regex pattern to match OTP code. Defaults to 6 digits or labeled pattern */
  pattern?: RegExp;
  /** Only search unseen / unread messages. Default: false (plus-addressed emails are already unique) */
  onlyUnseen?: boolean;
  /** Mark matching message as read after extracting code. Default: true */
  markAsSeen?: boolean;
  /** Optional filter for email subject */
  subjectFilter?: string | RegExp;
}

// ============================================================
// Code & Content Extraction
// ============================================================

/**
 * Extracts OTP code from raw email text/html or subject.
 */
export function extractOtpCode(content: string, customPattern?: RegExp): string | null {
  if (customPattern) {
    const match = content.match(customPattern);
    if (match) return match[1] || match[0];
  }

  // 1. SleekFlow subject pattern: e.g. "482286 is your SleekFlow verification code"
  const sleekflowSubjectRegex = /\b(\d{6})\s+is your (?:[a-zA-Z0-9_-]+\s+)?verification code/i;
  const sleekflowSubjectMatch = content.match(sleekflowSubjectRegex);
  if (sleekflowSubjectMatch && sleekflowSubjectMatch[1]) {
    return sleekflowSubjectMatch[1].trim();
  }

  // 2. SleekFlow body pattern: "entering this verification code:\n482286"
  const sleekflowBodyRegex = /(?:entering\s+this\s+verification\s+code)[\s:=#\-*]+([0-9]{6})\b/i;
  const sleekflowBodyMatch = content.match(sleekflowBodyRegex);
  if (sleekflowBodyMatch && sleekflowBodyMatch[1]) {
    return sleekflowBodyMatch[1].trim();
  }

  // 3. Labeled pattern: e.g. "code is 849201", "verification code: 492013", "OTP: 123456"
  const labeledRegex = /(?:verification\s*code|security\s*code|confirm(?:ation)?\s*code|one-time\s*(?:passcode|password)|otp|code)[\s:=#\-*]+([0-9]{4,8})\b/i;
  const labeledMatch = content.match(labeledRegex);
  if (labeledMatch && labeledMatch[1]) {
    return labeledMatch[1].trim();
  }

  // 4. Standard 6-digit code
  const sixDigitMatch = content.match(/\b\d{6}\b/);
  if (sixDigitMatch) {
    return sixDigitMatch[0];
  }

  // 5. Fallback: 4-8 digit standalone code (excluding potential years 19xx, 20xx)
  const generalCodeMatch = content.match(/\b(?!(?:19|20)\d{2}\b)\d{4,8}\b/);
  if (generalCodeMatch) {
    return generalCodeMatch[0];
  }

  return null;
}

// ============================================================
// IMAP Code Polling
// ============================================================

/**
 * Polls Gmail inbox via IMAP for incoming email addressed to `toAddress` and returns the OTP code.
 *
 * @param toAddress The plus-addressed email (e.g. myuser+timestamp@gmail.com)
 * @param timeoutOrOptions Timeout in ms or GetGmailCodeOptions object
 * @returns {Promise<string>} The extracted OTP code
 */
export async function getGmailCode(
  toAddress: string,
  timeoutOrOptions: number | GetGmailCodeOptions = 60000
): Promise<string> {
  const options: GetGmailCodeOptions =
    typeof timeoutOrOptions === 'number'
      ? { timeout: timeoutOrOptions }
      : timeoutOrOptions;

  const timeout = options.timeout ?? 60000;
  const pollInterval = options.pollInterval ?? 3000;
  const markAsSeen = options.markAsSeen ?? true;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error(
      'Missing Gmail IMAP credentials. Ensure GMAIL_USER and GMAIL_APP_PASSWORD are set in .env'
    );
  }

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: { user, pass },
      logger: false,
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');

      try {
        const searchQuery: Record<string, unknown> = { to: toAddress };
        if (options.onlyUnseen) {
          searchQuery.seen = false;
        }

        const uids = (await client.search(searchQuery, { uid: true })) as number[];

        if (Array.isArray(uids) && uids.length > 0) {
          // Check newest message first
          for (let i = uids.length - 1; i >= 0; i--) {
            const uid = uids[i];
            const msg = await client.fetchOne(
              String(uid),
              { source: true, envelope: true },
              { uid: true }
            );

            if (!msg || !msg.source) continue;

            const parsed = await simpleParser(msg.source);

            // Optional subject filter check
            if (options.subjectFilter) {
              const subject = parsed.subject || '';
              const matches =
                typeof options.subjectFilter === 'string'
                  ? subject.toLowerCase().includes(options.subjectFilter.toLowerCase())
                  : options.subjectFilter.test(subject);
              if (!matches) continue;
            }

            // Combine text & html content for resilient matching
            const content = [
              parsed.subject,
              parsed.text,
              typeof parsed.html === 'string' ? parsed.html.replace(/<[^>]*>/g, ' ') : '',
            ]
              .filter(Boolean)
              .join('\n');

            const code = extractOtpCode(content, options.pattern);
            if (code) {
              if (markAsSeen) {
                await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true }).catch(() => {});
              }
              return code;
            }
          }
        }
      } finally {
        lock.release();
        await client.logout();
      }
    } catch {
      // Swallowing transient IMAP errors during poll iteration
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error(`No verification email with OTP code received for ${toAddress} within ${timeout}ms`);
}


