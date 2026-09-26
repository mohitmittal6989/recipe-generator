const { generateAIText, analyzeAIVision } = require("../config/aiService");
const Recipe = require("../models/Recipe");

// ── POST /api/recipes/analyze ────────────────────────────────
const analyzeImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file uploaded" });
    }

    // Convert buffer to Base64 with MIME type
    const base64Image = req.file.buffer.toString("base64");
    const mimeType = req.file.mimetype;
    const prompt =
      'Analyze this food image carefully. Identify all visible ingredients, food items, or dishes. Return ONLY a JSON array of ingredient names. Example: ["tomato", "onion", "chicken", "rice"]. If this is a prepared dish, identify the dish name and its likely ingredients.';

    let text = "";
    try {
      text = await analyzeAIVision(base64Image, mimeType, prompt);
    } catch (apiError) {
      console.error("AI vision call failed:", apiError.message);
      if (apiError.name === "TimeoutError") {
        return res.status(504).json({ error: "Image analysis timed out. Please try again." });
      }
      return res.status(502).json({ error: apiError.message || "Failed to analyze image with AI" });
    }

    // STEP C: Parse JSON array from the response safely
    const jsonMatch = text.match(/\[[\s\S]*?\]/);
    let ingredients = [];

    if (jsonMatch) {
      try {
        ingredients = JSON.parse(jsonMatch[0]);
      } catch {
        // Fallback: split comma-separated plain text if JSON is malformed
        try {
          const cleaned = jsonMatch[0].replace(/,\s*([\]}])/g, "$1");
          ingredients = JSON.parse(cleaned);
        } catch {
          ingredients = text
            .replace(/[\[\]"]/g, "")
            .split(",")
            .map((i) => i.trim())
            .filter(Boolean);
        }
      }
    } else {
      ingredients = text
        .replace(/[\[\]"]/g, "")
        .split(",")
        .map((i) => i.trim())
        .filter(Boolean);
    }

    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(422).json({
        error: "No ingredients could be detected in this photo. Please try a clearer image or type ingredients directly.",
        rawResponse: text.slice(0, 300),
      });
    }

    res.json({ ingredients, rawResponse: text });
  } catch (error) {
    console.error("Image analysis error:", error);
    res.status(500).json({ error: "Failed to analyze image. Please try again." });
  }
};

