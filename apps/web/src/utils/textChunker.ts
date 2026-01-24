/**
 * Splits text into chunks suitable for TTS (max 200 chars each).
 * Strips markdown formatting before chunking.
 */
export function chunkText(text: string, maxLen: number = 200): string[] {
  // Strip markdown formatting
  let clean = text
    .replace(/#{1,6}\s+/g, '') // headers
    .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
    .replace(/\*([^*]+)\*/g, '$1') // italic
    .replace(/`([^`]+)`/g, '$1') // inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/^[-*•]\s+/gm, '') // bullets
    .replace(/^\d+\.\s+/gm, '') // numbered lists
    .replace(/\n{2,}/g, '\n') // collapse multiple newlines
    .trim();

  if (clean.length <= maxLen) {
    return clean ? [clean] : [];
  }

  const chunks: string[] = [];
  let remaining = clean;

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining.trim());
      break;
    }

    let splitAt = -1;

    // Try sentence boundaries first
    const sentenceEnders = ['. ', '! ', '? '];
    for (const ender of sentenceEnders) {
      const idx = remaining.lastIndexOf(ender, maxLen);
      if (idx > 0 && idx > splitAt) {
        splitAt = idx + ender.length - 1;
      }
    }

    // Try comma/clause boundaries
    if (splitAt === -1) {
      const commaIdx = remaining.lastIndexOf(', ', maxLen);
      if (commaIdx > 0) {
        splitAt = commaIdx + 1;
      }
    }

    // Fall back to word boundaries
    if (splitAt === -1) {
      const spaceIdx = remaining.lastIndexOf(' ', maxLen);
      if (spaceIdx > 0) {
        splitAt = spaceIdx;
      } else {
        splitAt = maxLen;
      }
    }

    const chunk = remaining.slice(0, splitAt + 1).trim();
    if (chunk) {
      chunks.push(chunk);
    }
    remaining = remaining.slice(splitAt + 1).trim();
  }

  return chunks.filter(c => c.length > 0);
}
