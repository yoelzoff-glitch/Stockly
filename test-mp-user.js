const { MercadoPagoConfig } = require('mercadopago');

async function test() {
  const token = "APP_USR-776711129750872-052523-15a86b68b38c19b2f18977d5270f6528-212710527";
  const response = await fetch("https://api.mercadopago.com/users/me", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  const data = await response.json();
  console.log(data.site_id);
}
test();
