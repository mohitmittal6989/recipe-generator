import { useState } from "react";
import { useRecipe } from "../context/RecipeContext";

function IngredientList() {
  const { ingredients, setIngredients } = useRecipe();
  const [newIngredient, setNewIngredient] = useState("");
  const [newAmount, setNewAmount] = useState("");

  const addIngredient = () => {
    const trimmed = newIngredient.trim();
    if (!trimmed) return;
    if (!ingredients.some((i) => i.name.toLowerCase() === trimmed.toLowerCase())) {
      setIngredients((prev) => [...prev, { name: trimmed, amount: newAmount || null }]);
    }
    setNewIngredient("");
    setNewAmount("");
  };

  const removeIngredient = (index) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const updateAmount = (index, value) => {
    setIngredients((prev) => prev.map((it, i) => (i === index ? { ...it, amount: value } : it)));
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); addIngredient(); }
  };
  return (
    <div className="ingredient-list">
      <h3>{ingredients.length > 0 ? "Detected Ingredients" : "Ingredients"}</h3>

      {ingredients.length > 0 && (
        <div className="ingredient-tags">
          {ingredients.map((ingredient, index) => (
            <div key={index} className="ingredient-item-row ingredient-row">
              <div className="ingredient-tag">
                {ingredient.name}
                <button className="remove-btn" onClick={() => removeIngredient(index)}>
                  &times;
                </button>
              </div>
              <input
                className="ingredient-amount-input"
                placeholder="amount (e.g. 200g, 2 cups)"
                value={ingredient.amount || ""}
                onChange={(e) => updateAmount(index, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}

      <div className="add-ingredient">
        <input
          type="text"
          value={newIngredient}
          onChange={(e) => setNewIngredient(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add ingredient..."
          className="ingredient-input"
        />
        <input
          type="text"
          value={newAmount}
          onChange={(e) => setNewAmount(e.target.value)}
          placeholder="amount (optional)"
          onKeyDown={handleKeyDown}
          className="ingredient-amount-input"
        />
        <button onClick={addIngredient} className="add-btn">Add</button>
      </div>
    </div>
  );
}

export default IngredientList;