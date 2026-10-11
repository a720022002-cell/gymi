/** Web: open the report and the browser's print dialog ("Save as PDF"). */
export async function shareCyclePdf(html: string, filename: string) {
  if (typeof window === 'undefined') return false;
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(html.replace('<title></title>', `<title>${filename}</title>`));
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
  return true;
}
