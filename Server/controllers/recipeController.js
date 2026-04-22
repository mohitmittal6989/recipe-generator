const { groq } = require("../config/gemini");
const Recipe = require("../models/Recipe");

// ── POST /api/recipes/analyze ────────────────────────────────
const analyzeImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file uploaded" });
    }

    // STEP A: Convert buffer to Base64 with MIME type
    const base64Image = req.file.buffer.toString("base64");
    const mimeType = req.file.mimetype;

    // STEP B: Call Groq Vision (LLaMA 4 Scout)
    const response = await groq.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
            {
              type: "text",
              text: 'Analyze this food image carefully. Identify all visible ingredients, food items, or dishes. Return ONLY a JSON array of ingredient names. Example: ["tomato", "onion", "chicken", "rice"]. If this is a prepared dish, identify the dish name and its likely ingredients.',
            },
          ],
        },
      ],
      max_tokens: 500,
    });

    const text = response.choices[0].message.content;

    // STEP C: Parse JSON array from the response
    const jsonMatch = text.match(/\[[\s\S]*?\]/);
    let ingredients = [];

    if (jsonMatch) {
      try {
        ingredients = JSON.parse(jsonMatch[0]);
      } catch {
        // Fallback: split comma-separated plain text if JSON is malformed
        ingredients = text
          .replace(/[\[\]"]/g, "")
          .split(",")
          .map((i) => i.trim())
          .filter(Boolean);
      }
    }

    res.json({ ingredients, rawResponse: text });
  } catch (error) {
    console.error("Image analysis error:", error);
    res.status(500).json({ error: "Failed to analyze image" });
  }
};

// ── POST /api/recipes/generate ───────────────────────────────
const generateRecipe = async (req, res) => {
  try {
    const { ingredients, dietaryPreference } = req.body;

    if (!ingredients || ingredients.length === 0) {
      return res.status(400).json({ error: "Ingredients are required" });
    }

    // STEP A: Build the dietary filter string
    const dietFilter = dietaryPreference
      ? `The recipe MUST be${dietaryPreference}-friendly.`
      : "";

    // STEP B: Construct the structured JSON prompt
    const prompt = `You are a professional chef and nutritionist. Based on these ingredients:${ingredients.join(", ")}.
${dietFilter}

Generate a detailed recipe in the following JSON format (return ONLY valid JSON, no markdown):
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

    // STEP C: Call Groq Text (LLaMA 3.3 70B)
    // If availableIngredients provided, use names for prompt but keep amounts
    const availableIngredients = req.body.availableIngredients || [];

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1500,
    });

    const text = response.choices[0].message.content;

    // STEP D: Extract JSON object from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: "Failed to parse recipe" });
    }

    const recipe = JSON.parse(jsonMatch[0]);

    // STEP E: Attach the original detected ingredients
    recipe.detectedIngredients = ingredients;

    // STEP F: Mark which recipe ingredients are satisfied by provided ingredients
    if (Array.isArray(recipe.ingredients)) {
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
          // provided may be array of names or objects {name, amount}
          const match = provided.find((p) => {
            const pn = (typeof p === 'string') ? p : String(p.name || '').toLowerCase();
            return lowerName.includes(pn) || pn.includes(lowerName);
          });

          if (match) {
            used = true;
            usedQuantity = (typeof match === 'string') ? q : (match.amount || q);
          }
        }

        return {
          ...ing,
          used: used,
          usedQuantity: usedQuantity,
        };
      });
    }

    res.json({ recipe });
  } catch (error) {
    console.error("Recipe generation error:", error);
    res.status(500).json({ error: "Failed to generate recipe" });
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

    if (!ingredients || ingredients.length === 0) {
      return res.status(400).json({ error: "Ingredients are required" });
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

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 800,
    });

    const text = response.choices[0].message.content;

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      // Return whole response for debugging if JSON not found
      console.error("Suggestions parse failed, raw response:", text);
      return res.status(500).json({ error: "Failed to parse suggestions from AI" });
    }

    const suggestions = JSON.parse(jsonMatch[0]);
    res.json({ suggestions });
  } catch (error) {
    console.error("Multiple recipe error:", error);
    res.status(500).json({ error: "Failed to generate suggestions" });
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
  generateRecipe,
  generateMultipleRecipes,
  saveRecipe,
  getSavedRecipes,
  getRecipeById,
  deleteRecipe,
};