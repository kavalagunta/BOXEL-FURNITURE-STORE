import { z } from 'zod';
import { query, queryOne } from '../config/db.js';
import { getSettings, flag } from '../services/settingsService.js';
import { notifyEnquiry, notifyNewsletter } from '../services/notificationService.js';
import { email, text, optionalPhone } from '../utils/validators.js';
import { generateEnquiryRef, clientIp } from '../utils/helpers.js';
import { HttpError } from '../utils/httpError.js';

export const ENQUIRY_TOPICS = ['Product question', 'Order support', 'Bulk or society enquiry', 'Partnership', 'Other'];

export const enquirySchema = z.object({
  topic: z.enum(ENQUIRY_TOPICS, { error: 'Choose a topic.' }),
  name: text(120, 2),
  email,
  phone: optionalPhone,
  message: text(4000, 10),
  consent: z.literal(true, { error: 'Please agree to the privacy policy so we can reply.' }),
  // Honeypot: real visitors never see or fill this field.
  website: z.string().max(0).optional().or(z.literal('')),
});

export async function createEnquiry(req, res) {
  const d = req.valid.body;
  let id;
  let reference;
  for (let attempt = 0; attempt < 5 && !id; attempt += 1) {
    reference = generateEnquiryRef();
    try {
      const r = await query(
        'INSERT INTO enquiries (reference, topic, name, email, phone, message, consent_at, ip_address) VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), ?)',
        [reference, d.topic, d.name, d.email, d.phone, d.message, clientIp(req)],
      );
      id = r.insertId;
    } catch (err) {
      if (err.code !== 'ER_DUP_ENTRY') throw err;
    }
  }
  if (!id) throw new Error('Could not allocate an enquiry reference.');
  setImmediate(() => notifyEnquiry(id));
  res.status(201).json({ reference, message: 'Thank you. We have received your message and will reply soon.' });
}

export const newsletterSchema = z.object({
  email,
  consent: z.literal(true, { error: 'Please confirm you would like to receive updates.' }),
});

export async function subscribe(req, res) {
  const settings = await getSettings();
  if (!flag(settings, 'newsletter_enabled')) throw new HttpError(404, 'Newsletter sign-up is not available.');
  const { email: address } = req.valid.body;
  const existing = await queryOne('SELECT id, status FROM newsletter_subscribers WHERE email = ?', [address]);
  if (existing?.status === 'subscribed') {
    return res.json({ message: 'You are already subscribed. Thank you!' , alreadySubscribed: true });
  }
  let id = existing?.id;
  if (existing) await query("UPDATE newsletter_subscribers SET status = 'subscribed', consent_at = UTC_TIMESTAMP() WHERE id = ?", [id]);
  else id = (await query('INSERT INTO newsletter_subscribers (email, consent_at) VALUES (?, UTC_TIMESTAMP())', [address])).insertId;
  setImmediate(() => notifyNewsletter(address, id));
  res.status(201).json({ message: 'Thank you for subscribing.' });
}
