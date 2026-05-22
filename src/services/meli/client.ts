export async function meliFetch(accessToken: string, endpoint: string, options: RequestInit = {}) {
  const url = `https://api.mercadolibre.com${endpoint}`;
  
  const headers = {
    "Authorization": `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error(`Meli API Error [${response.status}] at ${url}:`, errorData);
    throw new Error(`Mercado Libre API Error: ${response.statusText}`);
  }

  return response.json();
}