// ── Helper: Rule-based Ingredient Parser ───────────────────────
function parseIngredientsRuleBased(text) {
  if (!text || typeof text !== "string") return [];

  const units =
    "tablespoons?|tbsp|teaspoons?|tsp|cups?|grams?|g|kilograms?|kg|milliliters?|ml|liters?|l|ounces?|oz|pounds?|lbs?|pinche?s?|cloves?|slices?|pieces?|bunche?s?|handfuls?|packages?|packs?|cans?|stalks?|sprigs?";
  const amountRegex = new RegExp(
    `^((?:(?:\\d+(?:\\s+\\d+\\/\\d+|\\/\\d+|\\.\\d+)?|\\d*\\.\\d+|\\d+\\/\\d+)\\s*(?:(?:${units})\\b)?)|(?:a\\s+(?:pinch|dash|handful)(?:\\s+of)?))(?:\\s+(?:of\\s+)?|\\s*)(.+)$`,
    "i"
  );

  const lines = text.split(/[\r\n]+/);
  const items = [];

  for (const rawLine of lines) {
    const trimmedLine = rawLine.trim();
    if (!trimmedLine) continue;

    const parts =
      trimmedLine.includes(",") || trimmedLine.includes(";")
        ? trimmedLine.split(/[,;]+/)
        : [trimmedLine];

    for (let part of parts) {
      part = part.trim();
      if (!part) continue;

      // Remove bullet points
      part = part.replace(/^[\s*•\-–—]+/, "");
      // Remove numbered list prefixes like "1. " or "1) "
      part = part.replace(/^\d+[\.\)\-]\s+/, "");
      part = part.trim();
      if (!part) continue;

      const match = part.match(amountRegex);
      if (match && match[2] && match[2].trim()) {
        items.push({
          name: match[2].trim().replace(/[.,;]+$/, ""),
          amount: match[1].trim().replace(/\s+of$/i, ""),
        });
      } else {
        items.push({
          name: part.replace(/[.,;]+$/, ""),
          amount: null,
        });
      }
    }
  }

  const seen = new Set();
  return items.filter((it) => {
    const key = it.name.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── POST /api/recipes/parse-text ─────────────────────────────
const parseIngredientsText = async (req, res) => {
  try {
    const rawText = req.body.text || req.body.ingredients;
    const text =
      typeof rawText === "string"
        ? rawText
        : Array.isArray(rawText)
        ? rawText.join(", ")
        : "";

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Please enter some ingredients" });
    }

    const trimmedText = text.trim();
    let ingredients = [];

    // Attempt AI-assisted parsing if API key is present
    if (process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY) {
      try {
        const reply = await generateAIText(
          trimmedText,
          "You are a professional culinary assistant. Extract ingredients from the user's text. Return ONLY a valid JSON array of objects with 'name' (string) and 'amount' (string or null). Example: [{\"name\": \"tomato\", \"amount\": \"2\"}, {\"name\": \"olive oil\", \"amount\": null}]. Do not output markdown backticks."
        );

        const jsonMatch = reply?.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            ingredients = parsed
              .map((item) => {
                if (typeof item === "string") {
                  return { name: item.trim(), amount: null };
                }
                return {
                  name: String(item.name || "").trim(),
                  amount: item.amount ? String(item.amount).trim() : null,
                };
              })
              .filter((item) => item.name.length > 0);
          }
        }
      } catch (aiErr) {
        console.warn("AI text parsing skipped/failed:", aiErr.message);
      }
    }

    // Fallback: rule-based parser
    if (ingredients.length === 0) {
      ingredients = parseIngredientsRuleBased(trimmedText);
    }

    if (ingredients.length === 0) {
      return res.status(400).json({ error: "Could not detect any ingredients. Please check your input." });
    }

    res.json({ ingredients });
  } catch (error) {
    console.error("Text parsing error:", error);
    res.status(500).json({ error: "Failed to parse ingredients" });
  }
};

