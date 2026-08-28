import { useState } from "react";
import "./App.css";

function App() {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!query.trim()) {
      setError("Please enter a search query.");
      return;
    }

    setLoading(true);
    setError("");
    setAnswer("");

    try {
      const response = await fetch("http://localhost:5000/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: query,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Search failed");
      }

      setAnswer(data.answer);
    } catch (err) {
      setError(
        err.message || "Unable to connect to the AURA backend."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="logo">AURA</div>

        <div className="tagline">
          Autonomous Research & Answer Engine
        </div>
      </header>

      <main className="main">
        <section className="hero">
          <h1>What do you want to research?</h1>

          <p className="subtitle">
            Search, understand, and discover information with AI.
          </p>

          <div className="search-container">
            <input
              type="text"
              placeholder="Ask anything..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
            />

            <button
              onClick={handleSearch}
              disabled={loading}
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </div>

          <div className="search-modes">
            <button className="mode active">
              Quick Search
            </button>

            <button className="mode">
              Deep Research
            </button>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {answer && (
            <div className="answer-container">
              <h2>AI Answer</h2>

              <p>{answer}</p>
            </div>
          )}
        </section>

        <section className="features">
          <div className="feature-card">
            <h3>AI Answers</h3>

            <p>
              Get clear answers generated from relevant information.
            </p>
          </div>

          <div className="feature-card">
            <h3>Trusted Sources</h3>

            <p>
              Explore the sources behind every AI-generated answer.
            </p>
          </div>

          <div className="feature-card">
            <h3>Deep Research</h3>

            <p>
              Let AI agents investigate complex topics across
              multiple sources.
            </p>
          </div>
        </section>
      </main>

      <footer>
        <p>AURA • AI-Powered Search & Research</p>
      </footer>
    </div>
  );
}

export default App;