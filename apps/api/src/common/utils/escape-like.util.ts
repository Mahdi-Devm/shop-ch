/**
 * Escapes LIKE wildcards so user input is matched literally.
 * Postgres default LIKE escape character is the backslash.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
