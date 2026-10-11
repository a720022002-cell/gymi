import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

/** Turn the report into a PDF and open the share sheet (mail, WhatsApp, Files…). */
export async function shareCyclePdf(html: string, _filename: string) {
  try {
    const { uri } = await Print.printToFileAsync({ html });
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Cycle health report' });
    return true;
  } catch {
    return false;
  }
}
