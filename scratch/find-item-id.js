async function main() {
  const url = "https://www.mercadolibre.com.ar/collar-cadena-plata-925-dije-corazon-cristal-swarovski-mujer/up/MLAU3911600852";
  console.log("Fetching page...");
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });
  console.log("Status:", res.status);
  console.log("Redirected to:", res.url);
  
  const text = await res.text();
  console.log("HTML length:", text.length);

  // Search for MLA followed by 9-11 digits in the HTML
  const matches = text.match(/MLA\d{9,11}/g);
  if (matches) {
    console.log("Found MLA matches:", [...new Set(matches)]);
  } else {
    console.log("No MLA matches found");
  }

  // Search for product or item config in window.__PRELOADED_STATE__ or similar
  const preloadedMatch = text.match(/MLA-\d{9,11}/g);
  if (preloadedMatch) {
    console.log("Found MLA- matches:", [...new Set(preloadedMatch)]);
  }
}

main().catch(console.error);
