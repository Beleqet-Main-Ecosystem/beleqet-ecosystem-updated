# AI Salary Helper

Welcome to the **AI Salary Helper** repository. This project is structured as a monorepo, containing both the backend estimation service and the responsive frontend interface.

---

## 📂 Repository Structure

*   **`/backend`**: NestJS application utilizing the Google GenAI SDK and Gemini structured schemas to compute global market salary standards.
*   **`/frontend`**: Next.js (React) single-page application featuring a self-contained, light/dark theme switch using local state persistence.

---

## ⚡ Quick Start (Local Development)

To run both services side-by-side locally:

### 1. Spin up the Backend
```bash
cd backend
npm install
npm run start:dev