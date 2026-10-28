export function extractType(mimeType: string) {
  return mimeType.split('/').pop() ?? ''
}
