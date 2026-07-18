# 💸 AI Salary Helper (Backend)

A lightweight, high-performance **NestJS** microservice that uses **Google Gemini AI** to estimate the average annual salary for a job based on its role, country, and years of experience.

## ✨ Features

* 🚀 Lightweight NestJS architecture
* 🤖 Powered by the official Google GenAI SDK
* 📊 AI-generated salary estimates
* ✅ Structured JSON responses using `responseSchema`
* 🌍 Supports salary estimation for jobs worldwide
* ⚡ Fast REST API with simple query parameters

---

# 🛠 Tech Stack

* **Framework:** NestJS (TypeScript)
* **AI SDK:** `@google/genai`
* **AI Model:** `gemini-2.5-flash`
* **Language:** TypeScript

---

# 📦 Installation

## 1. Clone the repository

```bash
git clone <repository-url>
cd <repository-name>
```

## 2. Install dependencies

```bash
npm install
```

## 3. Configure environment variables

Create a `.env` file in the project root.

```env
GEMINI_API_KEY=your_gemini_api_key
PORT=3000
```

## 4. Start the development server

```bash
npm run start:dev
```

The API will be available at:

```
http://localhost:3000
```

---

# 🔌 API

## GET `/estimate`

Returns an AI-estimated average annual salary and the corresponding local currency.

### Query Parameters

| Parameter    | Type   | Required | Description                      | Example             |
| ------------ | ------ | -------- | -------------------------------- | ------------------- |
| `job`        | string | ✅        | Job title                        | `Software Engineer` |
| `country`    | string | ✅        | Country where the job is located | `Japan`             |
| `experience` | number | ✅        | Years of experience              | `5`                 |

---

## Example Request

```http
GET /estimate?job=Software%20Engineer&country=Japan&experience=5
```

---

## Example Response

```json
{
  "salary": 8500000,
  "currency": "JPY"
}
```

---

# 📁 Project Structure

```text
src/
├── app.controller.ts
├── app.service.ts
├── gemini.service.ts
├── main.ts
└── app.module.ts
```

The project intentionally uses a flat structure to remain lightweight and easy to maintain.

---

# ⚙️ Configuration

| Variable         | Description                   |
| ---------------- | ----------------------------- |
| `GEMINI_API_KEY` | Google Gemini API key         |
| `PORT`           | Server port (default: `3000`) |

---

# 📄 License

MIT License.
