'use client';

import React, { useState, FormEvent } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';

interface CheckoutFormProps {
  clientSecret: string;
}

/**
 * CheckoutForm manages secure submission to Stripe using Stripe Elements.
 * Adheres strictly to PCI-DSS compliance via client-side tokenization.
 */
export const CheckoutForm: React.FC<CheckoutFormProps> = ({ clientSecret }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    // Guard constraint to ensure Stripe loaded properly
    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    // Triggers payment confirmation through Stripe Elements context
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/freelance/payment-success`,
      },
    });

    // Error handling for payment failures (e.g., declined cards)
    if (error) {
      setErrorMessage(error.message ?? 'An unexpected payment error occurred.');
    }

    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-md border border-gray-100">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">Global Payment Method</h2>
      
      <PaymentElement />
      
      {errorMessage && (
        <div className="text-red-500 text-sm mt-3 bg-red-50 p-2 rounded border border-red-200">
          {errorMessage}
        </div>
      )}
      
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full mt-5 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded transition disabled:opacity-50"
      >
        {isProcessing ? 'Processing Payment...' : 'Secure Pay Now'}
      </button>
    </form>
  );
};