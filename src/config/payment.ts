// Payment Configuration
// Toggle payment system on/off easily

export const PAYMENT_CONFIG = {
  // Enable/disable payment requirement
  PAYMENT_ENABLED: false, // Set to true to enable payments
  
  // Registration fee in cents (5000 = $50.00)
  REGISTRATION_FEE: 5000,
  
  // Currency
  CURRENCY: 'usd',
  
  // Display messages
  FREE_REGISTRATION_MESSAGE: 'Registration is currently free! Payment system ready for future activation.',
  PAID_REGISTRATION_MESSAGE: 'Secure payment processing with Stripe. Payment required to complete registration.',
}

// Helper functions
export const getRegistrationFee = () => PAYMENT_CONFIG.PAYMENT_ENABLED ? PAYMENT_CONFIG.REGISTRATION_FEE : 0;
export const getRegistrationFeeDisplay = () => PAYMENT_CONFIG.PAYMENT_ENABLED ? `$${(PAYMENT_CONFIG.REGISTRATION_FEE / 100).toFixed(2)}` : 'FREE';
export const isPaymentEnabled = () => PAYMENT_CONFIG.PAYMENT_ENABLED;