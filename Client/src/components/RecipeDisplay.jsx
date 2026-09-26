import RecipeCard from "./RecipeCard";
import { validateAndNormalizeRecipe } from "../utils/recipeValidator";

function RecipeDisplay({ recipe, onRetry }) {
  if (!recipe) return null;

  const validation = validateAndNormalizeRecipe(recipe);
  const normalizedRecipe = validation.recipe || recipe;

  if (!validation.isValid) {
    return (
      <div className="recipe-display-fallback">
        <div className="state-icon error-icon">⚠️</div>
        <h3>Incomplete Recipe Details</h3>
        <p>{validation.error || "The recipe format was invalid or incomplete."}</p>
        {onRetry && (
          <button className="primary-btn retry-btn" onClick={onRetry}>
            🔄 Try Again
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="recipe-display">
      <RecipeCard recipe={normalizedRecipe} />

      <div className="recipe-section">
        <h3>Ingredients</h3>
        {normalizedRecipe.ingredients && normalizedRecipe.ingredients.length > 0 ? (
          <ul className="ingredients-list">
            {normalizedRecipe.ingredients.map((ing, i) => (
              <li key={i} className="ingredient-row">
                <div>
                  <span className="ing-name">{ing.name || "Ingredient"}</span>
                  {ing.quantity && <span className="ing-quantity"> — required: {ing.quantity}</span>}
                </div>
                <div>
                  {ing.used ? (
                    <span className="used-quantity">used: {ing.usedQuantity || ing.quantity}</span>
                  ) : (
                    <span className="not-available">not available</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="fallback-note">No specific ingredient list available.</p>
        )}
      </div>

      <div className="recipe-section">
        <h3>Step-by-Step Instructions</h3>
        {normalizedRecipe.instructions && normalizedRecipe.instructions.length > 0 ? (
          <ol className="instructions-list">
            {normalizedRecipe.instructions.map((inst, i) => (
              <li key={i} className="instruction-step">
                <span className="step-number">Step {inst.step || i + 1}</span>
                <p>{inst.description || "Follow cooking procedure."}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="fallback-note">No instructions available for this recipe.</p>
        )}
      </div>

      {normalizedRecipe.nutrition && (
        <div className="recipe-section">
          <h3>Nutritional Information</h3>
          <div className="nutrition-grid">
            {["calories", "protein", "carbs", "fat", "fiber"].map((key) => (
              <div key={key} className="nutrition-item">
                <span className="nutrition-label">
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </span>
                <span className="nutrition-value">
                  {normalizedRecipe.nutrition[key] || "N/A"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {normalizedRecipe.servingSuggestions && normalizedRecipe.servingSuggestions.length > 0 && (
        <div className="recipe-section">
          <h3>Serving Suggestions</h3>
          <ul className="suggestions-list">
            {normalizedRecipe.servingSuggestions.map((suggestion, i) => (
              <li key={i}>{suggestion}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default RecipeDisplay;