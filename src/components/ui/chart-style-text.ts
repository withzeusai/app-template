/**
 * Keep stylesheet text inside its HTML style element, including during SSR.
 * This encodes an HTML boundary; it does not sanitize arbitrary CSS.
 */
export function encodeChartStyleText(css: string): string {
  const parts: string[] = [];
  let precedingBackslashes = 0;

  for (const character of css) {
    if (character === "<") {
      // An odd final backslash already escapes this character. Reuse it so
      // escaped identifiers/strings retain their CSS value. The space ends
      // the hexadecimal escape without consuming a following hex digit.
      parts.push(precedingBackslashes % 2 === 1 ? "3c " : "\\3c ");
    } else {
      parts.push(character);
    }
    precedingBackslashes = character === "\\" ? precedingBackslashes + 1 : 0;
  }

  return parts.join("");
}