// ── POST /api/recipes/generate ───────────────────────────────
const generateRecipe = async (req, res) => {
  try {
    const { ingredients, dietaryPreference } = req.body;

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({ error: "At least one ingredient is required" });
    }

    if (!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        error: "AI service key is not configured. Please add GEMINI_API_KEY or GROQ_API_KEY to your .env file.",
      });
    }

    // STEP A: Build dietary filter
    const dietFilter = dietaryPreference
      ? `The recipe MUST be ${dietaryPreference}-friendly.`
      : "";

    // STEP B: Construct structured JSON prompt
    const prompt = `You are a professional chef and nutritionist. Based on these ingredients: ${ingredients.join(", ")}.
${dietFilter}

Generate a detailed recipe in the following JSON format (return ONLY valid JSON, no markdown codeblocks):
{
  "title": "Recipe Name",
  "ingredients": [{"name": "ingredient name", "quantity": "amount needed"}],
  "instructions": [{"step": 1, "description": "Step description"}],
  "nutrition": {
    "calories": "approximate calories per serving",
    "protein": "protein in grams",
    "carbs": "carbs in grams",
    "fat": "fat in grams",
    "fiber": "fiber in grams"
  },
  "servings": "number of servings",
  "prepTime": "preparation time",
  "cookTime": "cooking time",
  "difficulty": "Easy/Medium/Hard",
  "dietaryTags": ["applicable tags from: vegan, vegetarian, keto, gluten-free, dairy-free, low-carb, high-protein, paleo"],
  "servingSuggestions": ["suggestion 1", "suggestion 2"]
}`;

    const availableIngredients = req.body.availableIngredients || [];

    // STEP C: Call AI Text with fallback
    let text = "";
    try {
      text = await generateAIText(prompt);
    } catch (apiError) {
      console.error("AI recipe generation call failed:", apiError.message);
      if (apiError.name === "TimeoutError") {
        return res.status(504).json({
          error: "Recipe generation timed out. Please click 'Try again'.",
        });
      }
      return res.status(502).json({
        error: apiError.message || "Failed to communicate with AI service. Please try again.",
      });
    }

    // STEP D: Parse JSON object from response with dedicated try/catch & healing
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON found in recipe response:", text.slice(0, 300));
      return res.status(422).json({
        error: "The AI model returned text that did not contain a valid recipe structure. Please click 'Try again'.",
        rawResponse: text.slice(0, 300),
      });
    }

    let recipe = null;
    try {
      recipe = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      try {
        const cleaned = jsonMatch[0]
          .replace(/,\s*([\]}])/g, "$1") // strip trailing commas
          .replace(/[\x00-\x1F\x7F-\x9F]/g, " "); // strip control chars
        recipe = JSON.parse(cleaned);
      } catch (retryError) {
        console.error("Recipe JSON parse failed:", parseError.message, "Snippet:", jsonMatch[0].slice(0, 200));
        return res.status(422).json({
          error: "The AI model produced malformed JSON. Please click 'Try again' to generate a fresh recipe.",
          rawResponse: text.slice(0, 300),
        });
      }
    }

    if (!recipe || typeof recipe !== "object") {
      return res.status(422).json({
        error: "The AI model returned an invalid recipe payload. Please click 'Try again'.",
      });
    }

    // STEP E: Validate required fields (title, ingredients, instructions/steps)
    const title = typeof recipe.title === "string" ? recipe.title.trim() : "";
    const rawIngredients = Array.isArray(recipe.ingredients)
      ? recipe.ingredients
      : (Array.isArray(recipe.ingredientList) ? recipe.ingredientList : (Array.isArray(recipe.items) ? recipe.items : []));

    const rawInstructions = Array.isArray(recipe.instructions)
      ? recipe.instructions
      : (Array.isArray(recipe.steps) ? recipe.steps : (Array.isArray(recipe.directions) ? recipe.directions : []));

    if (!title || rawIngredients.length === 0 || rawInstructions.length === 0) {
      const missing = [];
      if (!title) missing.push("title");
      if (rawIngredients.length === 0) missing.push("ingredients");
      if (rawInstructions.length === 0) missing.push("instructions/steps");

      console.warn("Recipe response missing required fields:", missing);
      return res.status(422).json({
        error: `The AI response was missing expected recipe details (${missing.join(", ")}). Please click 'Try again'.`,
        rawResponse: text.slice(0, 300),
      });
    }

    // STEP F: Normalize fields into canonical shape
    recipe.title = title;

    recipe.ingredients = rawIngredients.map((item, idx) => {
      if (typeof item === "string") {
        return { name: item.trim(), quantity: null };
      }
      return {
        name: typeof item.name === "string" && item.name.trim() ? item.name.trim() : `Ingredient ${idx + 1}`,
        quantity: item.quantity ? String(item.quantity).trim() : null,
      };
    }).filter((i) => i.name.length > 0);

    recipe.instructions = rawInstructions.map((item, idx) => {
      if (typeof item === "string") {
        return { step: idx + 1, description: item.trim() };
      }
      return {
        step: typeof item.step === "number" ? item.step : idx + 1,
        description: item.description || item.text || item.stepText || String(item || ""),
      };
    }).filter((s) => s.description.length > 0);

    if (!recipe.nutrition || typeof recipe.nutrition !== "object") {
      recipe.nutrition = {
        calories: "N/A",
        protein: "N/A",
        carbs: "N/A",
        fat: "N/A",
        fiber: "N/A",
      };
    }

    recipe.dietaryTags = Array.isArray(recipe.dietaryTags)
      ? recipe.dietaryTags.filter((t) => typeof t === "string")
      : [];

    recipe.servingSuggestions = Array.isArray(recipe.servingSuggestions)
      ? recipe.servingSuggestions.filter((s) => typeof s === "string")
      : [];

    recipe.difficulty = ["Easy", "Medium", "Hard"].includes(recipe.difficulty)
      ? recipe.difficulty
      : "Medium";

    recipe.prepTime = recipe.prepTime ? String(recipe.prepTime) : "15 mins";
    recipe.cookTime = recipe.cookTime ? String(recipe.cookTime) : "25 mins";
    recipe.servings = recipe.servings ? String(recipe.servings) : "2";

    // STEP G: Attach detected ingredients
    recipe.detectedIngredients = ingredients;

    // STEP H: Mark satisfied ingredients
    const provided = (availableIngredients.length > 0)
      ? availableIngredients.map((i) => ({ name: String(i.name || "").toLowerCase(), amount: i.amount }))
      : (Array.isArray(ingredients) ? ingredients.map((i) => String(i).toLowerCase()) : []);

    recipe.ingredients = recipe.ingredients.map((ing) => {
      const name = String(ing.name || "");
      const q = ing.quantity || null;
      const lowerName = name.toLowerCase();

      let used = false;
      let usedQuantity = null;

      if (Array.isArray(provided) && provided.length > 0) {
        const match = provided.find((p) => {
          const pn = typeof p === "string" ? p : String(p.name || "").toLowerCase();
          return lowerName.includes(pn) || pn.includes(lowerName);
        });

        if (match) {
          used = true;
          usedQuantity = typeof match === "string" ? q : (match.amount || q);
        }
      }

      return {
        ...ing,
        used,
        usedQuantity,
      };
    });

    res.json({ recipe });
  } catch (error) {
    console.error("Recipe generation error:", error);
    res.status(500).json({ error: error.message || "Failed to generate recipe. Please click 'Try again'." });
  }
};

