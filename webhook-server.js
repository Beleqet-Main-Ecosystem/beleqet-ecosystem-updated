const express = require('express');
const crypto = require('crypto');
const app = express();
const port = 4000;

const CHAPA_SECRET = 'CHASECK_TEST-EGMHJJxUf6NY3GNYgDgJwSF7pIwANKN5';
// NOTE: Set your webhook secret here. If you haven't set one in Chapa yet, 
// you must set it in your Chapa Dashboard -> Settings -> Webhooks, and paste it here.
const WEBHOOK_SECRET = 'CVD18HIsGTJEyd7rDDdg1qDWcouvBNYvHdRQyoUW8SA';

// We use raw body to properly compute the HMAC hash
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

app.post('/api/v1/escrow/callback', (req, res) => {
  console.log('\n=======================================');
  console.log('🔔 INCOMING WEBHOOK FROM CHAPA!');
  
  const signature = req.headers['chapa-signature'] || req.headers['x-chapa-signature'];
  console.log('Received Signature:', signature);

  if (!signature) {
    console.log('❌ Missing signature header!');
    return res.status(401).send('Missing Signature');
  }

  // Verify the signature
  const hash = crypto.createHmac('sha256', WEBHOOK_SECRET)
    .update(req.rawBody)
    .digest('hex');

  console.log('Computed Hash:', hash);

  if (hash !== signature) {
    console.log('❌ Signature verification FAILED! Hash mismatch.');
    return res.status(401).send('Invalid Webhook Signature');
  }

  console.log('✅ Signature verified successfully!');
  console.log('Payload Data:', req.body);
  console.log('=======================================\n');

  // Respond to Chapa with 200 OK so they know we received it
  res.status(200).send('OK');
});

// A route to generate a checkout link using your Ngrok URL
app.post('/generate-link', async (req, res) => {
  const ngrokUrl = req.body.ngrokUrl; // We will pass this in

  console.log(`Generating checkout link with callback: ${ngrokUrl}/api/v1/escrow/callback`);

  try {
    const response = await fetch('https://api.chapa.co/v1/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CHAPA_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: '100',
        currency: 'ETB',
        email: 'test@beleqet.com',
        first_name: 'Test',
        last_name: 'User',
        tx_ref: `test-tx-${Date.now()}`,
        callback_url: `${ngrokUrl}/api/v1/escrow/callback`,
        return_url: 'https://google.com', // Dummy return URL
        customization: {
          title: 'Beleqet Test',
          description: 'Testing Webhook via Ngrok'
        }
      }),
    });

    const data = await response.json();
    if (data.status === 'success') {
      res.json({ checkout_url: data.data.checkout_url });
    } else {
      res.status(400).json(data);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 Webhook test server running on http://localhost:${port}`);
  console.log(`Waiting for Chapa webhooks at /api/v1/escrow/callback ...`);
});
