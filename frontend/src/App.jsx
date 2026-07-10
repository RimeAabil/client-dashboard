import { useState } from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import "./App.css";

export default function App() {

  // Mock auth state — not backed by real authentication yet
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  if (!isLoggedIn) {
    return <Login onLogin={() => setIsLoggedIn(true)} />;
  }

  return <Dashboard onLogout={() => setIsLoggedIn(false)} />;
}