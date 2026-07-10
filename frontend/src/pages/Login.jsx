import { useState } from "react";
import "./Login.css";

// Mock login screen — no real authentication wired up yet.
// Any email/password combination will log you in.
export default function Login({ onLogin }) {

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!email || !password) {
            setError("Please fill in both fields.");
            return;
        }

        setError("");
        onLogin();
    };

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-badge">CR</div>

                <h1>Welcome back</h1>
                <p className="login-subtitle">Log in to manage your client requests.</p>

                <form className="login-form" onSubmit={handleSubmit}>
                    <label>
                        Email
                        <input
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </label>

                    <label>
                        Password
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </label>

                    {error && <p className="login-error">{error}</p>}

                    <button type="submit" className="btn-primary login-btn">
                        Log In
                    </button>
                </form>

                <p className="login-footnote">
                    This is a mock login — any email and password will work.
                </p>
            </div>
        </div>
    );
}