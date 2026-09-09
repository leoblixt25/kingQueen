import { useState } from 'react';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CreditCard, Check, X } from 'lucide-react';

interface PaymentFormProps {
  amount: number; // in cents
  playerName: string;
  playerEmail: string;
  gender: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function PaymentForm({ 
  amount, 
  playerName, 
  playerEmail, 
  gender, 
  onSuccess, 
  onCancel 
}: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setPaymentError(null);

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setPaymentError('Card element not found');
      setIsProcessing(false);
      return;
    }

    try {
      // Create payment intent on the server
      const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          currency: 'usd',
          description: `Tournament Registration - ${playerName}`,
          metadata: {
            playerName,
            playerEmail,
            gender,
            tournamentName: 'King & Queen of the Beach',
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create payment intent');
      }

      const { client_secret } = await response.json();

      // Confirm payment with Stripe
      const { error, paymentIntent } = await stripe.confirmCardPayment(client_secret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: playerName,
            email: playerEmail,
          },
        },
      });

      if (error) {
        setPaymentError(error.message || 'Payment failed');
        toast({
          title: "Payment Failed",
          description: error.message || "Please try again",
          variant: "destructive",
        });
      } else if (paymentIntent.status === 'succeeded') {
        setPaymentSuccess(true);
        
        // Call success callback after a short delay to show success state
        setTimeout(() => {
          onSuccess();
        }, 2000);
      }
    } catch (error: any) {
      setPaymentError(error.message || 'Payment processing failed');
      toast({
        title: "Payment Error",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (paymentSuccess) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="p-6 text-center">
          <div className="mb-4">
            <Check className="w-16 h-16 text-green-500 mx-auto" />
          </div>
          <h3 className="text-xl font-bold text-green-700 mb-2">Payment Successful!</h3>
          <p className="text-gray-600 mb-4">
            Your tournament registration payment has been processed successfully.
          </p>
          <div className="bg-green-50 p-3 rounded-lg text-sm text-green-700">
            Amount: ${(amount / 100).toFixed(2)} USD
          </div>
        </CardContent>
      </Card>
    );
  }

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        '::placeholder': {
          color: '#aab7c4',
        },
      },
      invalid: {
        color: '#9e2146',
      },
    },
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-center flex items-center justify-center gap-2">
          <CreditCard className="w-5 h-5" />
          Complete Payment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-semibold text-blue-900 mb-2">Registration Details</h4>
          <div className="text-sm text-blue-800 space-y-1">
            <p><strong>Player:</strong> {playerName}</p>
            <p><strong>Division:</strong> {gender.charAt(0).toUpperCase() + gender.slice(1)}</p>
            <p><strong>Amount:</strong> ${(amount / 100).toFixed(2)} USD</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Card Information
            </label>
            <div className="p-3 border border-gray-300 rounded-md bg-white">
              <CardElement options={cardElementOptions} />
            </div>
          </div>

          {paymentError && (
            <Alert variant="destructive">
              <X className="h-4 w-4" />
              <AlertDescription>{paymentError}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isProcessing}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!stripe || isProcessing}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                `Pay $${(amount / 100).toFixed(2)}`
              )}
            </Button>
          </div>
        </form>

        <div className="text-xs text-gray-500 text-center">
          <p>🔒 Your payment information is secure and encrypted.</p>
          <p>Powered by Stripe</p>
        </div>
      </CardContent>
    </Card>
  );
}