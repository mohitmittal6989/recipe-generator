const Groq = require("groq-sdk");

// In-memory Groq client
let groqClient = null;
function getGroq() {
  const key = (process.env.GROQ_API_KEY || "").trim();
  if (!key || key === "not-configured") return null;
  if (!groqClient) {
    groqClient = new Groq({ apiKey: key });
  }
  return groqClient;
}

// Timeout wrapper
function withTimeout(promise, timeoutMs = 35000, errorMsg = "AI request timed out") {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(errorMsg);
      err.name = "TimeoutError";
      reject(err);
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
}

/**
 * Robust text generation:
 * 1. Tries Gemini 2.5 Flash if GEMINI_API_KEY is configured.
 * 2. Tries Groq with model fallbacks (qwen/qwen3.8-27b, llama-3.3-70b-versatile, openai/gpt-oss-120b).
 * 3. Seamlessly falls back between providers if one encounters an error.
 */
async function generateAIText(prompt, systemInstruction = "") {
  const geminiKey = (process.env.GEMINI_API_KEY || "").trim();
  const groq = getGroq();

  // Try Gemini first if key available
  if (geminiKey && geminiKey !== "your_gemini_api_key_here") {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
      const payload = {
        contents: [
          {
            parts: [
              { text: systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt },
            ],
          },
        ],
      };
      const res = await withTimeout(
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
        35000,
        "Gemini request timed out"
      );
      const data = await res.json();
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text;
      }
      if (data.error) {
        console.warn("Gemini call returned error, trying Groq fallback:", data.error.message);
      }
    } catch (gErr) {
      console.warn("Gemini call failed, trying Groq fallback:", gErr.message);
    }
  }

  // Fallback to Groq
  if (groq) {
    const models = ["qwen/qwen3.8-27b", "llama-3.3-70b-versatile", "openai/gpt-oss-120b"];
    for (const model of models) {
      try {
        const messages = [];
        if (systemInstruction) messages.push({ role: "system", content: systemInstruction });
        messages.push({ role: "user", content: prompt });

        const response = await withTimeout(
          groq.chat.completions.create({
            model,
            messages,
            max_tokens: 1500,
          }),
          35000,
          "Groq request timed out"
        );
        const text = response.choices?.[0]?.message?.content;
        if (text) return text;
      } catch (qErr) {
        if (qErr.status === 404) continue; // Try next model if 404
        console.warn(`Groq model ${model} failed:`, qErr.message);
      }
    }
  }

  throw new Error("AI service temporarily unavailable. Please verify your GEMINI_API_KEY or GROQ_API_KEY.");
}

/**
 * Robust vision analysis:
 * 1. Uses Gemini 2.5 Flash multimodal vision.
 * 2. Falls back to Groq vision models if configured.
 */
async function analyzeAIVision(base64Image, mimeType, prompt) {
  const geminiKey = (process.env.GEMINI_API_KEY || "").trim();

  if (geminiKey && geminiKey !== "your_gemini_api_key_here") {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
      const res = await withTimeout(
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { inline_data: { mime_type: mimeType, data: base64Image } },
                  { text: prompt },
                ],
              },
            ],
          }),
        }),
        35000,
        "Gemini Vision timed out"
      );
      const data = await res.json();
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text;
      }
      if (data.error) {
        console.warn("Gemini vision error:", data.error.message);
      }
    } catch (e) {
      console.warn("Gemini vision call failed:", e.message);
    }
  }

  // Fallback to Groq vision models
  const groq = getGroq();
  if (groq) {
    const visionModels = ["meta-llama/llama-4-scout-17b-16e-instruct", "llama-3.2-11b-vision-preview"];
    for (const model of visionModels) {
      try {
        const response = await withTimeout(
          groq.chat.completions.create({
            model,
            messages: [
              {
                role: "user",
                content: [
                  { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } },
                  { type: "text", text: prompt },
                ],
              },
            ],
            max_tokens: 500,
          }),
          35000,
          "Groq Vision timed out"
        );
        const text = response.choices?.[0]?.message?.content;
        if (text) return text;
      } catch (err) {
        if (err.status === 404) continue;
      }
    }
  }

  throw new Error("Unable to analyze image. Please ensure GEMINI_API_KEY is configured.");
}

module.exports = {
  generateAIText,
  analyzeAIVision,
  withTimeout,
  getGroq,
};
