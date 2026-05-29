const { MercadoPagoConfig, PreApproval } = require('mercadopago');

const client = new MercadoPagoConfig({ 
  accessToken: "APP_USR-776711129750872-052523-15a86b68b38c19b2f18977d5270f6528-212710527",
});

const preApproval = new PreApproval(client);

async function test() {
  try {
    const response = await preApproval.create({
      body: {
        reason: "Test Plan",
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: 100,
          currency_id: 'ARS',
        },
        back_url: `https://google.com/dashboard`,
        payer_email: "test@user.com",
        external_reference: `tenant_test`,
      }
    });
    console.log(response);
  } catch (err) {
    console.error("ERROR", err.message);
    if (err.cause) console.error(err.cause);
  }
}

test();
