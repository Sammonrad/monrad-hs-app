/**
 * Weighbridge ticket OCR stub.
 *
 * TODO: Real OCR integration options:
 * 1. Tesseract.js (client-side) — add dependency, run in Web Worker on compressed JPEG.
 *    Pros: no API key, offline-capable. Cons: accuracy on thermal/mobile photos varies.
 * 2. Google Cloud Vision API — server edge function or backend proxy with API key.
 *    Pros: strong accuracy. Cons: cost, network, privacy review for ticket images.
 * 3. Azure Document Intelligence / AWS Textract — similar to Vision for structured forms.
 *
 * NEVER auto-save extracted values — always return suggestions for driver confirmation.
 */

/**
 * @param {string} imageDataUrl - Compressed JPEG data URL from compressImage()
 * @returns {Promise<{
 *   available: boolean,
 *   message: string,
 *   suggested: null | {
 *     ticketNumber?: string,
 *     date?: string,
 *     time?: string,
 *     grossWeightTonnes?: string,
 *     tareWeightTonnes?: string,
 *     netWeightTonnes?: string,
 *     quarrySupplier?: string,
 *     materialProduct?: string,
 *   }
 * }>}
 */
export async function extractQuarryTicketFields(imageDataUrl) {
  void imageDataUrl

  return {
    available: false,
    message: 'Ticket reading is not configured. Enter details manually below.',
    suggested: null,
  }
}
