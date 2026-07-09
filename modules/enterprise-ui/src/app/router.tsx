import { createBrowserRouter, Navigate } from "react-router-dom";
import { App } from "./App";
import { RecipePage } from "@/pages/recipe";
import { DashboardPage } from "@/pages/dashboard";
import { JobInputPage } from "@/pages/job-input";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: App,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "recipes", Component: RecipePage },
      { path: "dashboard", Component: DashboardPage },
      { path: "job-input", Component: JobInputPage },
    ],
  },
]);
