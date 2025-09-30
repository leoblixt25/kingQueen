import { loadStripe } from '@stripe/stripe-js';

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export { stripePromise };

export interface PaymentIntentData {
  amount: number; // in cents (e.g., 5000 = $50.00)
  currency: string;
  description: string;
  metadata?: {
    playerName: string;
    playerEmail: string;
    gender: string;
    tournamentName: string;
  };
}

export const createPaymentIntent = async (paymentData: PaymentIntentData) => {
  try {
    const response = await fetch('/api/create-payment-intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paymentData),
    });

    if (!response.ok) {
      throw new Error('Failed to create payment intent');
    }

    const { client_secret } = await response.json();
    return client_secret;
  } catch (error) {
    console.error('Error creating payment intent:', error);
    throw error;
  }
};