// ── POST /api/recipes/suggestions ───────────────────────────
const generateMultipleRecipes = async (req, res) => {
  try {
    const {
      ingredients,
      dietaryPreference,
      minProtein,
      maxCookTime,
      difficulty,
      cuisine,
    } = req.body;

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({ error: "Ingredients are required" });
    }

    if (!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        error: "AI service key is not configured. Please add GROQ_API_KEY to your .env file.",
      });
    }

    const constraints = [];
    if (dietaryPreference) constraints.push(`be ${dietaryPreference}-friendly`);
    if (minProtein) constraints.push(`provide at least ${minProtein}g protein per serving`);
    if (maxCookTime) constraints.push(`have total cook time <= ${maxCookTime} minutes`);
    if (difficulty) constraints.push(`be of difficulty ${difficulty}`);
    if (cuisine) constraints.push(`lean towards ${cuisine} cuisine`);

    const constraintText = constraints.length
      ? `Constraints: ${constraints.join("; ")}.`
      : "";

    const prompt = `You are a professional chef. Based on these ingredients: ${ingredients.join(", ")}.
${constraintText}

Suggest 3 different recipes that can be made using primarily the provided ingredients. For each recipe include title, a one-line description, estimated cookTime (minutes), difficulty (Easy/Medium/Hard), and dietaryTags. Return ONLY a valid JSON array (no markdown):
[
  {
    "title": "Recipe Name",
    "description": "Brief 1-line description",
    "difficulty": "Easy/Medium/Hard",
    "cookTime": "estimated time in minutes",
    "dietaryTags": ["applicable tags"]
  }
]`;

    let text = "";
    try {
      text = await generateAIText(prompt);
    } catch (apiError) {
      console.error("AI suggestions call failed:", apiError.message);
      if (apiError.name === "TimeoutError") {
        return res.status(504).json({ error: "Recipe suggestions timed out. Please click 'Try again'." });
      }
      return res.status(502).json({ error: apiError.message || "Failed to generate suggestions. Please try again." });
    }

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("Suggestions parse failed, raw response:", text);
      return res.status(422).json({ error: "Failed to parse recipe suggestions from AI. Please try again." });
    }

    let suggestions = [];
    try {
      suggestions = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      try {
        const cleaned = jsonMatch[0].replace(/,\s*([\]}])/g, "$1");
        suggestions = JSON.parse(cleaned);
      } catch (retryError) {
        console.error("Suggestions JSON parse failed:", parseError.message);
        return res.status(422).json({ error: "AI produced invalid suggestions format. Please try again." });
      }
    }

    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      return res.status(422).json({ error: "No suggestions could be extracted. Please try again." });
    }

    // Normalize suggestion items
    const normalizedSuggestions = suggestions
      .filter((s) => s && typeof s === "object" && s.title)
      .map((s) => ({
        title: String(s.title).trim(),
        description: s.description ? String(s.description).trim() : "",
        difficulty: ["Easy", "Medium", "Hard"].includes(s.difficulty) ? s.difficulty : "Medium",
        cookTime: s.cookTime ? String(s.cookTime) : "30 mins",
        dietaryTags: Array.isArray(s.dietaryTags) ? s.dietaryTags.filter((t) => typeof t === "string") : [],
      }));

    if (normalizedSuggestions.length === 0) {
      return res.status(422).json({ error: "AI response did not contain valid recipe ideas. Please try again." });
    }

    res.json({ suggestions: normalizedSuggestions });
  } catch (error) {
    console.error("Multiple recipe error:", error);
    res.status(500).json({ error: "Failed to generate suggestions. Please try again." });
  }
};

