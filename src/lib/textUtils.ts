/**
 * Returns a Tailwind font-size class based on text length.
 * Used for dynamic card face sizing across FlashCard.tsx and FlashcardLearn.tsx.
 */
export function getDynamicFontSize(text: string): string {
  const len = text?.length ?? 0
  if (len <= 20)  return 'text-5xl'
  if (len <= 40)  return 'text-4xl'
  if (len <= 80)  return 'text-3xl'
  if (len <= 160) return 'text-2xl'
  if (len <= 300) return 'text-xl'
  return 'text-lg'
}
