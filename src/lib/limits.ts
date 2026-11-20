// Input caps shared by the API (validation) and the page (maxLength + counter).
// Kept in its own module so the browser bundle does not pull in the server code.
export const MAX_INPUT_CHARS = 10_000;
