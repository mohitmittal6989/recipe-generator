/**
 * Validates and normalizes a recipe object returned by the backend or AI.
 * If fields are missing or unexpected, it repairs them where possible.
 * If critical fields cannot be salvaged, returns { isValid: false, error }.
 *
 * @param {any} rawRecipe
 * @returns {{ isValid: boolean, error?: string, recipe: object | null }}
 */
export function validateAndNormalizeRecipe(rawRecipe) {
  if (!rawRecipe || typeof rawRecipe !== "object") {
    return {
      isValid: false,
      error: "The recipe data is empty or invalid.",
      recipe: null,
    };
  }

  // 1. Title validation & fallback
  const title =
    typeof rawRecipe.title === "string" && rawRecipe.title.trim().length > 0
      ? rawRecipe.title.trim()
      : typeof rawRecipe.name === "string" && rawRecipe.name.trim().length > 0
      ? rawRecipe.name.trim()
      : "Delicious Custom Recipe";

  // 2. Ingredients validation & normalization
  const rawIngredients =
    Array.isArray(rawRecipe.ingredients) && rawRecipe.ingredients.length > 0
      ? rawRecipe.ingredients
      : Array.isArray(rawRecipe.ingredientList) && rawRecipe.ingredientList.length > 0
      ? rawRecipe.ingredientList
      : Array.isArray(rawRecipe.items) && rawRecipe.items.length > 0
      ? rawRecipe.items
      : [];

  const ingredients = rawIngredients
    .map((item, idx) => {
      if (typeof item === "string" && item.trim()) {
        return {
          name: item.trim(),
          quantity: null,
          used: false,
          usedQuantity: null,
        };
      }
      if (item && typeof item === "object") {
        const name =
          typeof item.name === "string" && item.name.trim()
            ? item.name.trim()
            : typeof item.ingredient === "string" && item.ingredient.trim()
            ? item.ingredient.trim()
            : `Ingredient ${idx + 1}`;
        const quantity = item.quantity ? String(item.quantity).trim() : null;
        return {
          name,
          quantity,
          used: Boolean(item.used),
          usedQuantity: item.usedQuantity ? String(item.usedQuantity).trim() : null,
        };
      }
      return null;
    })
    .filter(Boolean);

  // 3. Instructions validation & normalization
  const rawInstructions =
    Array.isArray(rawRecipe.instructions) && rawRecipe.instructions.length > 0
      ? rawRecipe.instructions
      : Array.isArray(rawRecipe.steps) && rawRecipe.steps.length > 0
      ? rawRecipe.steps
      : Array.isArray(rawRecipe.directions) && rawRecipe.directions.length > 0
      ? rawRecipe.directions
      : Array.isArray(rawRecipe.method) && rawRecipe.method.length > 0
      ? rawRecipe.method
      : [];

  let instructions = [];
  if (rawInstructions.length > 0) {
    instructions = rawInstructions
      .map((item, idx) => {
        if (typeof item === "string" && item.trim()) {
          return { step: idx + 1, description: item.trim() };
        }
        if (item && typeof item === "object") {
          const desc =
            item.description || item.text || item.stepText || item.instruction || String(item);
          return {
            step: typeof item.step === "number" ? item.step : idx + 1,
            description: String(desc).trim(),
          };
        }
        return null;
      })
      .filter((s) => s && s.description.length > 0);
  } else if (typeof rawRecipe.instructions === "string" && rawRecipe.instructions.trim()) {
    instructions = rawRecipe.instructions
      .split(/\n+|\d+\.\s+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((desc, idx) => ({ step: idx + 1, description: desc }));
  }

  // Check critical fields
  if (ingredients.length === 0 && instructions.length === 0) {
    return {
      isValid: false,
      error: "The recipe is missing both ingredients and preparation instructions.",
      recipe: null,
    };
  }

  // 4. Nutrition normalization with safe fallbacks
  const rawNutrition =
    rawRecipe.nutrition && typeof rawRecipe.nutrition === "object" ? rawRecipe.nutrition : {};
  const nutrition = {
    calories: rawNutrition.calories ? String(rawNutrition.calories) : "N/A",
    protein: rawNutrition.protein ? String(rawNutrition.protein) : "N/A",
    carbs: rawNutrition.carbs ? String(rawNutrition.carbs) : "N/A",
    fat: rawNutrition.fat ? String(rawNutrition.fat) : "N/A",
    fiber: rawNutrition.fiber ? String(rawNutrition.fiber) : "N/A",
  };

  // 5. Dietary tags & suggestions
  const dietaryTags = Array.isArray(rawRecipe.dietaryTags)
    ? rawRecipe.dietaryTags.filter((t) => typeof t === "string" && t.trim())
    : [];

  const servingSuggestions = Array.isArray(rawRecipe.servingSuggestions)
    ? rawRecipe.servingSuggestions.filter((s) => typeof s === "string" && s.trim())
    : [];

  // 6. Meta attributes
  const difficulty = ["Easy", "Medium", "Hard"].includes(rawRecipe.difficulty)
    ? rawRecipe.difficulty
    : "Medium";
  const prepTime = rawRecipe.prepTime ? String(rawRecipe.prepTime) : "15 mins";
  const cookTime = rawRecipe.cookTime ? String(rawRecipe.cookTime) : "25 mins";
  const servings = rawRecipe.servings ? String(rawRecipe.servings) : "2";

  return {
    isValid: true,
    recipe: {
      ...rawRecipe,
      title,
      ingredients,
      instructions,
      nutrition,
      dietaryTags,
      servingSuggestions,
      difficulty,
      prepTime,
      cookTime,
      servings,
    },
  };
}
