import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useRecipe } from "../context/RecipeContext";
import ImageUploader from "../components/ImageUploader";
import IngredientList from "../components/IngredientList";
import DietaryFilter from "../components/DietaryFilter";
import SuggestionsList from "../components/SuggestionsList";
import Loader from "../components/Loader";

function Home() {
  const navigate = useNavigate();
  const {
    ingredients, loading, error, setError,
    generateRecipe, getRecipeSuggestions, suggestions,
    setRecipe, dietaryPreference,
  } = useRecipe();
  const [dishName, setDishName] = useState("");

  const [minProtein, setMinProtein] = useState(0);
  const [maxCookTime, setMaxCookTime] = useState(0);
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [cuisine, setCuisine] = useState("");

  const handleGenerateRecipe = async () => {
    try {
      await generateRecipe();
      navigate("/recipe");
    } catch { /* error is set in context */ }
  };

  const handleGetSuggestions = async () => {
    try {
      const opts = {
        dietaryPreference,
        minProtein: minProtein || undefined,
        maxCookTime: maxCookTime || undefined,
        difficulty: difficultyFilter || undefined,
        cuisine: cuisine || undefined,
      };
      const ingredientList = ingredients.length > 0 ? ingredients : (dishName ? [dishName] : []);
      await getRecipeSuggestions(ingredientList, opts);
    } catch { /* error is set in context */ }
  };

  const handleSelectSuggestion = async (title) => {
    try {
      const fullIngredients = [...ingredients, title];
      const recipe = await generateRecipe(fullIngredients, dietaryPreference);
      if (recipe) {
        setRecipe(recipe);
        navigate("/recipe");
      }
    } catch { /* error is set in context */ }
  };

  return (
    <div className="home-page">
      <section className="hero-section">
        <h1>What's in Your Fridge?</h1>
        <p>Upload a photo of your ingredients and let AI create delicious recipes for you</p>
      </section>

      <section className="upload-section">
        <ImageUploader />
      </section>

      <div className="inputs-and-filters">
        <section className="ingredients-section"><IngredientList /></section>

        <section className="dishname-section">
          <label className="dishname-label">Or enter a dish name to get suggestions</label>
          <input className="dishname-input" placeholder="e.g. chicken tikka or pasta" value={dishName} onChange={(e) => setDishName(e.target.value)} />
        </section>

        <section className="filter-section"><DietaryFilter /></section>

        <section className="advanced-filters">
          <h4>Advanced Filters</h4>
          <div className="advanced-grid">
            <label>
              Min Protein (g):
              <input type="number" min="0" value={minProtein} onChange={(e) => setMinProtein(Number(e.target.value))} />
            </label>
            <label>
              Max Cook Time (mins):
              <input type="number" min="0" value={maxCookTime} onChange={(e) => setMaxCookTime(Number(e.target.value))} />
            </label>
            <label>
              Difficulty:
              <select value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value)}>
                <option value="">Any</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </label>
            <label>
              Cuisine:
              <input className="cuisine-input" value={cuisine} onChange={(e) => setCuisine(e.target.value)} placeholder="e.g. Italian, Indian" />
            </label>
          </div>
        </section>

        <section className="action-section">
          <button className="primary-btn" onClick={handleGenerateRecipe} disabled={loading}>
            {loading ? "Generating..." : "Generate Recipe"}
          </button>
          <button className="secondary-btn" onClick={handleGetSuggestions} disabled={loading}>
            {loading ? "Loading..." : "Get Suggestions"}
          </button>
        </section>
      </div>

      {loading &&<Loader message="AI is cooking up something great..." />}

      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <SuggestionsList suggestions={suggestions} onSelect={handleSelectSuggestion} />
    </div>
  );
}

export default Home;