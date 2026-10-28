/**
 * seller.js — how the store names who sells a piece or lesson. No DOM: the store pages,
 * the bag and store-satire.js (which tests load in Node) all import it.
 */
/**
 * Who sells a Kreator listing or bag line: Kaayko's own team (the API's sellerTeam), else an
 * independent teacher or maker. A shop run by Kaayko's staff is never called independent
 * (28 Oct 2026).
 */
export function sellerNote(p) {
  if (p && p.sellerTeam) return 'run by the Kaayko team';
  const lesson = String((p && (p.productType || p.kind)) || '').toLowerCase() === 'lesson';
  return lesson ? 'an independent teacher' : 'an independent maker';
}
