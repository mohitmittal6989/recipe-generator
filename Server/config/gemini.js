const Groq = require("groq-sdk");

const apiKey = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || "not-configured";
const groq = new Groq({ apiKey });

module.exports = { groq };