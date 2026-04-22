# 🍳 AI-Powered Recipe Generator

Turn **random fridge ingredients into structured, personalized recipes — instantly.**

---

## 🚀 Overview

AI Recipe Generator is a full-stack MERN application that transforms a simple **food image into a complete recipe** with ingredients, steps, and nutrition details.

Instead of searching for recipes, this app **creates recipes for you** — based on what you already have.

---

## ❗ Problem

Modern home cooking is inefficient:

* People don’t know what to cook
* Ingredients go to waste
* Recipe platforms require predefined dish ideas
* Dietary needs are hard to meet
* Typing ingredients manually is inconvenient
* No personalized nutrition insights

---

## 💡 Solution

This application flips the entire cooking workflow:

> 📸 **Upload image → 🧠 AI detects ingredients → 🍲 Generates recipe → 💾 Save for later**

---

## ✨ Key Features

### 📷 Image-Based Ingredient Detection

* Upload a food/fridge image
* AI detects ingredients automatically

### ✍️ Editable Ingredient List

* Remove incorrect items
* Add missing ingredients manually

### 🥗 Dietary Filtering

Supports:

* Vegan
* Vegetarian
* Keto
* Gluten-Free
* Dairy-Free
* Low-Carb
* High-Protein
* Paleo

---

### 🍲 AI Recipe Generation

Generates fully structured recipes including:

* Title
* Ingredients with quantities
* Step-by-step instructions
* Prep & cook time
* Difficulty level
* Servings
* Nutrition (calories, protein, carbs, fat, fiber)

---

### 🎯 Smart Suggestions Mode

* Get **3 quick recipe ideas first**
* Choose one before generating full recipe
* Saves time & API usage

---

### 💾 Save & Manage Recipes

* Store recipes in MongoDB
* Search by title
* Filter by diet & difficulty
* Delete anytime

---

## 🔄 Application Flow

```
Upload Image
     ↓
AI detects ingredients
     ↓
User edits ingredients
     ↓
Select dietary preference (optional)
     ↓
Choose:
   → Generate Full Recipe
   → OR Get Suggestions
            ↓
     Select one suggestion
            ↓
     Generate Full Recipe
            ↓
Save to Database
```

---

## 🧠 AI Architecture

| Feature              | Model Used             |
| -------------------- | ---------------------- |
| Ingredient Detection | LLaMA 4 Scout (Vision) |
| Recipe Generation    | LLaMA 3.3 70B (Text)   |

---

## 🛠 Tech Stack

### Backend

* Node.js
* Express.js
* MongoDB + Mongoose
* Groq SDK
* Multer
* dotenv
* CORS

### Frontend

* React 18
* Vite
* React Router v6
* Axios
* Context API
* Custom CSS

---

## 🌟 Advantages

* 📸 No typing required — image-first UX
* ♻️ Reduces food wastage
* 🧠 Structured AI output (JSON-based)
* 🥗 Built-in dietary intelligence
* ⚡ Fast client-side filtering
* 💾 Persistent recipe storage
* 💸 Completely free AI usage (Groq free tier)

---

## ⚡ Innovation Angle

This isn’t just a recipe app — it’s a **decision engine for everyday life**.

Instead of asking:

> “What should I cook?”

It answers:

> “Here’s exactly what you can cook — right now — with what you already have.”

---

## 🚧 Future Enhancements

* Voice input ("What can I cook?")
* Barcode scanning for ingredients
* Weekly meal planning
* Grocery list auto-generation
* Multi-user authentication
* Mobile app version

---

## 📌 Conclusion

This project reimagines cooking as an **AI-assisted experience**, eliminating friction between **ingredients → decision → action**.

---

## 👨‍💻 Author

**Mohit Mittal**
