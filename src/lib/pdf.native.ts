// Phones: make a real PDF file from the HTML and open the share sheet (Files, WhatsApp, Mail...).
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

/** Turn report HTML into a PDF and let the person save or share it. */
export async function sharePdf(html: string, filename: string): Promise<'ok' | 'failed'> {
  try {
    const { uri } = await Print.printToFileAsync({ html, margins: { left: 24, right: 24, top: 24, bottom: 24 } });
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: filename });
    else await Print.printAsync({ uri });
    return 'ok';
  } catch {
    return 'failed';
  }
}

export const pdfIsPrint = false;
