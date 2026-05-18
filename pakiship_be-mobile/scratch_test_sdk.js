const { TribeClient } = require('@implementsprint/sdk');

async function test() {
  const client = new TribeClient({
    gatewayUrl: 'https://api-center-test.itsandbox.site',
    tribeId: 'pakiapps',
    secret: 'u0ZHblGDbhaFfkIrgFwMs8JIn2GU1rmuct9Z5eK598rva1si'
  });

  try {
    await client.authenticate();
    console.log("Auth success!");
    
    const checkout = await client.paymentCreateCheckoutSession({
      referenceId: `draft-123`,
      idempotencyKey: `checkout-123`,
      successUrl: `pakiship://payment-success?draftId=123`,
      cancelUrl: `pakiship://payment-cancel?draftId=123`,
      paymentMethods: ['gcash', 'maya'],
      lineItems: [
        {
          name: 'Test',
          quantity: 1,
          amount: { value: 10000, currency: 'PHP' },
        },
      ],
    });
    
    console.log("Success:", checkout);
  } catch (error) {
    console.error("Error:", error.message);
    if (error.response) {
      console.error(error.response.data);
    } else {
      console.error(error);
    }
  }
}

test();
