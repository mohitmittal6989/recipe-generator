import { useNavigate } from "react-router-dom";
import { useRecipe } from "../context/RecipeContext";
import RecipeDisplay from "../components/RecipeDisplay";
import { validateAndNormalizeRecipe } from "../utils/recipeValidator";

function RecipeResult() {
  const navigate = useNavigate();
  const {
    recipe,
    recipeLoading,
    recipeError,
    retryGenerateRecipe,
    clearRecipe,
    loading,
    error,
  } = useRecipe();

  const handleBack = () => {
    clearRecipe();
    navigate("/");
  };

  const handleRetry = async () => {
    try {
      await retryGenerateRecipe();
    } catch {
      // Error is caught and stored in RecipeContext
    }
  };

  const isGenerating = recipeLoading || (loading && !recipe);
  const currentError = recipeError || (!recipe ? error : null);

  // ── 1. LOADING STATE ──────────────────────────────────────────
  if (isGenerating) {
    return (
      <div className="recipe-result-page">
        <div className="recipe-state-card recipe-loading-card">
          <div className="state-animation">
            <span className="chef-icon" role="img" aria-label="Chef">👨‍🍳</span>
            <div className="spinner large-spinner"></div>
          </div>
          <h2>Cooking Up Your Recipe...</h2>
          <p className="state-description">
            Our AI is analyzing your ingredients, balancing nutrition, and writing detailed cooking instructions.
          </p>
          <div className="loading-steps-pills">
            <span className="step-pill">1. Checking Ingredients</span>
            <span className="step-pill">2. Chef Planning</span>
            <span className="step-pill">3. Writing Recipe</span>
          </div>
          <button className="secondary-btn cancel-btn" onClick={handleBack}>
            Cancel &amp; Edit Ingredients
          </button>
        </div>
      </div>
    );
  }

  // ── 2. ERROR STATE ────────────────────────────────────────────
  if (currentError) {
    return (
      <div className="recipe-result-page">
        <button className="back-btn" onClick={handleBack}>&larr; Back to Ingredients</button>

        <div className="recipe-state-card recipe-error-card" role="alert">
          <div className="state-icon error-icon">⚠️</div>
          <h2>Couldn't Generate Recipe</h2>
          <p className="state-description">
            {currentError}
          </p>

          <div className="state-actions">
            <button
              className="primary-btn retry-btn"
              onClick={handleRetry}
              disabled={isGenerating}
            >
              🔄 Try Again
            </button>
            <button className="secondary-btn" onClick={handleBack}>
              Edit Ingredients
            </button>
          </div>

          <p className="state-hint">
            Tip: If the AI output was incomplete or timed out, clicking <strong>Try Again</strong> sends a fresh request to create your recipe.
          </p>
        </div>
      </div>
    );
  }

  // ── 3. EMPTY STATE ────────────────────────────────────────────
  if (!recipe) {
    return (
      <div className="recipe-result-page">
        <div className="recipe-state-card recipe-empty-card">
          <div className="state-icon empty-icon">🍲</div>
          <h2>No Recipe Generated Yet</h2>
          <p className="state-description">
            You haven't generated a recipe yet. Add some ingredients from your fridge or pantry, and let AI create a delicious meal!
          </p>
          <button className="primary-btn" onClick={() => navigate("/")}>
            Add Ingredients
          </button>
        </div>
      </div>
    );
  }

  // ── 4. SHAPE VALIDATION STATE ─────────────────────────────────
  const validation = validateAndNormalizeRecipe(recipe);

  if (!validation.isValid) {
    return (
      <div className="recipe-result-page">
        <button className="back-btn" onClick={handleBack}>&larr; Back to Ingredients</button>

        <div className="recipe-state-card recipe-error-card" role="alert">
          <div className="state-icon error-icon">⚠️</div>
          <h2>Incomplete Recipe Data</h2>
          <p className="state-description">
            {validation.error || "The AI response was missing expected recipe details (title, ingredients, or instructions)."}
          </p>

          <div className="state-actions">
            <button className="primary-btn retry-btn" onClick={handleRetry}>
              🔄 Try Again
            </button>
            <button className="secondary-btn" onClick={handleBack}>
              Edit Ingredients
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 5. SUCCESS STATE ──────────────────────────────────────────
  return (
    <div className="recipe-result-page">
      <div className="recipe-result-header">
        <button className="back-btn" onClick={handleBack}>&larr; Back to Ingredients</button>
        <button
          className="secondary-btn regenerate-btn"
          onClick={handleRetry}
          disabled={isGenerating}
          title="Regenerate a new recipe variation with the same ingredients"
        >
          🔄 Regenerate Recipe
        </button>
      </div>

      <h2>Your AI-Generated Recipe</h2>
      <RecipeDisplay recipe={validation.recipe} onRetry={handleRetry} />
    </div>
  );
}

export default RecipeResult;