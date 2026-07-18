# AI Salary Helper

An elegant, fully self-contained Web Application that leverages an AI-powered NestJS backend to estimate global average salaries dynamically. The application features a clean modern user interface with an effortless, self-contained **Dark & Light Mode** switch that stores user preference without requiring complex configuration files.

---

## 🚀 Key Features

*   **Self-Contained Theme Switcher**: Toggle instantly between a deep-slate dark theme and a crisp light theme. Saved preferences are kept locally, ensuring ZERO external configuration layout boilerplate is needed.
*   **Intuitive custom dropdown selectors**: Clean native dropdown interfaces with custom scrollbars containing optimized Job Roles and Country locations.
*   **AI-Driven Calculations**: Queries a NestJS backend powered by structural schema analysis (using Gemini Models) to produce precise salary approximations.
*   **Completely Responsive**: Tailored grid styling looks spectacular on desktop, tablet, and mobile displays.

---

## 🛠️ Setup Instructions

### 1. Configure the Frontend Environment
Create a `.env.local` file in the root of your Next.js directory and set your backend API URL:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000