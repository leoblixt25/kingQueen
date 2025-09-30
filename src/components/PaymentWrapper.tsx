import { Elements } from '@stripe/react-stripe-js';
import { stripePromise } from '@/utils/stripe';
import { PaymentForm } from './PaymentForm';

interface PaymentWrapperProps {
  amount: number; // in cents
  playerName: string;
  playerEmail: string;
  gender: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function PaymentWrapper(props: PaymentWrapperProps) {
  const options = {
    // Pass the amount and currency to the Stripe Elements provider
    mode: 'payment' as const,
    amount: props.amount,
    currency: 'usd',
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md">
        <Elements stripe={stripePromise} options={options}>
          <PaymentForm {...props} />
        </Elements>
      </div>
    </div>
  );
}