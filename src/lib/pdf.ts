// Web: open the print window, where people pick "Save as PDF". (Phones use pdf.native.ts.)

/** Turn report HTML into a PDF and let the person save or share it. */
export async function sharePdf(html: string, _filename: string): Promise<'ok' | 'failed'> {
  if (typeof document === 'undefined') return 'failed';
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f);
  const d = f.contentWindow?.document;
  if (!d) return 'failed';
  d.open();
  d.write(html);
  d.close();
  await new Promise((r) => setTimeout(r, 400));
  f.contentWindow?.focus();
  f.contentWindow?.print();
  setTimeout(() => f.remove(), 2000);
  return 'ok';
}

export const pdfIsPrint = true;
