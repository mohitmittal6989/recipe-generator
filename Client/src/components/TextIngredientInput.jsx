import { useState } from "react";
import { useRecipe } from "../context/RecipeContext";

function TextIngredientInput() {
  const [text, setText] = useState("");
  const { parseTextIngredients, loading, showNotice } = useRecipe();

  const handleParse = async () => {
    if (!text.trim()) {
      showNotice("Please enter some ingredients before detecting", 3000);
      return;
    }

    try {
      const parsed = await parseTextIngredients(text);
      if (parsed && parsed.length > 0) {
        showNotice(
          `Detected ${parsed.length} ingredient${parsed.length === 1 ? "" : "s"}! Edit or generate recipes below.`,
          3500
        );
      }
    } catch {
      // Error is set and displayed via context
    }
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleParse();
    }
  };

  const loadExample = (exampleType) => {
    let exampleText = "";
    if (exampleType === "pasta") {
      exampleText = "200g pasta, 2 cloves garlic, 1 can crushed tomatoes, 2 tbsp olive oil, fresh basil, salt, black pepper";
    } else if (exampleType === "breakfast") {
      exampleText = "3 eggs\n1/2 cup milk\n50g cheddar cheese\n1 tomato\n2 slices bread\n1 tbsp butter";
    } else if (exampleType === "stirfry") {
      exampleText = "chicken breast, 1 bell pepper, 1 onion, 2 tbsp soy sauce, 1 tbsp olive oil, garlic, ginger";
    }
    setText(exampleText);
  };

  return (
    <div className="text-ingredient-input">
      <h2>Type Ingredients</h2>
      <p className="uploader-subtitle">
        Type or paste ingredients directly — comma-separated or one per line
      </p>

      <div className="text-input-card">
        <textarea
          className="ingredients-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={"e.g. 2 eggs, 1 cup milk, 200g flour\n\nor enter one per line:\ntomato\nonion\ngarlic\nolive oil"}
          rows={5}
          disabled={loading}
          aria-label="Ingredients free-form text input"
        />

        <div className="textarea-footer">
          <div className="quick-examples">
            <span className="quick-label">Try example:</span>
            <button
              type="button"
              className="example-chip"
              onClick={() => loadExample("pasta")}
              disabled={loading}
            >
              🍝 Pasta Night
            </button>
            <button
              type="button"
              className="example-chip"
              onClick={() => loadExample("breakfast")}
              disabled={loading}
            >
              🍳 Breakfast
            </button>
            <button
              type="button"
              className="example-chip"
              onClick={() => loadExample("stirfry")}
              disabled={loading}
            >
              🥘 Stir-Fry
            </button>
          </div>

          <div className="textarea-actions">
            {text.trim().length > 0 && (
              <button
                type="button"
                className="clear-btn"
                onClick={() => setText("")}
                disabled={loading}
              >
                Clear
              </button>
            )}
            <button
              type="button"
              className="primary-btn parse-btn"
              onClick={handleParse}
              disabled={loading || !text.trim()}
            >
              {loading ? (
                <>
                  <span className="mini-spinner"></span> Detecting...
                </>
              ) : (
                <>
                  <span>🔍 Detect Ingredients</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="textarea-hint">
          <span>Tip: Press <strong>Ctrl + Enter</strong> to quickly detect ingredients</span>
        </div>
      </div>

      {loading && (
        <div className="analyzing-indicator">
          <div className="spinner"></div>
          <p>Detecting ingredients with AI...</p>
        </div>
      )}
    </div>
  );
}

export default TextIngredientInput;
