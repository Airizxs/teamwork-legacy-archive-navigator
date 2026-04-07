
import { GoogleGenAI } from "@google/genai";
import { Project, Task, Message } from "../types";

export const getProjectSummary = async (project: Project, tasks: Task[], messages: Message[]): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const taskSummary = tasks.map(t => `- ${t.content} (${t.status})`).join('\n');
  const messageSummaries = messages.map(m => `- ${m.title}: ${m.body.substring(0, 50)}...`).join('\n');

  const prompt = `
    Summarize the historical progress and key outcomes of this archived project from a Teamwork export.
    Project Name: ${project.name}
    Description: ${project.description}
    Tasks:
    ${taskSummary}
    
    Messages/Communication:
    ${messageSummaries}
    
    Provide a concise executive summary of what was achieved and any notable historical context.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "No summary available.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Failed to generate AI summary.";
  }
};
