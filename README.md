# 🍳 AI Recipe Generator

Turn the ingredients you have — typed or photographed — into a complete, structured recipe using AI.

Built for the Frontend Internship take-home assignment (Fridge-to-Recipe option).

**Live demo:** https://recipe-generator-e2vy.vercel.app/

---

## What it does

- Type your ingredients directly (comma-separated or one per line), or upload a photo of your fridge/ingredients and let AI detect them
- Edit the detected/typed ingredient list before generating
- Optionally filter by diet (Vegan, Vegetarian, Keto, Gluten-Free, Dairy-Free, Low-Carb, High-Protein, Paleo)
- AI returns a fully structured recipe: title, ingredients with quantities, step-by-step instructions, prep/cook time, difficulty, servings, and nutrition info
- Save, search, and filter generated recipes (stored in MongoDB)

---

## Tech stack

**Frontend:** React 18 + Vite, React Router, Axios, Context API, custom CSS

**Backend:** Node.js + Express, MongoDB + Mongoose, Google Gemini API (ingredient detection + recipe generation), Multer, dotenv, CORS

The API key is never exposed to the browser — all model calls go through the Express backend.

---

## Setup

### Prerequisites
- Node.js (v18+)
- A MongoDB connection string (local or Atlas)
- A Gemini API key ([Google AI Studio](https://aistudio.google.com/))

### 1. Clone and install
```bash
git clone https://github.com/mohitmittal6989/recipe-generator.git
cd recipe-generator

# Install server dependencies
cd Server
npm install

# Install client dependencies
cd ../Client
npm install
```

### 2. Environment variables
Create a `.env` file inside `Server/`:
```
GEMINI_API_KEY=your_gemini_api_key_here
MONGO_URI=your_mongodb_connection_string
PORT=5000
```

> Note: fill in any additional variables your setup uses (e.g. a client-side `VITE_API_BASE_URL` if the frontend needs to know the backend URL).

### 3. Run locally
```bash
# From Server/
npm start

# From Client/ (in a separate terminal)
npm run dev
```
The app will be available at the local Vite URL (typically `http://localhost:5173`).

---

## AI usage note

I used AI coding assistants (Claude, and Cursor/Copilot for in-editor suggestions) throughout this project:
- Scaffolding the initial React component structure and Express routes
- Implementing the text-input ingredient flow alongside the existing image-upload flow
- Adding error handling around the AI calls: try/catch around JSON parsing, a fallback client-side parser when the backend parse call fails, retry UI, and loading states with step indicators ("Checking Ingredients → Chef Planning → Writing Recipe")
- Debugging a mismatch between the API key and SDK being used (Gemini key with a Groq-named variable/client)

I reviewed, tested, and modified the generated code rather than pasting it in unchanged — I can walk through and explain any part of it.

---

## Known limitations

- Image-based ingredient detection isn't always accurate — it can miss or misidentify ingredients, so the editable list is there to correct it
- No user authentication — saved recipes aren't scoped to individual users
- Cancelling a request mid-generation ("Cancel & Edit Ingredients") returns to the input screen but doesn't guarantee the in-flight request is aborted at the network level
- No streaming — the full recipe is generated before anything is shown, aside from the progress-step loading indicator

---

## Time spent

~[X] hours total. *(Fill in your actual time — be honest, this counts in your favor.)*

---

## Author

Mohit Mittal
