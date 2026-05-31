/**
 * Validates email format using a robust regex pattern.
 * Matches standard email format: local-part@domain
 * Allows alphanumeric, dots, hyphens, underscores, plus signs in local part.
 * Allows alphanumeric and hyphens in domain, with 2+ char TLD.
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;

  const pattern = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  return pattern.test(email.trim());
}

module.exports = { isValidEmail };