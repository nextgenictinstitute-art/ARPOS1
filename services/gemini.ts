import { GoogleGenAI } from "@google/genai";
import { Product, Sale } from "../types";

// Define process if it's not available in the global scope to satisfy TS
declare const process: {
  env: {
    API_KEY: string;
  };
};

const getSystemPrompt = (context: string) => `
You are an expert AI Business Consultant for "AR Printers", a premium printing and merchandise shop.
Your goal is to provide deep insights based on the provided POS data.
Always be professional, concise, and offer actionable advice for growth.
Currency: Sri Lankan Rupees (Rs.).
Current Context: ${context}
`;

export const analyzeBusinessData = async (
  sales: Sale[],
  products: Product[],
  query: string
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Summarize data for context
    const lowStock = products.filter(p => p.stock <= p.minStockLevel).map(p => p.name);
    const revenue = sales.reduce((acc, curr) => acc + curr.total, 0);
    const topProducts = [...products].sort((a, b) => b.stock - a.stock).slice(0, 5).map(p => p.name);
    
    const context = `
      Shop Name: AR Printers
      Products Count: ${products.length}
      Revenue to Date: Rs. ${revenue.toFixed(2)}
      Low Stock: ${lowStock.join(', ') || 'None'}
      Key Products: ${topProducts.join(', ')}
      Recent Sales Trend: ${sales.length} orders processed.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Data Summary:\n${context}\n\nUser Analysis Request: ${query}`,
      config: {
        systemInstruction: getSystemPrompt('Analyzing POS Data History'),
      }
    });

    return response.text || "I was unable to analyze the data at this moment.";
  } catch (error) {
    console.error("Gemini AI Error:", error);
    return "The AI consultant is currently unavailable. Please check your connection.";
  }
};

export const generateMarketingCopy = async (productName: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a high-conversion social media post for our product: "${productName}". Include relevant hashtags and emojis. Max 40 words.`,
      config: {
        systemInstruction: "You are a creative advertising genius specializing in print services.",
      }
    });

    return response.text || "No marketing copy could be generated.";
  } catch (error) {
    return "Error generating content.";
  }
};