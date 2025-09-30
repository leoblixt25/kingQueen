# 💳 Payment Integration Setup Guide

## 🔔 CURRENT STATUS: PAYMENT DISABLED

**Registration is currently FREE!** The payment system has been implemented but is disabled. To enable payments in the future, see the "Enable Payments" section below.

This guide will help you set up Stripe payment processing for tournament registration when you're ready to enable it.

## 🚀 Enable Payments (When Ready)

To enable payments in the future:

### Quick Enable (Simple):
1. Edit `src/config/payment.ts`:
   ```javascript
   PAYMENT_ENABLED: true, // Change from false to true
   ```

2. Follow the setup steps below to configure Stripe

### Manual Enable (Advanced):
1. Uncomment payment modal in `src/components/AuthModal.tsx`
2. Update registration handlers to use payment flow
3. Configure Stripe as described below

---

## 🏗️ Setup Steps

### 1. Create Stripe Account
1. Visit [stripe.com](https://stripe.com) and create an account
2. Complete account verification (may take 1-2 business days)
3. Get your API keys from the Stripe Dashboard

### 2. Get Stripe API Keys
1. Log in to your Stripe Dashboard
2. Click **Developers** → **API keys**
3. Copy your keys:
   - **Publishable key** (starts with `pk_test_` for testing)
   - **Secret key** (starts with `sk_test_` for testing)

### 3. Configure Environment Variables
1. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

2. Update `.env.local` with your Stripe keys:
   ```env
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_actual_key_here
   STRIPE_SECRET_KEY=sk_test_your_actual_key_here
   ```

### 4. Deploy Payment API Endpoint

#### Option A: Netlify (Recommended)
1. Create `netlify/functions/create-payment-intent.js`:
   ```javascript
   const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
   
   exports.handler = async (event, context) => {
     if (event.httpMethod !== 'POST') {
       return { statusCode: 405, body: 'Method Not Allowed' };
     }
   
     try {
       const { amount, currency, description, metadata } = JSON.parse(event.body);
   
       const paymentIntent = await stripe.paymentIntents.create({
         amount,
         currency: currency || 'usd',
         description,
         metadata,
         automatic_payment_methods: { enabled: true },
       });
   
       return {
         statusCode: 200,
         body: JSON.stringify({ client_secret: paymentIntent.client_secret }),
       };
     } catch (error) {
       return {
         statusCode: 500,
         body: JSON.stringify({ error: error.message }),
       };
     }
   };
   ```

2. Add to `netlify.toml`:
   ```toml
   [build]
     functions = "netlify/functions"
   
   [[redirects]]
     from = "/api/*"
     to = "/.netlify/functions/:splat"
     status = 200
   ```

#### Option B: Vercel
1. Create `api/create-payment-intent.js` (already created)
2. Deploy to Vercel

#### Option C: Backend Server
Deploy the API endpoint to your existing backend server.

### 5. Update Payment Amount
Current registration fee is set to **$50.00**. To change:

1. Edit `src/components/AuthModal.tsx`:
   ```javascript
   amount={5000} // Change to desired amount in cents
   ```

2. Update the display text:
   ```javascript
   "Continue to Payment ($50.00)" // Update display amount
   ```

### 6. Test Payment Flow

#### Test Mode (Safe to Use)
- Use test card numbers from [Stripe's testing guide](https://stripe.com/docs/testing)
- Common test cards:
  - **Success**: `4242 4242 4242 4242`
  - **Decline**: `4000 0000 0000 0002`
  - Use any future expiry date and any 3-digit CVC

#### Test the Integration:
1. Start your development server
2. Go to registration page
3. Fill out registration form
4. Click "Continue to Payment"
5. Use test card numbers
6. Verify registration completes after payment

### 7. Go Live (Production)

When ready for real payments:

1. **Activate Stripe Account**:
   - Complete business verification
   - Add bank account for payouts

2. **Switch to Live Keys**:
   ```env
   VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your_live_key
   STRIPE_SECRET_KEY=sk_live_your_live_key
   ```

3. **Set Up Webhooks** (Optional but recommended):
   - Monitor payment events
   - Handle failed payments
   - Automate refunds

## 🔧 Features Implemented

### ✅ What's Working Now:
- **Payment Collection**: $50 registration fee
- **Secure Processing**: PCI-compliant with Stripe
- **Email + Google Registration**: Both flows require payment
- **Mobile Friendly**: Payment form works on all devices
- **Error Handling**: Clear error messages
- **Success Feedback**: Payment confirmation

### 🛡️ Security Features:
- **No Card Data Storage**: Card info never touches your servers
- **Encryption**: All payment data encrypted in transit
- **PCI Compliance**: Handled by Stripe
- **Test Mode**: Safe testing with fake cards

## 💰 Payment Flow

1. **User Registers** → Fills out tournament form
2. **Payment Required** → Shows Stripe payment form  
3. **Card Processing** → Secure payment with Stripe
4. **Registration Complete** → User gets tournament access
5. **Email Confirmation** → Registration confirmed via email

## 📱 User Experience

**For Players:**
- Clear $50.00 fee displayed upfront
- Professional payment form
- Instant feedback on payment status
- Registration only completes after successful payment

**For Admins:**
- View payments in Stripe Dashboard
- Handle refunds if needed
- Monitor registration revenue

## 🚨 Important Notes

1. **Test Thoroughly**: Use Stripe test mode extensively
2. **Backup Plan**: Have manual payment option ready
3. **Customer Support**: Monitor for payment issues
4. **Legal Compliance**: Ensure refund policy is clear
5. **Tax Considerations**: Consult accountant for tax implications

## 🔗 Useful Links

- [Stripe Dashboard](https://dashboard.stripe.com)
- [Stripe Testing Guide](https://stripe.com/docs/testing)
- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Support](https://support.stripe.com)

## 🆘 Troubleshooting

### Payment Not Working?
1. Check API keys are correct
2. Verify endpoint is deployed
3. Check browser console for errors
4. Ensure environment variables are loaded

### Need Help?
- Check Stripe Dashboard for payment details
- Review server logs for API errors
- Test with different browsers/devices
- Contact Stripe support for payment issues