// ── POST /api/recipes/save ───────────────────────────────────
const saveRecipe = async (req, res) => {
  try {
    const recipe = new Recipe(req.body);
    const saved = await recipe.save();
    res.status(201).json(saved);
  } catch (error) {
    console.error("Save recipe error:", error);
    res.status(500).json({ error: "Failed to save recipe" });
  }
};

// ── GET /api/recipes/saved ───────────────────────────────────
const getSavedRecipes = async (req, res) => {
  try {
    const { diet, difficulty, search } = req.query;
    const filter = {};

    if (diet)       filter.dietaryTags  = diet;
    if (difficulty) filter.difficulty   = difficulty;
    if (search)     filter.title        = { $regex: search, $options: "i" };

    const recipes = await Recipe.find(filter).sort({ createdAt: -1 });
    res.json(recipes);
  } catch (error) {
    console.error("Get recipes error:", error);
    res.status(500).json({ error: "Failed to fetch recipes" });
  }
};

// ── GET /api/recipes/saved/:id ───────────────────────────────
const getRecipeById = async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) {
      return res.status(404).json({ error: "Recipe not found" });
    }
    res.json(recipe);
  } catch (error) {
    console.error("Get recipe error:", error);
    res.status(500).json({ error: "Failed to fetch recipe" });
  }
};

// ── DELETE /api/recipes/saved/:id ────────────────────────────
const deleteRecipe = async (req, res) => {
  try {
    const recipe = await Recipe.findByIdAndDelete(req.params.id);
    if (!recipe) {
      return res.status(404).json({ error: "Recipe not found" });
    }
    res.json({ message: "Recipe deleted successfully" });
  } catch (error) {
    console.error("Delete recipe error:", error);
    res.status(500).json({ error: "Failed to delete recipe" });
  }
};

module.exports = {
  analyzeImage,
  parseIngredientsText,
  parseIngredientsRuleBased,
  generateRecipe,
  generateMultipleRecipes,
  saveRecipe,
  getSavedRecipes,
  getRecipeById,
  deleteRecipe,
};