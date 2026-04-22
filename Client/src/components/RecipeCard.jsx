import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useRecipe } from "../context/RecipeContext";

function RecipeCard({ recipe, isSaved = false }) {
  const navigate = useNavigate();
  const { saveRecipe, deleteSavedRecipe, showNotice } = useRecipe();

  const handleSave = async () => {
    try {
      await saveRecipe(recipe);
      showNotice("Recipe saved successfully!", 3000);
    } catch {
      showNotice("Failed to save recipe", 3000);
    }
  };

  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleDelete = async () => {
    // open confirmation modal
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    setConfirmOpen(false);
    try {
      await deleteSavedRecipe(recipe._id);
      showNotice("Recipe deleted", 3000);
    } catch {
      showNotice("Failed to delete recipe", 3000);
    }
  };

  const cancelDelete = () => setConfirmOpen(false);

  const handleView = () => {
    if (isSaved) navigate(`/saved/${recipe._id}`);
  };

  return (
    <div className="recipe-card" onClick={handleView}>
      <div className="recipe-card-header">
        <h3>{recipe.title}</h3>
        {recipe.difficulty && (
          <span className={`difficulty-badge${recipe.difficulty.toLowerCase()}`}>
            {recipe.difficulty}
          </span>
        )}
      </div>

      <div className="recipe-card-meta">
        {recipe.prepTime &&<span>Prep: {recipe.prepTime}</span>}
        {recipe.cookTime &&<span>Cook: {recipe.cookTime}</span>}
        {recipe.servings &&<span>Servings: {recipe.servings}</span>}
      </div>

      {recipe.dietaryTags && recipe.dietaryTags.length > 0 && (
        <div className="recipe-tags">
          {recipe.dietaryTags.map((tag, i) => (
            <span key={i} className="diet-tag">{tag}</span>
          ))}
        </div>
      )}

      <div className="recipe-card-actions">
        {isSaved ? (
          <button
            className="delete-btn"
            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
          >
            Delete
          </button>
        ) : (
          <button className="save-btn" onClick={handleSave}>
            Save Recipe
          </button>
        )}
      </div>

      {confirmOpen && createPortal(
        <div className="confirm-overlay" onClick={(e) => { e.stopPropagation(); cancelDelete(); }}>
          <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
            <h4>Delete Recipe</h4>
            <p>Are you sure you want to delete "{recipe.title}"?</p>
            <div className="confirm-actions">
              <button className="secondary-btn" onClick={cancelDelete}>Cancel</button>
              <button className="delete-btn" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default RecipeCard;