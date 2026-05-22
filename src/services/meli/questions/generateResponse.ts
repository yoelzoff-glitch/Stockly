import OpenAI from "openai";

export async function generateResponse(questionText: string, productData: any): Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const productContext = productData 
    ? `El producto por el que preguntan es: ${productData.title}. Precio: $${productData.price}. Stock: ${productData.available_quantity}.` 
    : "No se encontró información específica del producto.";

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Eres un asistente de ventas amable de Mercado Libre. 
Responde la pregunta del usuario de forma breve, precisa y cordial. 
Basate en esta info del producto: ${productContext}
Si te preguntan por stock y hay > 0, diles que sí hay disponible.`
      },
      {
        role: "user",
        content: questionText
      }
    ],
    temperature: 0.3,
  });

  return completion.choices[0]?.message?.content || "Hola, gracias por tu pregunta. En breve te responderemos con más detalles.";
}
