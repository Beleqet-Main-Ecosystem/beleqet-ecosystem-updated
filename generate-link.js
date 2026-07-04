const ngrokUrl = process.argv[2];

if (!ngrokUrl) {
  console.log('❌ Please provide your Ngrok URL as an argument!');
  console.log('Example: node generate-link.js https://1234.ngrok-free.app');
  process.exit(1);
}

const CHAPA_SECRET = 'process.env.CHAPA_SECRET_KEY || 'REPLACE_WITH_YOUR_CHAPA_KEY'';

async function generateLink() {
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
        return_url: 'https://google.com', 
        customization: {
          title: 'Beleqet Test',
          description: 'Testing Webhook via Ngrok'
        }
      }),
    });

    const data = await response.json();
    if (data.status === 'success') {
      console.log('\n✅ SUCCESS! Here is your Checkout URL:');
      console.log(data.data.checkout_url);
      console.log('\nClick the link above, make a payment, and watch your webhook-server terminal!');
    } else {
      console.log('\n❌ Chapa API Error:', data);
    }
  } catch (err) {
    console.error('Failed to generate link:', err.message);
  }
}

generateLink();
