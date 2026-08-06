const payload = {
  "event": "charge.success",
  "first_name": "Test",
  "last_name": "User",
  "email": "test@beleqet.com",
  "mobile": null,
  "currency": "ETB",
  "amount": "100.00",
  "charge": "2.50",
  "status": "success",
  "failure_reason": null,
  "mode": "test",
  "reference": "AP1CG1Ds7yqSQ",
  "type": "API",
  "tx_ref": "test-tx-1782216777015",
  "payment_method": "test",
  "customization": {
    "title": "Beleqet Test",
    "description": null,
    "logo": null
  },
  "meta": null,
  "created_at": "2026-06-23T12:14:16.000000Z",
  "updated_at": "2026-06-23T12:14:16.000000Z"
};

const signature = "a423b17f8b602e66ab6b9c6a1923ac259a3fa86ab1c7b5754ed72e781daa6d7c";

async function simulate() {
  console.log('Sending exact Chapa payload to localhost:4000...');
  try {
    const res = await fetch('http://localhost:4000/api/v1/escrow/callback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-chapa-signature': signature
      },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    console.log('Response from webhook-server:', text);
  } catch (err) {
    console.error(err);
  }
}
simulate();
