import { GoogleGenAI } from "@google/genai";
import { StudentReport } from "../types";

export const analyzeStudentWithGemini = async (student: StudentReport): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please check your environment configuration.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    You are a senior vocational education consultant in Switzerland. 
    Analyze the following report card data for a student named ${student.name}.
    
    Data:
    - Company: ${student.company}
    - Overall Grade: ${student.printedAverage}
    - Modules & Grades:
    ${student.modules.map(m => `- ${m.moduleName} (${m.moduleId}): ${m.grade}`).join('\n')}

    Please provide a brief, professional summary (max 3 sentences) highlighting their strongest technical areas and any areas of concern. 
    Tone: Professional, constructive, Swiss-German work culture appropriate.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "No analysis generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Unable to generate analysis at this time.";
  }
};