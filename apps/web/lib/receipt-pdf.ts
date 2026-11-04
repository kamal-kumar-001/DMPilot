import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb } from 'pdf-lib';

/** Payment receipt only. No inferred GST split, provider, or invented payment ID. */
export async function createReceiptPdf(invoice: any): Promise<Uint8Array> {
  if (invoice.status !== 'PAID')
    throw new Error('Receipt is only available after payment is confirmed.');
  const doc = await PDFDocument.create();
  doc.setTitle(`DMPilot payment receipt ${invoice.id}`);
  doc.registerFontkit(fontkit);
  const fontResponse = await fetch('/fonts/receipt-sans.ttf');
  if (!fontResponse.ok) throw new Error('Receipt font unavailable');
  const regular = await doc.embedFont(await fontResponse.arrayBuffer(), { subset: true });
  const bold = regular;
  let page = doc.addPage([595.28, 841.89]);
  let y = 790;
  const ink = rgb(0.09, 0.15, 0.22),
    muted = rgb(0.35, 0.42, 0.49),
    green = rgb(0, 0.48, 0.36);
  const text = (value: any) =>
    Array.from(String(value ?? ''))
      .filter((c) => c === '\n' || c.charCodeAt(0) >= 32)
      .join('');
  const line = (value: any, size = 11, strong = false, color = ink) => {
    const font = strong ? bold : regular;
    for (const source of text(value).split('\n')) {
      const words = source.split(/\s+/);
      let current = '';
      for (const word of words) {
        const chunks = word.match(/.{1,65}/g) || [''];
        for (const chunk of chunks) {
          const next = current ? current + ' ' + chunk : chunk;
          if (font.widthOfTextAtSize(next, size) > 490 && current) {
            draw(current);
            current = chunk;
          } else current = next;
        }
      }
      draw(current);
    }
    function draw(s: string) {
      if (y < 65) {
        page = doc.addPage([595.28, 841.89]);
        y = 790;
      }
      page.drawText(s, { x: 50, y, size, font, color });
      y -= size + 7;
    }
  };
  page.drawRectangle({ x: 0, y: 824, width: 596, height: 18, color: green });
  line('DMPilot', 26, true, green);
  line('PAYMENT RECEIPT', 11, true, muted);
  y -= 16;
  line('PAID', 12, true, green);
  line('Payment confirmed in DMPilot billing records', 10, false, muted);
  y -= 18;
  line('Receipt ID', 9, true, muted);
  line(invoice.id, 10);
  line(`Issued: ${new Date(invoice.createdAt).toISOString().slice(0, 10)}`, 10);
  y -= 18;
  const details = invoice.billingDetails || {};
  line('BILLED TO', 10, true, muted);
  for (const value of [
    details.name || invoice.user?.name || 'Creator',
    details.email || invoice.user?.email,
    details.phone,
    details.address,
    [details.city, details.pincode].filter(Boolean).join(' '),
    details.gstin ? `GSTIN: ${details.gstin}` : null,
  ])
    if (value) line(value);
  y -= 20;
  line('SUBSCRIPTION', 10, true, muted);
  line(
    `${invoice.plan === 'ENTERPRISE' ? 'Agency' : invoice.plan === 'PRO' ? 'Pro' : invoice.plan} plan - ${invoice.cycle === 'YEARLY' ? 'Annual' : 'Monthly'}`,
    14,
    true,
  );
  y -= 12;
  line('TOTAL PAID', 10, true, muted);
  y -= 12;
  line(
    `${invoice.currency || 'INR'} ${Number(invoice.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    24,
    true,
    green,
  );
  y -= 15;
  line('PAYMENT REFERENCE', 10, true, muted);
  line(invoice.paymentId || 'Not recorded', 10);
  y -= 15;
  line('This receipt records the confirmed payment total.', 10, false, muted);
  line('It is not a GST tax invoice. No unverified tax split is shown.', 10, false, muted);
  y -= 25;
  line('Thank you for using DMPilot.', 11, true);
  line('Support: support@dmpilot.org', 10, false, muted);
  return doc.save();
}
