const otpStore = new Map();
const OTP_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function saveOtp(identifier, otp) {
  const expiresAt = Date.now() + OTP_EXPIRATION_MS;
  otpStore.set(identifier, { otp, expiresAt });
}

function verifyOtp(identifier, submittedOtp) {
  const record = otpStore.get(identifier);
  if (!record) return false;

  if (record.expiresAt < Date.now()) {
    otpStore.delete(identifier);
    return false;
  }

  const isValid = record.otp === submittedOtp;
  if (isValid) {
    otpStore.delete(identifier);
  }
  return isValid;
}

module.exports = {
  generateOTP,
  saveOtp,
  verifyOtp,
};
