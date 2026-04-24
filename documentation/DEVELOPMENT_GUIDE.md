# Development & Setup Guide

Follow this guide to set up the SMTS development environment and understand the available tools.

## ⚙️ Prerequisites

*   **Node.js**: v18 or later.
*   **PostgreSQL**: v14 or later.
*   **Ollama**: Installed and running locally (for AI features).
    *   `ollama run gemma4:e4b` (or your preferred model).

## 🚀 Getting Started

1.  **Clone & Install**:
    ```bash
    git clone <repo-url>
    cd smart-traffic-management-system
    npm install
    ```

2.  **Environment Setup**:
    Copy `.env.example` to `.env` and fill in the required values:
    *   `DATABASE_URL`: Your Postgres connection string.
    *   `NEXTAUTH_SECRET`: A secure random string for JWT.
    *   `OLLAMA_BASE_URL`: Usually `http://localhost:11434`.

3.  **Database Migration**:
    ```bash
    npx prisma migrate dev --name init
    ```

4.  **Seed the City**:
    Populate the database with the initial Meridian City layout, roads, and signals:
    ```bash
    node scripts/seed-meridian-city.mjs
    ```

5.  **Run Development Server**:
    ```bash
    npm run dev
    ```
    Visit `http://localhost:3000`.

## 🧪 Testing

The project uses **Vitest** for unit and integration testing.

*   **Run All Tests**: `npm test`
*   **Watch Mode**: `npm run test:watch`

Tests are located in `src/test/` and alongside components.

## 🛠 Useful Scripts

| Script | Command | Description |
| :--- | :--- | :--- |
| **Dev Server** | `npm run dev` | Starts the Next.js dev server with HMR. |
| **Prisma Studio**| `npx prisma studio` | Visual database explorer. |
| **Seed City** | `node scripts/seed-meridian-city.mjs` | Resets and seeds the entire city infrastructure. |
| **Lint** | `npm run lint` | Runs ESLint for code quality checks. |

## 📦 Deployment

The project is designed to be deployed on **Vercel** or any Node.js compatible environment. Ensure that:
1.  The `DATABASE_URL` is accessible from the production environment.
2.  An **Ollama** endpoint is reachable (either via a local server or a hosted instance).
3.  All environment variables from `.env.example` are configured in the deployment platform.
