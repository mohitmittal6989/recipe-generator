import { createContext, useState, useContext, useCallback } from "react";
import axios from "axios";

const RecipeContext = createContext();

export const useRecipe = () => {
  const context = useContext(RecipeContext);
  if (!context) {
    throw new Error("useRecipe must be used within a RecipeProvider");
  }
  return context;
};

export const RecipeProvider = ({ children }) => {
  const [ingredients,       setIngredients]       = useState([]); // now array of { name, amount }
  const [recipe,            setRecipe]            = useState(null);
  const [suggestions,       setSuggestions]       = useState([]);
  const [savedRecipes,      setSavedRecipes]      = useState([]);
  const [loading,           setLoading]           = useState(false);
  const [error,             setError]             = useState(null);
  const [notice,            setNotice]            = useState(null);
  const [dietaryPreference, setDietaryPreference] = useState("");

  const API_BASE = "/api/recipes";

  const analyzeImage = useCallback(async (imageFile) => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("image", imageFile);

      const { data } = await axios.post(`${API_BASE}/analyze`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // normalize to objects with optional amount
      const normalized = data.ingredients.map((ing) => ({ name: ing, amount: null }));
      setIngredients(normalized);
      return normalized;
    } catch (err) {
      const message = err.response?.data?.error || "Failed to analyze image";
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const generateRecipe = useCallback(
    async (ingredientList, diet) => {
      setLoading(true);
      setError(null);
      try {
        const available = (ingredientList && Array.isArray(ingredientList) && ingredientList.length>0 && typeof ingredientList[0] === 'object')
          ? ingredientList
          : ingredients;

        const names = (ingredientList && ingredientList.length>0)
          ? ingredientList.map((i) => (typeof i === 'string' ? i : i.name))
          : ingredients.map((i) => i.name);

        const { data } = await axios.post(`${API_BASE}/generate`, {
          ingredients: names,
          availableIngredients: available,
          dietaryPreference: diet || dietaryPreference,
        });

        setRecipe(data.recipe);
        return data.recipe;
      } catch (err) {
        const message = err.response?.data?.error || "Failed to generate recipe";
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [ingredients, dietaryPreference]
  );

  const getRecipeSuggestions = useCallback(
    async (ingredientList, opts = {}) => {
      setLoading(true);
      setError(null);
      try {
        // opts may include: dietaryPreference, minProtein, maxCookTime, difficulty, cuisine
        const available = ingredientList && ingredientList.length > 0 && typeof ingredientList[0] === 'object'
          ? ingredientList
          : ingredients;

        const names = ingredientList && ingredientList.length > 0
          ? ingredientList.map((i) => (typeof i === 'string' ? i : i.name))
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

        const { data } = await axios.post(`${API_BASE}/suggestions`, body);

        setSuggestions(data.suggestions);
        return data.suggestions;
      } catch (err) {
        const message = err.response?.data?.error || "Failed to get suggestions";
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
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
    setRecipe(null);
    setSuggestions([]);
    setError(null);
  }, []);

  const value = {
    ingredients, setIngredients,
    recipe, setRecipe,
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