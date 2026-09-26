import { createContext, useState, useContext, useCallback, useRef } from "react";
import axios from "axios";
import { validateAndNormalizeRecipe } from "../utils/recipeValidator";

const RecipeContext = createContext();

export const useRecipe = () => {
  const context = useContext(RecipeContext);
  if (!context) {
    throw new Error("useRecipe must be used within a RecipeProvider");
  }
  return context;
};

export const RecipeProvider = ({ children }) => {
  const [ingredients,       setIngredients]       = useState([]); // array of { name, amount }
  const [recipe,            setRecipe]            = useState(null);
  const [recipeLoading,     setRecipeLoading]     = useState(false);
  const [recipeError,       setRecipeError]       = useState(null);
  const [suggestions,       setSuggestions]       = useState([]);
  const [savedRecipes,      setSavedRecipes]      = useState([]);
  const [loading,           setLoading]           = useState(false);
  const [error,             setError]             = useState(null);
  const [notice,            setNotice]            = useState(null);
  const [dietaryPreference, setDietaryPreference] = useState("");

  // Refs for race-condition prevention and cancellation
  const generateAbortRef = useRef(null);
  const generateRequestIdRef = useRef(0);
  const lastGenerateArgs = useRef(null);

  const suggestionsAbortRef = useRef(null);
  const suggestionsRequestIdRef = useRef(0);

  const imageAnalyzeAbortRef = useRef(null);
  const imageAnalyzeRequestIdRef = useRef(0);

  const textParseAbortRef = useRef(null);
  const textParseRequestIdRef = useRef(0);

  const API_BASE = "/api/recipes";

  // Rule-based fallback parser on client
  const parseIngredientsClient = (text) => {
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

        part = part.replace(/^[\s*•\-–—]+/, "");
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
  };

  const analyzeImage = useCallback(async (imageFile) => {
    if (imageAnalyzeAbortRef.current) {
      imageAnalyzeAbortRef.current.abort();
    }
    const controller = new AbortController();
    imageAnalyzeAbortRef.current = controller;
    const currentRequestId = ++imageAnalyzeRequestIdRef.current;

    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("image", imageFile);

      const { data } = await axios.post(`${API_BASE}/analyze`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        signal: controller.signal,
        timeout: 45000,
      });

      if (currentRequestId !== imageAnalyzeRequestIdRef.current) return null;

      // normalize to objects with optional amount
      const normalized = (data.ingredients || []).map((ing) => {
        if (typeof ing === "string") return { name: ing.trim(), amount: null };
        return {
          name: String(ing.name || "").trim(),
          amount: ing.amount ? String(ing.amount).trim() : null,
        };
      }).filter((item) => item.name.length > 0);

      setIngredients(normalized);
      return normalized;
    } catch (err) {
      if (axios.isCancel(err) || err.name === "CanceledError" || err.message === "canceled") {
        return null;
      }
      if (currentRequestId !== imageAnalyzeRequestIdRef.current) return null;

      const message =
        err.response?.data?.error ||
        (err.code === "ECONNABORTED" || err.message?.includes("timeout")
          ? "Image analysis timed out. Please try again with a smaller or clearer photo."
          : "Failed to analyze image. Please try again.");
      setError(message);
      throw new Error(message);
    } finally {
      if (currentRequestId === imageAnalyzeRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const parseTextIngredients = useCallback(async (text) => {
    if (!text || !text.trim()) {
      const msg = "Please enter some ingredients";
      setError(msg);
      throw new Error(msg);
    }

    if (textParseAbortRef.current) {
      textParseAbortRef.current.abort();
    }
    const controller = new AbortController();
    textParseAbortRef.current = controller;
    const currentRequestId = ++textParseRequestIdRef.current;

    setLoading(true);
    setError(null);
    try {
      let detected = [];
      try {
        const { data } = await axios.post(
          `${API_BASE}/parse-text`,
          { text },
          { signal: controller.signal, timeout: 35000 }
        );
        if (data && Array.isArray(data.ingredients)) {
          detected = data.ingredients;
        }
      } catch (apiErr) {
        if (axios.isCancel(apiErr)) return null;
        console.warn("Backend parse-text call failed, falling back to client parser:", apiErr.message);
        detected = parseIngredientsClient(text);
      }

      if (currentRequestId !== textParseRequestIdRef.current) return null;

      if (!detected || detected.length === 0) {
        detected = parseIngredientsClient(text);
      }

      const normalized = detected
        .map((ing) => {
          if (typeof ing === "string") {
            return { name: ing.trim(), amount: null };
          }
          return {
            name: String(ing.name || "").trim(),
            amount: ing.amount ? String(ing.amount).trim() : null,
          };
        })
        .filter((item) => item.name.length > 0);

      if (normalized.length === 0) {
        const msg = "Could not detect any ingredients. Please check your input.";
        setError(msg);
        throw new Error(msg);
      }

      setIngredients(normalized);
      return normalized;
    } catch (err) {
      if (axios.isCancel(err) || err.name === "CanceledError" || err.message === "canceled") {
        return null;
      }
      if (currentRequestId !== textParseRequestIdRef.current) return null;

      const message = err.response?.data?.error || err.message || "Failed to parse ingredients";
      setError(message);
      throw new Error(message);
    } finally {
      if (currentRequestId === textParseRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const generateRecipe = useCallback(
    async (ingredientList, diet) => {
      // Abort previous in-flight recipe generation request
      if (generateAbortRef.current) {
        generateAbortRef.current.abort();
      }

      const controller = new AbortController();
      generateAbortRef.current = controller;
      const currentRequestId = ++generateRequestIdRef.current;

      setLoading(true);
      setRecipeLoading(true);
      setError(null);
      setRecipeError(null);

      // Save parameters so the user can easily retry
      lastGenerateArgs.current = { ingredientList, diet };

      try {
        const available =
          ingredientList && Array.isArray(ingredientList) && ingredientList.length > 0 && typeof ingredientList[0] === "object"
            ? ingredientList
            : ingredients;

        const names =
          ingredientList && ingredientList.length > 0
            ? ingredientList.map((i) => (typeof i === "string" ? i : i.name))
            : ingredients.map((i) => i.name);

        if (!names || names.length === 0) {
          const msg = "Please enter or detect at least one ingredient before generating a recipe.";
          setError(msg);
          setRecipeError(msg);
          throw new Error(msg);
        }

        const { data } = await axios.post(
          `${API_BASE}/generate`,
          {
            ingredients: names,
            availableIngredients: available,
            dietaryPreference: diet || dietaryPreference,
          },
          {
            signal: controller.signal,
            timeout: 45000,
          }
        );

        // Discard stale response if a newer request was dispatched
        if (currentRequestId !== generateRequestIdRef.current) {
          return null;
        }

        // Validate and normalize the recipe shape
        const validation = validateAndNormalizeRecipe(data?.recipe);
        if (!validation.isValid) {
          const msg = validation.error || "The AI generated an incomplete recipe. Please click 'Try again'.";
          setError(msg);
          setRecipeError(msg);
          throw new Error(msg);
        }

        setRecipe(validation.recipe);
        return validation.recipe;
      } catch (err) {
        // If aborted, do not overwrite state
        if (axios.isCancel(err) || err.name === "CanceledError" || err.message === "canceled") {
          return null;
        }

        if (currentRequestId !== generateRequestIdRef.current) {
          return null;
        }

        let message = err.response?.data?.error;
        if (!message) {
          if (err.code === "ECONNABORTED" || err.message?.toLowerCase().includes("timeout")) {
            message = "Recipe generation timed out. The AI took too long to respond. Please click 'Try again'.";
          } else if (err.message) {
            message = err.message;
          } else {
            message = "Failed to generate recipe. Please click 'Try again'.";
          }
        }

        setError(message);
        setRecipeError(message);
        throw new Error(message);
      } finally {
        if (currentRequestId === generateRequestIdRef.current) {
          setLoading(false);
          setRecipeLoading(false);
        }
      }
    },
    [ingredients, dietaryPreference]
  );

  const retryGenerateRecipe = useCallback(() => {
    const args = lastGenerateArgs.current || {};
    return generateRecipe(args.ingredientList, args.diet);
  }, [generateRecipe]);

  const getRecipeSuggestions = useCallback(
    async (ingredientList, opts = {}) => {
      if (suggestionsAbortRef.current) {
        suggestionsAbortRef.current.abort();
      }

      const controller = new AbortController();
      suggestionsAbortRef.current = controller;
      const currentRequestId = ++suggestionsRequestIdRef.current;

      setLoading(true);
      setError(null);
      try {
        const available =
          ingredientList && ingredientList.length > 0 && typeof ingredientList[0] === "object"
            ? ingredientList
            : ingredients;

        const names =
          ingredientList && ingredientList.length > 0
            ? ingredientList.map((i) => (typeof i === "string" ? i : i.name))
            : ingredients.map((i) => i.name);

        const body = {
          ingredients: names,
          availableIngredients: available,
          dietaryPreference: opts.dietaryPreference || opts.diet || dietaryPreference,
          minProtein: opts.minProtein,
          maxCookTime: opts.maxCookTime,
          difficulty: opts.difficulty,
          cuisine: opts.cuisine,
        };

        const { data } = await axios.post(`${API_BASE}/suggestions`, body, {
          signal: controller.signal,
          timeout: 45000,
        });

        if (currentRequestId !== suggestionsRequestIdRef.current) {
          return null;
        }

        const list = Array.isArray(data.suggestions) ? data.suggestions : [];
        setSuggestions(list);
        return list;
      } catch (err) {
        if (axios.isCancel(err) || err.name === "CanceledError" || err.message === "canceled") {
          return null;
        }

        if (currentRequestId !== suggestionsRequestIdRef.current) {
          return null;
        }

        const message =
          err.response?.data?.error ||
          (err.code === "ECONNABORTED" || err.message?.toLowerCase().includes("timeout")
            ? "Suggestions request timed out. Please click 'Try again'."
            : "Failed to get suggestions. Please try again.");
        setError(message);
        throw new Error(message);
      } finally {
        if (currentRequestId === suggestionsRequestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [ingredients, dietaryPreference]
  );

  const saveRecipe = useCallback(async (recipeData) => {
    try {
      const { data } = await axios.post(`${API_BASE}/save`, recipeData);
      setSavedRecipes((prev) => [data, ...prev]);
      return data;
    } catch (err) {
      const message = err.response?.data?.error || "Failed to save recipe";
      setError(message);
      throw new Error(message);
    }
  }, []);

  const fetchSavedRecipes = useCallback(async (filters = {}) => {
    setLoading(true);
    try {
      const params = new URLSearchParams(filters).toString();
      const { data } = await axios.get(`${API_BASE}/saved?${params}`);
      setSavedRecipes(data);
      return data;
    } catch (err) {
      const message = err.response?.data?.error || "Failed to fetch recipes";
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteSavedRecipe = useCallback(async (id) => {
    try {
      await axios.delete(`${API_BASE}/saved/${id}`);
      setSavedRecipes((prev) => prev.filter((r) => r._id !== id));
    } catch (err) {
      const message = err.response?.data?.error || "Failed to delete recipe";
      setError(message);
      throw new Error(message);
    }
  }, []);

  const clearRecipe = useCallback(() => {
    if (generateAbortRef.current) {
      generateAbortRef.current.abort();
    }
    setRecipe(null);
    setRecipeLoading(false);
    setRecipeError(null);
    setSuggestions([]);
    setError(null);
  }, []);

  const value = {
    ingredients, setIngredients,
    recipe, setRecipe,
    recipeLoading,
    recipeError, setRecipeError,
    retryGenerateRecipe,
    suggestions,
    savedRecipes,
    loading,
    error, setError,
    notice,
    showNotice: (msg, timeout = 3000) => {
      setNotice(msg);
      if (timeout > 0) {
        setTimeout(() => setNotice(null), timeout);
      }
    },
    dietaryPreference, setDietaryPreference,
    analyzeImage,
    parseTextIngredients,
    generateRecipe,
    getRecipeSuggestions,
    saveRecipe,
    fetchSavedRecipes,
    deleteSavedRecipe,
    clearRecipe,
  };

  return (
    <RecipeContext.Provider value={value}>
      {children}
      {notice && (
        <div className="center-notice" role="status">
          {notice}
        </div>
      )}
    </RecipeContext.Provider>
  );
};