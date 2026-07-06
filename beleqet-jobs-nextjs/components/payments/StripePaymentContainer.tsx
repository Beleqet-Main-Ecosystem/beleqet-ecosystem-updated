'use client';

import React from 'react';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { CheckoutForm } from './CheckoutForm';

// Initialize Stripe outside of the render cycle to prevent recreating the instance.
// NOTE: Ideally, replace with process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
const stripePromise = loadStripe('pk_test_51TqGhyCAi33db7ha1WVAMHHvueddzt0c7ZdbkJLgeCIpiTYJwzkerzVcLpfsQMWxPbmCFB5KRuMM8J9cGlgoJTaG00aizukSHu');

interface StripePaymentContainerProps {
  clientSecret: string;
}

/**
 * High-Order Container tracking the multi-currency clientSecret received from the NestJS Backend.
 */
export const StripePaymentContainer: React.FC<StripePaymentContainerProps> = ({ clientSecret }) => {
  const options: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: 'stripe',
    },
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      <CheckoutForm clientSecret={clientSecret} />
    </Elements>
  );
};