import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "./lib/supabaseClient";
import Auth from "./Auth";
import "./App.css";

const API_URL = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/search`;

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("quick");

  const [results, setResults] = useState([]);
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState([]);
  const [researchQueries, setResearchQueries] = useState([]);
  const [verification, setVerification] = useState(null);

  // =========================================================
  // PERSISTENT RESEARCH HISTORY
  // =========================================================

  const [recentSearches, setRecentSearches] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadingStep, setLoadingStep] = useState("");

  // =========================================================
  // ACCOUNT / SETTINGS UI
  // =========================================================

  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);

  // =========================================================
  // SETTINGS
  // =========================================================

  const [settingsTab, setSettingsTab] = useState("profile");
  const [settingsName, setSettingsName] = useState("");
  const [settingsEmail, setSettingsEmail] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [appearance, setAppearance] = useState(() => localStorage.getItem("aura-appearance") || "dark");
  const [emailNotifications, setEmailNotifications] = useState(() => localStorage.getItem("aura-email-notifications") !== "false");
  const [researchNotifications, setResearchNotifications] = useState(() => localStorage.getItem("aura-research-notifications") !== "false");
  const [defaultMode, setDefaultMode] = useState(() => localStorage.getItem("aura-default-mode") || "quick");
  const [showCitations, setShowCitations] = useState(() => localStorage.getItem("aura-show-citations") !== "false");

  useEffect(() => {
    if (user) {
      setSettingsName(user.user_metadata?.full_name || "");
      setSettingsEmail(user.email || "");
    }
  }, [user]);

  useEffect(() => {
    // Apply the selected theme to the entire AURA application, not just Settings.
    document.documentElement.dataset.auraTheme = appearance;
    document.documentElement.style.colorScheme = appearance;
    document.body.dataset.auraTheme = appearance;
    localStorage.setItem("aura-appearance", appearance);
  }, [appearance]);

  useEffect(() => {
    localStorage.setItem("aura-email-notifications", String(emailNotifications));
  }, [emailNotifications]);

  useEffect(() => {
    localStorage.setItem("aura-research-notifications", String(researchNotifications));
  }, [researchNotifications]);

  useEffect(() => {
    localStorage.setItem("aura-default-mode", defaultMode);
    setMode(defaultMode);
  }, [defaultMode]);

  useEffect(() => {
    localStorage.setItem("aura-show-citations", String(showCitations));
  }, [showCitations]);
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryFilter, setLibraryFilter] = useState("all");

  // =========================================================
  // SUPABASE AUTHENTICATION
  // =========================================================

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (mounted) {
        setUser(session?.user ?? null);
        setAuthLoading(false);
      }
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setAuthLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // =========================================================
  // CLOUD RESEARCH HISTORY
  // =========================================================

  useEffect(() => {
    if (!user) {
      setRecentSearches([]);
      return;
    }

    const loadResearchHistory = async () => {
      setHistoryLoading(true);

      try {
        const { data, error: historyError } = await supabase
          .from("research_sessions")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (historyError) throw historyError;

        const sessions = (data || []).map((item) => ({
          id: item.id,
          query: item.query,
          mode: item.mode,
          answer: item.answer || "",
          sources: item.sources || [],
          results: item.results || [],
          researchQueries: item.research_queries || [],
          verification: item.verification || null,
          createdAt: item.created_at,
        }));

        setRecentSearches(sessions);

        localStorage.setItem(
          `aura-recent-searches-${user.id}`,
          JSON.stringify(sessions)
        );
      } catch (historyError) {
        console.error("Unable to load cloud research history:", historyError);

        try {
          const cached = localStorage.getItem(
            `aura-recent-searches-${user.id}`
          );
          if (cached) {
            const parsed = JSON.parse(cached);
            setRecentSearches(Array.isArray(parsed) ? parsed : []);
          }
        } catch (cacheError) {
          console.warn("Unable to load cached research history:", cacheError);
        }
      } finally {
        setHistoryLoading(false);
      }
    };

    loadResearchHistory();
  }, [user]);

  // =========================================================
  // SAVE RESEARCH SESSION TO SUPABASE
  // =========================================================

  const saveResearchSession = async ({
    searchQuery,
    searchMode,
    searchAnswer,
    searchSources,
    searchResults,
    searchResearchQueries,
    searchVerification,
  }) => {
    if (!user) return null;

    const payload = {
      user_id: user.id,
      query: searchQuery,
      mode: searchMode,
      answer: searchAnswer || "",
      sources: searchSources || [],
      results: searchResults || [],
      research_queries: searchResearchQueries || [],
      verification: searchVerification || null,
    };

    try {
      const { data: savedRow, error: saveError } = await supabase
        .from("research_sessions")
        .insert(payload)
        .select()
        .single();

      if (saveError) throw saveError;

      const savedSession = {
        id: savedRow.id,
        query: savedRow.query,
        mode: savedRow.mode,
        answer: savedRow.answer || "",
        sources: savedRow.sources || [],
        results: savedRow.results || [],
        researchQueries: savedRow.research_queries || [],
        verification: savedRow.verification || null,
        createdAt: savedRow.created_at,
      };

      setRecentSearches((previous) => {
        const updated = [
          savedSession,
          ...previous.filter(
            (item) => item.query.toLowerCase() !== searchQuery.toLowerCase()
          ),
        ].slice(0, 12);

        localStorage.setItem(
          `aura-recent-searches-${user.id}`,
          JSON.stringify(updated)
        );

        return updated;
      });

      return savedSession;
    } catch (saveError) {
      console.error("Unable to save research session to Supabase:", saveError);

      const fallbackSession = {
        id: `local-${Date.now()}`,
        query: searchQuery,
        mode: searchMode,
        answer: searchAnswer || "",
        sources: searchSources || [],
        results: searchResults || [],
        researchQueries: searchResearchQueries || [],
        verification: searchVerification || null,
        createdAt: new Date().toISOString(),
      };

      setRecentSearches((previous) => {
        const updated = [
          fallbackSession,
          ...previous.filter(
            (item) => item.query.toLowerCase() !== searchQuery.toLowerCase()
          ),
        ].slice(0, 12);

        localStorage.setItem(
          `aura-recent-searches-${user.id}`,
          JSON.stringify(updated)
        );

        return updated;
      });

      setError("Research completed, but cloud history could not be saved.");
      return fallbackSession;
    }
  };

  // =========================================================
  // ACCOUNT / SETTINGS ACTIONS
  // =========================================================

  const handleSignOut = async () => {
    setAccountMenuOpen(false);
    setSettingsOpen(false);

    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      console.error("AURA sign out error:", signOutError);
      setError(signOutError.message || "Unable to sign out.");
    }
  };

  const openSettings = (tab = "profile") => {
    setAccountMenuOpen(false);
    setSettingsTab(tab);
    setSettingsMessage("");
    setSettingsError("");
    setSettingsOpen(true);
  };

  const saveProfile = async () => {
    setSettingsSaving(true);
    setSettingsMessage("");
    setSettingsError("");
    try {
      const { data, error: updateError } = await supabase.auth.updateUser({
        data: { full_name: settingsName.trim() },
      });
      if (updateError) throw updateError;
      setUser(data.user);
      setSettingsMessage("Profile updated successfully.");
    } catch (err) {
      setSettingsError(err.message || "Unable to update profile.");
    } finally {
      setSettingsSaving(false);
    }
  };

  const changeEmail = async () => {
    const email = settingsEmail.trim();
    if (!email || email === user?.email) {
      setSettingsError("Enter a new email address first.");
      return;
    }
    setSettingsSaving(true);
    setSettingsMessage("");
    setSettingsError("");
    try {
      const { error: updateError } = await supabase.auth.updateUser({ email });
      if (updateError) throw updateError;
      setSettingsMessage("Confirmation links have been sent. Confirm the new email from your inbox.");
    } catch (err) {
      setSettingsError(err.message || "Unable to change email.");
    } finally {
      setSettingsSaving(false);
    }
  };

  const sendPasswordReset = async () => {
    setSettingsSaving(true);
    setSettingsMessage("");
    setSettingsError("");
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/`,
      });
      if (resetError) throw resetError;
      setSettingsMessage("Password reset link sent to your email.");
    } catch (err) {
      setSettingsError(err.message || "Unable to send the password reset email.");
    } finally {
      setSettingsSaving(false);
    }
  };

  const exportMyData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      account: { id: user?.id, email: user?.email, name: displayName },
      research: recentSearches,
      preferences: { appearance, emailNotifications, researchNotifications, defaultMode, showCitations },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `aura-data-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setSettingsMessage("Your AURA data has been exported.");
  };

  const deleteMyResearch = async () => {
    if (!window.confirm("Delete all saved research history? This cannot be undone.")) return;
    setSettingsSaving(true);
    setSettingsMessage("");
    setSettingsError("");
    try {
      const { error: deleteError } = await supabase.from("research_sessions").delete().eq("user_id", user.id);
      if (deleteError) throw deleteError;
      localStorage.removeItem(`aura-recent-searches-${user.id}`);
      setRecentSearches([]);
      setSettingsMessage("All saved research history has been deleted.");
    } catch (err) {
      setSettingsError(err.message || "Unable to delete research history.");
    } finally {
      setSettingsSaving(false);
    }
  };

  const openHelp = () => {
    setAccountMenuOpen(false);
    setHelpOpen(true);
  };

  const openResearchLibrary = () => {
    setAccountMenuOpen(false);
    setLibraryOpen(true);
    setLibrarySearch("");
    setLibraryFilter("all");
  };

  const closeResearchLibrary = () => {
    setLibraryOpen(false);
    setLibrarySearch("");
    setLibraryFilter("all");
  };

  const displayName =
    user?.user_metadata?.full_name?.trim() ||
    user?.email?.split("@")[0] ||
    "AURA User";

  const userInitial = displayName.charAt(0).toUpperCase();

  // =========================================================
  // SEARCH
  // =========================================================

  const handleSearch = async () => {
    if (!query.trim()) {
      setError("Please enter a research question.");
      return;
    }

    setLoading(true);
    setError("");
    setAnswer("");
    setSources([]);
    setResults([]);
    setResearchQueries([]);
    setVerification(null);

    const timers = [];

    try {
      // =====================================================
      // LOADING STATES
      // =====================================================

      if (mode === "deep") {
        setLoadingStep("Planning deep research...");

        timers.push(
          setTimeout(() => {
            setLoadingStep(
              "Investigating multiple perspectives..."
            );
          }, 1800)
        );

        timers.push(
          setTimeout(() => {
            setLoadingStep(
              "Retrieving relevant knowledge..."
            );
          }, 4000)
        );

        timers.push(
          setTimeout(() => {
            setLoadingStep(
              "Verifying research claims..."
            );
          }, 6500)
        );

        timers.push(
          setTimeout(() => {
            setLoadingStep(
              "Generating verified research report..."
            );
          }, 8500)
        );
      } else {
        setLoadingStep("Searching the web...");

        timers.push(
          setTimeout(() => {
            setLoadingStep(
              "Analyzing relevant sources..."
            );
          }, 1200)
        );

        timers.push(
          setTimeout(() => {
            setLoadingStep(
              "Building research context..."
            );
          }, 2500)
        );

        timers.push(
          setTimeout(() => {
            setLoadingStep(
              "Generating AI answer..."
            );
          }, 4000)
        );
      }

      // =====================================================
      // BACKEND REQUEST
      // =====================================================

      const response = await fetch(API_URL, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          query: query.trim(),
          mode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Search failed"
        );
      }

      // =====================================================
      // RESPONSE
      // =====================================================

      setAnswer(data.answer || "");
      setSources(data.sources || []);
      setResults(data.results || []);
      setResearchQueries(
        data.researchQueries || []
      );

      /*
       * Claim verification response.
       *
       * The primary expected property is:
       *
       * data.verification
       *
       * The additional fallbacks make the frontend
       * tolerant if the backend property was named
       * slightly differently.
       */

      const verificationData =
        data.verification ||
        data.verificationResult ||
        data.verificationReport ||
        null;

      setVerification(verificationData);

      // =====================================================
      // SAVE COMPLETE RESEARCH SESSION
      // =====================================================

      await saveResearchSession({
        searchQuery: query.trim(),
        searchMode: mode,
        searchAnswer: data.answer || "",
        searchSources: data.sources || [],
        searchResults: data.results || [],
        searchResearchQueries: data.researchQueries || [],
        searchVerification: verificationData,
      });

      setLoadingStep("");

      // =====================================================
      // SCROLL TO ANSWER
      // =====================================================

      setTimeout(() => {
        document
          .getElementById("answer-section")
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      }, 100);
    } catch (err) {
      console.error(
        "AURA search error:",
        err
      );

      setLoadingStep("");

      setError(
        err.message ||
          "Unable to connect to the AURA backend."
      );
    } finally {
      timers.forEach(clearTimeout);
      setLoading(false);
    }
  };

  // =========================================================
  // RESTORE RESEARCH SESSION
  // =========================================================

  const restoreResearchSession = (session) => {
    if (!session) return;

    setLoading(false);
    setError("");
    setLoadingStep("");
    setQuery(session.query || "");
    setMode(session.mode || "quick");
    setAnswer(session.answer || "");
    setSources(Array.isArray(session.sources) ? session.sources : []);
    setResults(Array.isArray(session.results) ? session.results : []);
    setResearchQueries(
      Array.isArray(session.researchQueries)
        ? session.researchQueries
        : []
    );
    setVerification(session.verification || null);

    setTimeout(() => {
      if (session.answer) {
        document
          .getElementById("answer-section")
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }, 50);
  };

  // =========================================================
  // DELETE RESEARCH SESSION
  // =========================================================

  const deleteRecentSearch = async (event, sessionId) => {
    event.stopPropagation();

    try {
      if (!String(sessionId).startsWith("local-")) {
        const { error: deleteError } = await supabase
          .from("research_sessions")
          .delete()
          .eq("id", sessionId)
          .eq("user_id", user.id);

        if (deleteError) throw deleteError;
      }

      setRecentSearches((previous) => {
        const updated = previous.filter((item) => item.id !== sessionId);
        localStorage.setItem(
          `aura-recent-searches-${user.id}`,
          JSON.stringify(updated)
        );
        return updated;
      });
    } catch (deleteError) {
      console.error("Unable to delete research session:", deleteError);
      setError("Unable to delete this research session.");
    }
  };

  // =========================================================
  // CLEAR RESEARCH HISTORY
  // =========================================================

  const clearRecentSearches = async () => {
    if (!user) return;

    try {
      const { error: clearError } = await supabase
        .from("research_sessions")
        .delete()
        .eq("user_id", user.id);

      if (clearError) throw clearError;

      setRecentSearches([]);
      localStorage.removeItem(`aura-recent-searches-${user.id}`);
    } catch (clearError) {
      console.error("Unable to clear research history:", clearError);
      setError("Unable to clear your cloud research history.");
    }
  };

  // =========================================================
  // NEW SEARCH
  // =========================================================

  const handleNewSearch = () => {
    setQuery("");
    setAnswer("");
    setSources([]);
    setResults([]);
    setResearchQueries([]);
    setVerification(null);
    setError("");
    setLoadingStep("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // =========================================================
  // COPY ANSWER
  // =========================================================

  const copyAnswer = async () => {
    if (!answer) return;

    try {
      await navigator.clipboard.writeText(
        answer
      );
    } catch (err) {
      console.error(
        "Copy failed:",
        err
      );
    }
  };

  // =========================================================
  // SCROLL TO SOURCE
  // =========================================================

  const scrollToSource = (number) => {
    const element =
      document.getElementById(
        `source-${number}`
      );

    if (!element) return;

    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    element.classList.remove(
      "source-highlight"
    );

    void element.offsetWidth;

    element.classList.add(
      "source-highlight"
    );
  };

  // =========================================================
  // PREPARE CITATIONS
  // =========================================================

  const prepareMarkdown = (text) => {
    if (!text) return "";

    /*
     * Convert:
     *
     * [1]
     *
     * into:
     *
     * [1](#citation-source-1)
     *
     * Existing markdown links are preserved.
     */

    return text.replace(
      /(^|[^\[])\[(\d+)\](?!\()/g,
      (_, prefix, number) =>
        `${prefix}[${number}](#citation-source-${number})`
    );
  };

  // =========================================================
  // MARKDOWN RENDERER
  // =========================================================

  const renderAnswer = (text) => {
    if (!text) return null;

    const markdown =
      prepareMarkdown(text);

    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // -------------------------------------------------
          // HEADINGS
          // -------------------------------------------------

          h1: ({ children }) => (
            <h1 className="markdown-h1">
              {children}
            </h1>
          ),

          h2: ({ children }) => (
            <h2 className="markdown-h2">
              {children}
            </h2>
          ),

          h3: ({ children }) => (
            <h3 className="markdown-h3">
              {children}
            </h3>
          ),

          h4: ({ children }) => (
            <h4 className="markdown-h4">
              {children}
            </h4>
          ),

          // -------------------------------------------------
          // PARAGRAPHS
          // -------------------------------------------------

          p: ({ children }) => (
            <p className="markdown-paragraph">
              {children}
            </p>
          ),

          // -------------------------------------------------
          // LISTS
          // -------------------------------------------------

          ul: ({ children }) => (
            <ul className="markdown-list">
              {children}
            </ul>
          ),

          ol: ({ children }) => (
            <ol className="markdown-numbered-list">
              {children}
            </ol>
          ),

          li: ({ children }) => (
            <li>{children}</li>
          ),

          // -------------------------------------------------
          // TABLE
          // -------------------------------------------------

          table: ({ children }) => (
            <div className="markdown-table-wrapper">
              <table className="markdown-table">
                {children}
              </table>
            </div>
          ),

          thead: ({ children }) => (
            <thead>{children}</thead>
          ),

          tbody: ({ children }) => (
            <tbody>{children}</tbody>
          ),

          tr: ({ children }) => (
            <tr>{children}</tr>
          ),

          th: ({ children }) => (
            <th>{children}</th>
          ),

          td: ({ children }) => (
            <td>{children}</td>
          ),

          // -------------------------------------------------
          // CODE
          // -------------------------------------------------

          pre: ({ children }) => (
            <pre className="markdown-code-block">
              {children}
            </pre>
          ),

          code: ({
            className,
            children,
          }) => (
            <code
              className={
                className ||
                "markdown-inline-code"
              }
            >
              {children}
            </code>
          ),

          // -------------------------------------------------
          // LINKS / CITATIONS
          // -------------------------------------------------

          a: ({
            href,
            children,
          }) => {
            if (
              href?.startsWith(
                "#citation-source-"
              )
            ) {
              const number = Number(
                href.replace(
                  "#citation-source-",
                  ""
                )
              );

              return (
                <button
                  type="button"
                  className="citation"
                  onClick={() =>
                    scrollToSource(
                      number
                    )
                  }
                  title={`View source ${number}`}
                >
                  {children}
                </button>
              );
            }

            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            );
          },

          // -------------------------------------------------
          // BLOCKQUOTE
          // -------------------------------------------------

          blockquote: ({
            children,
          }) => (
            <blockquote className="markdown-blockquote">
              {children}
            </blockquote>
          ),

          // -------------------------------------------------
          // HORIZONTAL RULE
          // -------------------------------------------------

          hr: () => (
            <hr className="markdown-divider" />
          ),

          // -------------------------------------------------
          // BOLD
          // -------------------------------------------------

          strong: ({ children }) => (
            <strong>{children}</strong>
          ),

          // -------------------------------------------------
          // ITALIC
          // -------------------------------------------------

          em: ({ children }) => (
            <em>{children}</em>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    );
  };

  // =========================================================
  // KEYBOARD SHORTCUT
  // =========================================================

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (
        event.key === "/" &&
        document.activeElement?.tagName !==
          "INPUT" &&
        document.activeElement?.tagName !==
          "TEXTAREA"
      ) {
        event.preventDefault();

        document
          .querySelector(
            ".search-input"
          )
          ?.focus();
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () =>
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
  }, []);

  useEffect(() => {
    document.body.classList.toggle("library-open", libraryOpen);

    return () => {
      document.body.classList.remove("library-open");
    };
  }, [libraryOpen]);

  // =========================================================
  // RESEARCH LIBRARY FILTERING
  // =========================================================

  const filteredLibrarySessions = useMemo(() => {
    const term = librarySearch.trim().toLowerCase();

    return recentSearches.filter((session) => {
      const matchesMode =
        libraryFilter === "all" || session.mode === libraryFilter;

      const matchesSearch =
        !term ||
        String(session.query || "").toLowerCase().includes(term) ||
        String(session.answer || "").toLowerCase().includes(term);

      return matchesMode && matchesSearch;
    });
  }, [recentSearches, librarySearch, libraryFilter]);

  // =========================================================
  // NORMALIZE VERIFICATION DATA
  // =========================================================

  const verificationStats =
    useMemo(
      () =>
        normalizeVerification(
          verification
        ),
      [verification]
    );

  // =========================================================
  // UI
  // =========================================================

  if (authLoading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-logo">✦</div>
        <p>Loading AURA...</p>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <div className="app">

      {libraryOpen && (
        <div
          className="library-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeResearchLibrary();
            }
          }}
        >
          <section
            className="library-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="library-title"
          >
            <div className="library-header">
              <div>
                <span className="settings-kicker">AURA WORKSPACE</span>
                <h2 id="library-title">Research library</h2>
                <p>Browse, search, and reopen your saved research sessions.</p>
              </div>

              <button
                type="button"
                className="settings-close"
                onClick={closeResearchLibrary}
                aria-label="Close research library"
              >
                ×
              </button>
            </div>

            <div className="library-toolbar">
              <label className="library-search-wrap">
                <span>⌕</span>
                <input
                  type="search"
                  value={librarySearch}
                  onChange={(event) => setLibrarySearch(event.target.value)}
                  placeholder="Search your research..."
                  aria-label="Search research library"
                />
              </label>

              <div className="library-filters" role="tablist" aria-label="Research type">
                <button
                  type="button"
                  className={libraryFilter === "all" ? "active" : ""}
                  onClick={() => setLibraryFilter("all")}
                >
                  All
                </button>
                <button
                  type="button"
                  className={libraryFilter === "quick" ? "active" : ""}
                  onClick={() => setLibraryFilter("quick")}
                >
                  Quick
                </button>
                <button
                  type="button"
                  className={libraryFilter === "deep" ? "active" : ""}
                  onClick={() => setLibraryFilter("deep")}
                >
                  Deep
                </button>
              </div>
            </div>

            <div className="library-count">
              {historyLoading
                ? "Loading your research..."
                : `${filteredLibrarySessions.length} ${filteredLibrarySessions.length === 1 ? "research session" : "research sessions"}`}
            </div>

            <div className="library-list">
              {historyLoading ? (
                <div className="library-empty">
                  <div className="library-empty-icon">✦</div>
                  <strong>Loading research</strong>
                  <span>Fetching your saved sessions from the cloud.</span>
                </div>
              ) : filteredLibrarySessions.length === 0 ? (
                <div className="library-empty">
                  <div className="library-empty-icon">⌕</div>
                  <strong>{recentSearches.length ? "No matching research" : "Your library is empty"}</strong>
                  <span>
                    {recentSearches.length
                      ? "Try a different search or filter."
                      : "Complete a Quick Search or Deep Research session and it will appear here."}
                  </span>
                </div>
              ) : (
                filteredLibrarySessions.map((session) => (
                  <article className="library-card" key={session.id}>
                    <div className="library-card-icon">{session.mode === "deep" ? "◉" : "✦"}</div>

                    <div className="library-card-body">
                      <div className="library-card-meta">
                        <span className={session.mode === "deep" ? "deep" : "quick"}>
                          {session.mode === "deep" ? "Deep Research" : "Quick Search"}
                        </span>
                        <span>•</span>
                        <span>{formatResearchDate(session.createdAt)}</span>
                      </div>

                      <h3>{session.query || "Untitled research"}</h3>

                      <p>
                        {getLibraryPreview(session.answer, session.sources?.length || 0)}
                      </p>
                    </div>

                    <div className="library-card-actions">
                      <button
                        type="button"
                        onClick={() => {
                          restoreResearchSession(session);
                          closeResearchLibrary();
                        }}
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        className="library-delete"
                        title="Delete research"
                        aria-label={`Delete ${session.query || "research"}`}
                        onClick={(event) => deleteRecentSearch(event, session.id)}
                      >
                        ×
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {settingsOpen && (
        <div className="settings-overlay" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSettingsOpen(false);
        }}>
          <section className="settings-modal settings-modal-pro" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <div className="settings-modal-header settings-pro-header">
              <div>
                <span className="settings-kicker">AURA ACCOUNT</span>
                <h2 id="settings-title">Settings</h2>
                <p>Manage your account and customize your AURA experience.</p>
              </div>
              <button className="settings-close" type="button" onClick={() => setSettingsOpen(false)} aria-label="Close settings">×</button>
            </div>

            <div className="settings-pro-layout">
              <aside className="settings-tabs">
                {[
                  ["profile", "♙", "Profile"],
                  ["appearance", "◐", "Appearance"],
                  ["notifications", "♧", "Notifications"],
                  ["ai", "✦", "AI Preferences"],
                  ["privacy", "◇", "Data & Privacy"],
                  ["integrations", "↗", "Integrations"],
                  ["help", "?", "Help & Support"],
                ].map(([id, icon, label]) => (
                  <button key={id} type="button" className={`settings-tab ${settingsTab === id ? "active" : ""}`} onClick={() => setSettingsTab(id)}>
                    <span>{icon}</span>{label}
                  </button>
                ))}
              </aside>

              <div className="settings-panel">
                {settingsMessage && <div className="settings-notice success">{settingsMessage}</div>}
                {settingsError && <div className="settings-notice error">{settingsError}</div>}

                {settingsTab === "profile" && (
                  <div className="settings-view">
                    <h3>Profile</h3><p className="settings-view-subtitle">Manage your personal information and security.</p>
                    <div className="profile-card">
                      <div className="profile-avatar">{userInitial}</div>
                      <div><strong>{displayName}</strong><span>{user?.email}</span><small>Free Plan</small></div>
                    </div>
                    <label className="settings-field"><span>Name</span><input value={settingsName} onChange={(e) => setSettingsName(e.target.value)} placeholder="Your name" /></label>
                    <label className="settings-field"><span>Email</span><input value={settingsEmail} onChange={(e) => setSettingsEmail(e.target.value)} type="email" /></label>
                    <div className="settings-row-actions"><button className="settings-primary" onClick={saveProfile} disabled={settingsSaving}>Save profile</button><button className="settings-secondary" onClick={changeEmail} disabled={settingsSaving}>Change email</button></div>
                    <div className="settings-action-card"><div><strong>Password</strong><span>Use a secure email-based reset flow to change your password.</span></div><button className="settings-secondary" onClick={sendPasswordReset} disabled={settingsSaving}>Change password</button></div>
                    <div className="settings-action-card danger-card"><div><strong>Sign out</strong><span>Sign out from your current AURA session.</span></div><button className="settings-danger" onClick={handleSignOut}>Sign out</button></div>
                  </div>
                )}

                {settingsTab === "appearance" && (
                  <div className="settings-view"><h3>Appearance</h3><p className="settings-view-subtitle">Choose how AURA looks on this device.</p>
                    <div className="choice-grid">
                      {[['dark','Dark','AURA dark workspace'],['light','Light','Bright workspace']].map(([id,label,desc]) => <button key={id} type="button" className={`choice-card ${appearance === id ? 'selected' : ''}`} onClick={() => setAppearance(id)}><strong>{label}</strong><span>{desc}</span></button>)}
                    </div>
                    <div className="settings-action-card"><div><strong>Theme</strong><span>Your choice is saved locally and restored on your next visit.</span></div><span className="settings-status">{appearance === 'dark' ? 'Dark' : 'Light'}</span></div>
                  </div>
                )}

                {settingsTab === "notifications" && (
                  <div className="settings-view"><h3>Notifications</h3><p className="settings-view-subtitle">Control optional notifications and research updates.</p>
                    <div className="toggle-card"><div><strong>Email notifications</strong><span>Allow AURA to use your email for account notifications.</span></div><button className={`toggle ${emailNotifications ? 'on' : ''}`} onClick={() => setEmailNotifications(v => !v)} aria-label="Toggle email notifications"><span /></button></div>
                    <div className="toggle-card"><div><strong>Research completion</strong><span>Keep research completion preferences enabled on this device.</span></div><button className={`toggle ${researchNotifications ? 'on' : ''}`} onClick={() => setResearchNotifications(v => !v)} aria-label="Toggle research notifications"><span /></button></div>
                    <p className="settings-note">These switches currently control AURA's local notification preferences. Browser push notifications require a separate notification service.</p>
                  </div>
                )}

                {settingsTab === "ai" && (
                  <div className="settings-view"><h3>AI Preferences</h3><p className="settings-view-subtitle">Set defaults for future research sessions.</p>
                    <div className="settings-select-card"><div><strong>Default research mode</strong><span>Choose which mode opens for a new search.</span></div><select value={defaultMode} onChange={(e) => setDefaultMode(e.target.value)}><option value="quick">Quick Search</option><option value="deep">Deep Research</option></select></div>
                    <div className="toggle-card"><div><strong>Show source citations</strong><span>Keep clickable source references visible in research answers.</span></div><button className={`toggle ${showCitations ? 'on' : ''}`} onClick={() => setShowCitations(v => !v)} aria-label="Toggle source citations"><span /></button></div>
                  </div>
                )}

                {settingsTab === "privacy" && (
                  <div className="settings-view"><h3>Data &amp; Privacy</h3><p className="settings-view-subtitle">Control the research data stored in your AURA workspace.</p>
                    <div className="settings-action-card"><div><strong>Export my data</strong><span>Download your account, research history, and preferences as JSON.</span></div><button className="settings-secondary" onClick={exportMyData}>Export</button></div>
                    <div className="settings-action-card danger-card"><div><strong>Delete research history</strong><span>Permanently remove all saved research sessions from your account.</span></div><button className="settings-danger" onClick={deleteMyResearch} disabled={settingsSaving}>Delete history</button></div>
                    <div className="settings-action-card"><div><strong>Local preferences</strong><span>Reset appearance and AURA preference data saved in this browser.</span></div><button className="settings-secondary" onClick={() => { localStorage.removeItem('aura-appearance'); localStorage.removeItem('aura-email-notifications'); localStorage.removeItem('aura-research-notifications'); localStorage.removeItem('aura-default-mode'); localStorage.removeItem('aura-show-citations'); setAppearance('dark'); setEmailNotifications(true); setResearchNotifications(true); setDefaultMode('quick'); setShowCitations(true); setSettingsMessage('Local preferences reset.'); }}>Reset</button></div>
                  </div>
                )}

                {settingsTab === "integrations" && (
                  <div className="settings-view"><h3>Integrations</h3><p className="settings-view-subtitle">Connections used by your AURA research workspace.</p>
                    <div className="integration-card"><span className="integration-icon">⌁</span><div><strong>Supabase</strong><span>Authentication and cloud research history</span></div><b>Connected</b></div>
                    <div className="integration-card"><span className="integration-icon">✦</span><div><strong>AURA Research API</strong><span>Quick Search, Deep Research, RAG and verification</span></div><b>Connected</b></div>
                    <p className="settings-note">API credentials stay in your environment/backend. Never place secret keys in the React frontend.</p>
                  </div>
                )}

                {settingsTab === "help" && (
                  <div className="settings-view"><h3>Help &amp; Support</h3><p className="settings-view-subtitle">Quick guidance for your AURA workspace.</p>
                    <div className="help-mini-card"><strong>Research library</strong><span>Open Research library from the sidebar to search, filter, reopen, and delete saved sessions.</span></div>
                    <div className="help-mini-card"><strong>Password reset</strong><span>Use Change password in Profile. AURA sends a secure Supabase recovery email and opens the password reset flow.</span></div>
                    <div className="help-mini-card"><strong>Account access</strong><span>Use Sign out in Profile to switch accounts, then sign in with another account.</span></div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {helpOpen && (
        <div
          className="settings-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setHelpOpen(false);
            }
          }}
        >
          <section className="settings-modal help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title">
            <div className="settings-modal-header">
              <div>
                <span className="settings-kicker">AURA SUPPORT</span>
                <h2 id="help-title">Help &amp; feedback</h2>
                <p>Find the main controls for your research workspace.</p>
              </div>
              <button
                className="settings-close"
                type="button"
                onClick={() => setHelpOpen(false)}
                aria-label="Close help"
              >
                ×
              </button>
            </div>

            <div className="help-list">
              <div><strong>New research</strong><span>Start a fresh Quick Search or Deep Research session.</span></div>
              <div><strong>Research library</strong><span>Use your recent research items in the left sidebar.</span></div>
              <div><strong>Settings</strong><span>Manage your account, local history, and sign out.</span></div>
              <div><strong>Account menu</strong><span>Click your profile at the bottom-left to quickly access settings and sign out.</span></div>
            </div>

            <div className="settings-modal-footer">
              <button
                type="button"
                className="settings-done"
                onClick={() => setHelpOpen(false)}
              >
                Done
              </button>
            </div>
          </section>
        </div>
      )}

      <div className="app-shell">

        <aside className="sidebar">
          <div className="sidebar-brand">
            <div className="sidebar-logo">✦</div>
            <div>
              <div className="sidebar-name">AURA</div>
              <div className="sidebar-tagline">AI research, grounded in real sources</div>
            </div>
          </div>

          <button className="sidebar-new" onClick={handleNewSearch}>
            <span>＋</span>
            <span>New research</span>
          </button>

          <nav className="sidebar-nav">
            <button className="sidebar-nav-item active" onClick={handleNewSearch}>
              <span>⌂</span>
              Home
            </button>
            <button className="sidebar-nav-item" type="button" onClick={openResearchLibrary}>
              <span>▱</span>
              Research library
            </button>

            <div className="sidebar-section-heading">
              <div className="sidebar-section-title">Recent</div>

              {recentSearches.length > 0 && (
                <button
                  type="button"
                  className="clear-history-button"
                  onClick={clearRecentSearches}
                  title="Clear research history"
                >
                  Clear
                </button>
              )}
            </div>

            {recentSearches.length > 0 ? (
              <div className="recent-search-list">
                {recentSearches.slice(0, 12).map((session) => (
                  <div className="sidebar-recent-row" key={session.id}>
                    <button
                      className="sidebar-recent"
                      type="button"
                      onClick={() => restoreResearchSession(session)}
                      title={session.query}
                    >
                      <span className="recent-clock">◷</span>

                      <span className="recent-content">
                        <strong>{session.query}</strong>
                        <small>
                          {session.mode === "deep"
                            ? "Deep Research"
                            : "Quick Search"}
                        </small>
                      </span>
                    </button>

                    <button
                      className="recent-delete"
                      type="button"
                      title="Remove from history"
                      aria-label={`Remove ${session.query} from history`}
                      onClick={(event) =>
                        deleteRecentSearch(event, session.id)
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="sidebar-empty">
                Your recent research will appear here
              </div>
            )}
          </nav>

          <div className="sidebar-bottom">
            <button
              className="sidebar-nav-item"
              type="button"
              onClick={openHelp}
            >
              <span>?</span>
              Help &amp; feedback
            </button>

            <button
              className="sidebar-nav-item"
              type="button"
              onClick={openSettings}
            >
              <span>⚙</span>
              Settings
            </button>

            <div className="sidebar-divider" />

            <div className="account-area">
              {accountMenuOpen && (
                <div className="account-menu">
                  <div className="account-menu-header">
                    <div className="account-menu-avatar">{userInitial}</div>
                    <div className="account-menu-user">
                      <strong>{displayName}</strong>
                      <span>{user?.email || ""}</span>
                    </div>
                  </div>

                  <div className="account-menu-divider" />

                  <button type="button" onClick={openSettings}>
                    <span>⚙</span>
                    Settings
                  </button>

                  <button type="button" onClick={openHelp}>
                    <span>?</span>
                    Help &amp; feedback
                  </button>

                  <div className="account-menu-divider" />

                  <button
                    type="button"
                    className="account-signout"
                    onClick={handleSignOut}
                  >
                    <span>↪</span>
                    Sign out
                  </button>
                </div>
              )}

              <button
                className="sidebar-footer-brand"
                type="button"
                onClick={() => setAccountMenuOpen((open) => !open)}
                aria-expanded={accountMenuOpen}
                title="Open account menu"
              >
                <div className="sidebar-avatar">{userInitial}</div>
                <div>
                  <strong>{displayName}</strong>
                  <span>{user?.email || "Research workspace"}</span>
                </div>
                <span className="account-chevron">⌃</span>
              </button>
            </div>
          </div>
        </aside>

        <div className="app-content">

      {/* ===================================================
          HEADER
      =================================================== */}

      <header className="header">

        <div className="topbar-context">
          <span className="topbar-dot">✦</span>
          <span>{answer ? (mode === "deep" ? "Deep Research" : "Research" ) : "AURA Research"}</span>
        </div>

        {answer && (
          <button
            className="new-search-button"
            onClick={
              handleNewSearch
            }
          >
            + New Search
          </button>
        )}

      </header>

      {/* ===================================================
          MAIN
      =================================================== */}

      <main className="main">

        {/* =================================================
            HERO
        ================================================= */}

        <section
          className={`hero ${
            answer
              ? "hero-compact"
              : ""
          }`}
        >

          {!answer && (
            <div className="eyebrow">
              <span>✦</span>
              AI RESEARCH ENGINE
            </div>
          )}

          {!answer ? (
            <>
              <h1>
                How can I help
                <span>
                  you research today?
                </span>
              </h1>

              <p className="subtitle">
                Ask anything. AURA will search, analyze, and bring you
                accurate answers with sources you can trust.
              </p>
            </>
          ) : (
            <div className="search-heading">

              <span>
                {mode === "deep"
                  ? "Deep Research"
                  : "Researching"}
              </span>

              <strong>
                {query}
              </strong>

            </div>
          )}

          {/* =============================================
              SEARCH BOX
          ============================================== */}

          <div className="search-wrapper">

            <div className="search-box">

              <span className="search-icon">
                ⌕
              </span>

              <input
                className="search-input"
                type="text"
                placeholder={
                  mode === "deep"
                    ? "Ask a complex research question..."
                    : "Ask anything..."
                }
                value={query}
                onChange={(event) =>
                  setQuery(
                    event.target.value
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !loading
                  ) {
                    handleSearch();
                  }
                }}
                disabled={loading}
              />

              {query &&
                !loading && (
                  <button
                    className="clear-button"
                    onClick={() =>
                      setQuery("")
                    }
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}

              <button
                className="search-button"
                onClick={
                  handleSearch
                }
                disabled={loading}
              >

                {loading ? (
                  <>
                    <span className="spinner" />
                    Working
                  </>
                ) : (
                  <>
                    Search
                    <span>→</span>
                  </>
                )}

              </button>

            </div>

            <div className="search-hint">

              <span>
                Press Enter to search
              </span>

              <span className="shortcut">
                /
              </span>

            </div>

          </div>

          {/* =============================================
              SEARCH MODES
          ============================================== */}

          <div className="search-modes">

            <button
              className={`mode ${
                mode === "quick"
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setMode("quick")
              }
              disabled={loading}
            >
              <span>✦</span>
              Quick Search
            </button>

            <button
              className={`mode ${
                mode === "deep"
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setMode("deep")
              }
              disabled={loading}
            >
              <span>◉</span>
              Deep Research
            </button>

          </div>

          <div className="mode-description">

            {mode === "quick"
              ? "Quick answers with relevant sources"
              : "Deeper analysis across multiple sources"}

          </div>

          {!answer && !loading && (
            <div className="prompt-cards">
              <button type="button" onClick={() => setQuery("What are the latest developments in artificial intelligence?")}>
                <span className="prompt-icon">✦</span>
                <span><strong>Latest AI developments</strong><small>What are the newest breakthroughs in AI?</small></span>
                <span className="prompt-arrow">→</span>
              </button>
              <button type="button" onClick={() => setQuery("Compare the best programming languages for beginners")}>
                <span className="prompt-icon">⚖</span>
                <span><strong>Compare technologies</strong><small>Compare the best programming languages</small></span>
                <span className="prompt-arrow">→</span>
              </button>
              <button type="button" onClick={() => setQuery("What skills will be most valuable for software engineers?")}>
                <span className="prompt-icon">▣</span>
                <span><strong>Career research</strong><small>What skills will be most valuable in the future?</small></span>
                <span className="prompt-arrow">→</span>
              </button>
            </div>
          )}

          {/* =============================================
              LOADING
          ============================================== */}

          {loading && (
            <div className="loading-panel">

              <div className="loading-orb">
                ✦
              </div>

              <div>

                <strong>
                  {loadingStep}
                </strong>

                <div className="loading-line">
                  {mode === "deep"
                    ? "AURA is researching, grounding, and verifying your question"
                    : "AURA is researching your question"}
                </div>

              </div>

            </div>
          )}

          {/* =============================================
              ERROR
          ============================================== */}

          {error && (
            <div className="error-message">

              <span>!</span>

              {error}

            </div>
          )}

        </section>

        {/* =================================================
            AI ANSWER
        ================================================= */}

        {answer && (
          <section
            id="answer-section"
            className="answer-section"
          >

            <div className="section-header">

              <div>

                <div className="section-label">

                  <span>✦</span>

                  {mode === "deep"
                    ? "AI RESEARCH REPORT"
                    : "AI ANSWER"}

                </div>

                <p>
                  {mode === "deep"
                    ? "Synthesized from multi-source research."
                    : "Synthesized from relevant web research."}
                </p>

              </div>

              <div className="answer-actions">

                <span>
                  Based on{" "}
                  {sources.length}{" "}
                  sources
                </span>

                <button
                  onClick={
                    copyAnswer
                  }
                  className="copy-button"
                >
                  Copy
                </button>

              </div>

            </div>

            <div className="answer-card">

              <div className="answer-card-header">

                <div className="ai-avatar">
                  ✦
                </div>

                <div>

                  <strong>
                    AURA Intelligence
                  </strong>

                  <span>
                    {mode === "deep"
                      ? "Deep research synthesis"
                      : "AI-generated research synthesis"}
                  </span>

                </div>

              </div>

              <div className="answer-content">
                {renderAnswer(answer)}
              </div>

            </div>

          </section>
        )}

        {/* =================================================
            VERIFICATION AGENT
        ================================================= */}

        {mode === "deep" &&
          verificationStats && (
            <VerificationSection
              stats={
                verificationStats
              }
              onSourceClick={
                scrollToSource
              }
            />
          )}

        {/* =================================================
            RESEARCH PLAN
        ================================================= */}

        {mode === "deep" &&
          researchQueries.length >
            0 && (
            <section className="research-plan">

              <div className="section-header">

                <div>

                  <div className="section-label">

                    <span>◎</span>

                    RESEARCH PLAN

                  </div>

                  <p>
                    AURA investigated
                    multiple perspectives
                    of your question.
                  </p>

                </div>

                <span className="source-count">
                  {
                    researchQueries.length
                  }{" "}
                  research paths
                </span>

              </div>

              <div className="research-plan-list">

                {researchQueries.map(
                  (
                    researchQuery,
                    index
                  ) => (
                    <div
                      className="research-plan-item"
                      key={index}
                    >

                      <div className="research-plan-number">
                        {String(
                          index + 1
                        ).padStart(
                          2,
                          "0"
                        )}
                      </div>

                      <div>

                        <span>
                          Research path
                        </span>

                        <p>
                          {
                            researchQuery
                          }
                        </p>

                      </div>

                    </div>
                  )
                )}

              </div>

            </section>
          )}

        {/* =================================================
            SOURCES
        ================================================= */}

        {sources.length > 0 && (
          <section className="sources-section">

            <div className="section-header">

              <div>

                <div className="section-label">

                  <span>◇</span>

                  SOURCES

                </div>

                <p>
                  Explore the sources
                  used to generate
                  the answer.
                </p>

              </div>

              <span className="source-count">
                {sources.length}{" "}
                sources
              </span>

            </div>

            <div className="sources-grid">

              {sources.map(
                (
                  source,
                  index
                ) => {

                  const number =
                    source.number ||
                    index + 1;

                  return (
                    <a
                      key={
                        source.url ||
                        index
                      }
                      id={`source-${number}`}
                      className="source-card"
                      href={
                        source.url
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                    >

                      <div className="source-top">

                        <span className="source-number">
                          [
                          {number}
                          ]
                        </span>

                        <span className="external-icon">
                          ↗
                        </span>

                      </div>

                      <div className="source-content">

                        <h3>
                          {
                            source.title ||
                            "Untitled Source"
                          }
                        </h3>

                        <span className="source-domain">
                          {getDomain(
                            source.url
                          )}
                        </span>

                      </div>

                      {source.similarity !==
                        undefined &&
                        source.similarity !==
                          null && (
                          <div className="relevance">

                            <span>
                              Relevance
                            </span>

                            <span>
                              {Math.round(
                                Number(
                                  source.similarity
                                ) * 100
                              )}
                              %
                            </span>

                          </div>
                        )}

                    </a>
                  );
                }
              )}

            </div>

          </section>
        )}

        {/* =================================================
            WEB RESEARCH
        ================================================= */}

        {results.length > 0 && (
          <section className="research-section">

            <div className="section-header">

              <div>

                <div className="section-label">

                  <span>◎</span>

                  WEB RESEARCH

                </div>

                <p>
                  Information AURA
                  retrieved from
                  the web.
                </p>

              </div>

              <span className="source-count">
                {results.length}{" "}
                results
              </span>

            </div>

            <div className="results-list">

              {results.map(
                (
                  result,
                  index
                ) => (
                  <article
                    className="result-card"
                    key={
                      result.url ||
                      index
                    }
                  >

                    <div className="result-number">
                      {String(
                        index + 1
                      ).padStart(
                        2,
                        "0"
                      )}
                    </div>

                    <div className="result-main">

                      <div className="result-meta">

                        <span>
                          {getDomain(
                            result.url
                          )}
                        </span>

                        <span>
                          •
                        </span>

                        <span>
                          Web Result
                        </span>

                      </div>

                      <h3>
                        {
                          result.title
                        }
                      </h3>

                      <p>
                        {
                          result.content
                        }
                      </p>

                      <a
                        href={
                          result.url
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="read-source"
                      >
                        Read source
                        <span>
                          ↗
                        </span>
                      </a>

                    </div>

                  </article>
                )
              )}

            </div>

          </section>
        )}

        {/* =================================================
            EMPTY STATE
        ================================================= */}

        {!answer &&
          !loading &&
          !error && (
            <section className="features">

              <div className="feature-card">

                <div className="feature-number">
                  01
                </div>

                <div className="feature-icon">
                  ✦
                </div>

                <h3>
                  AI Answers
                </h3>

                <p>
                  Get clear,
                  synthesized answers
                  from relevant
                  information.
                </p>

              </div>

              <div className="feature-card">

                <div className="feature-number">
                  02
                </div>

                <div className="feature-icon">
                  ◇
                </div>

                <h3>
                  Trusted Sources
                </h3>

                <p>
                  Explore the sources
                  behind every
                  AI-generated answer.
                </p>

              </div>

              <div className="feature-card">

                <div className="feature-number">
                  03
                </div>

                <div className="feature-icon">
                  ◎
                </div>

                <h3>
                  Deep Research
                </h3>

                <p>
                  Let AURA investigate
                  complex topics across
                  multiple sources.
                </p>

              </div>

            </section>
          )}

      </main>

      {/* ===================================================
          FOOTER
      =================================================== */}

      <footer className="footer">

        <div>

          <strong>
            AURA
          </strong>

          <span>
            AI research, grounded in real sources
          </span>

        </div>

        <div className="status-list">

          <span>
            <i />
            Web research
          </span>

          <span>
            <i />
            Source grounding
          </span>

          <span>
            <i />
            AI synthesis
          </span>

          {mode === "deep" && (
            <span>
              <i />
              Claim verification
            </span>
          )}

        </div>

      </footer>

        </div>
      </div>

    </div>
  );
}

// ===========================================================
// VERIFICATION SECTION
// ===========================================================

function VerificationSection({
  stats,
  onSourceClick,
}) {
  const score = Math.round(
    stats.score
  );

  return (
    <section className="verification-section">

      <div className="section-header">

        <div>

          <div className="verification-heading-row">
            <div className="section-label">
              <span>✓</span>
              VERIFICATION AGENT
            </div>

            <span
              className={`verification-status-badge ${stats.status.className}`}
            >
              {stats.status.icon} {stats.status.label}
            </span>
          </div>

          <p>
            AURA checked research
            claims against retrieved
            source evidence.
          </p>

        </div>

        <div className="verification-score">

          <span>
            Verification score
          </span>

          <strong>
            {score}%
          </strong>

        </div>

      </div>

      <div className="verification-summary">

        <div
          className="verification-score-ring"
          style={{
            "--score": `${score}%`,
          }}
        >

          <div>

            <strong>
              {score}%
            </strong>

            <span>
              verified
            </span>

          </div>

        </div>

        <div className="verification-stat-grid">

          <VerificationStat
            label="Claims Checked"
            value={stats.claimsChecked}
            className="total"
          />

          <VerificationStat
            label="Supported"
            value={
              stats.supported
            }
            className="supported"
          />

          <VerificationStat
            label="Partially Supported"
            value={
              stats.partial
            }
            className="partial"
          />

          <VerificationStat
            label="Unsupported"
            value={
              stats.unsupported
            }
            className="unsupported"
          />

        </div>

      </div>

      {stats.claims.length >
        0 && (
        <div className="claims-section">

          <div className="claims-heading">

            <div>

              <strong>
                Claim verification
              </strong>

              <span>
                {
                  stats.claims.length
                }{" "}
                claims checked
                against evidence
              </span>

            </div>

          </div>

          <div className="claims-list">

            {stats.claims.map(
              (
                claim,
                index
              ) => (
                <ClaimCard
                  key={
                    claim.id ||
                    index
                  }
                  claim={claim}
                  onSourceClick={
                    onSourceClick
                  }
                />
              )
            )}

          </div>

        </div>
      )}

    </section>
  );
}

// ===========================================================
// VERIFICATION STAT
// ===========================================================

function VerificationStat({
  label,
  value,
  className,
}) {
  return (
    <div
      className={`verification-stat ${className}`}
    >

      <div className="verification-stat-dot" />

      <strong>
        {value}
      </strong>

      <span>
        {label}
      </span>

    </div>
  );
}

// ===========================================================
// CLAIM CARD
// ===========================================================

function ClaimCard({
  claim,
  onSourceClick,
}) {
  const status =
    normalizeStatus(
      claim.status
    );

  const confidence =
    normalizeConfidence(
      claim.confidence
    );

  return (
    <article
      className={`claim-card ${status.className}`}
    >

      <div className="claim-top">

        <span
          className={`status-badge ${status.className}`}
        >
          {status.label}
        </span>

        <span className="claim-confidence">
          {confidence}%
          confidence
        </span>

      </div>

      <div className="claim-text">
        {stripMarkdown(
          claim.claim ||
            "Claim unavailable"
        )}
      </div>

      {claim.evidence && (
        <div className="claim-evidence">

          <span>
            Evidence
          </span>

          <p>
            {claim.evidence}
          </p>

        </div>
      )}

      {Array.isArray(
        claim.sources
      ) &&
        claim.sources.length >
          0 && (
          <div className="claim-sources">

            <span>
              Sources
            </span>

            <div>

              {claim.sources.map(
                (
                  sourceNumber
                ) => (
                  <button
                    type="button"
                    key={
                      sourceNumber
                    }
                    onClick={() =>
                      onSourceClick(
                        Number(
                          sourceNumber
                        )
                      )
                    }
                  >
                    [
                    {
                      sourceNumber
                    }
                    ]
                  </button>
                )
              )}

            </div>

          </div>
        )}

    </article>
  );
}

// ===========================================================
// NORMALIZE VERIFICATION RESPONSE
// ===========================================================

function normalizeVerification(
  data
) {
  if (!data) {
    return null;
  }

  const rawClaims =
    Array.isArray(
      data.claims
    )
      ? data.claims
      : Array.isArray(
            data.results
          )
        ? data.results
        : [];

  const claims =
    rawClaims.map(
      (
        claim,
        index
      ) => ({
        ...claim,

        id:
          claim.id ||
          index + 1,

        status:
          normalizeStatus(
            claim.status
          ).raw,

        confidence:
          normalizeConfidenceValue(
            claim.confidence
          ),

        sources:
          Array.isArray(
            claim.sources
          )
            ? claim.sources
            : [],
      })
    );

  const summary =
    data.summary ||
    data.statistics ||
    data.stats ||
    {};

  let supported =
    toNumber(
      summary.supported ??
        summary.SUPPORTED ??
        data.supported ??
        data.supportedClaims
    ) ?? 0;

  let partial =
    toNumber(
      summary.partial ??
        summary.partiallySupported ??
        summary.PARTIALLY_SUPPORTED ??
        data.partial ??
        data.partiallySupported
    ) ?? 0;

  let unsupported =
    toNumber(
      summary.unsupported ??
        summary.UNSUPPORTED ??
        data.unsupported ??
        data.unsupportedClaims
    ) ?? 0;

  /*
   * If individual claims are available,
   * calculate the statistics directly
   * from those claims.
   */

  if (claims.length > 0) {
    supported =
      claims.filter(
        (claim) =>
          claim.status ===
          "SUPPORTED"
      ).length;

    partial =
      claims.filter(
        (claim) =>
          claim.status ===
          "PARTIALLY_SUPPORTED"
      ).length;

    unsupported =
      claims.filter(
        (claim) =>
          claim.status ===
          "UNSUPPORTED"
      ).length;
  }

  const total =
    supported +
    partial +
    unsupported;

  const rawScore =
    toNumber(
      summary.score ??
        summary.verificationScore ??
        data.score ??
        data.verificationScore
    );

  const score =
    rawScore !== null
      ? rawScore <= 1
        ? rawScore * 100
        : rawScore
      : total > 0
        ? ((supported +
            partial * 0.5) /
            total) *
          100
        : 0;

  const claimsChecked =
    toNumber(
      data.claimsChecked ??
        summary.claimsChecked
    ) ?? total;

  const rawStatus =
    String(
      data.status ??
        summary.status ??
        ""
    )
      .trim()
      .toLowerCase();

  const status =
    rawStatus === "verified"
      ? {
          label: "Verified",
          className: "verified",
          icon: "✓",
        }
      : unsupported > 0
        ? {
            label: "Needs Review",
            className: "needs-review",
            icon: "!",
          }
        : partial > 0
          ? {
              label: "Partially Verified",
              className: "partial",
              icon: "◐",
            }
          : {
              label:
                claimsChecked > 0
                  ? "Verified"
                  : "No Claims",
              className:
                claimsChecked > 0
                  ? "verified"
                  : "empty",
              icon:
                claimsChecked > 0
                  ? "✓"
                  : "—",
            };

  return {
    supported,
    partial,
    unsupported,
    claimsChecked,
    score: Math.max(
      0,
      Math.min(100, score)
    ),
    status,
    claims,
  };
}

// ===========================================================
// STATUS
// ===========================================================

function normalizeStatus(
  status
) {
  const normalized =
    String(
      status || ""
    )
      .trim()
      .toUpperCase()
      .replace(
        /[\s-]+/g,
        "_"
      );

  if (
    normalized ===
      "PARTIAL" ||
    normalized ===
      "PARTIALLY_SUPPORTED"
  ) {
    return {
      raw:
        "PARTIALLY_SUPPORTED",

      label:
        "Partially Supported",

      className:
        "partial",
    };
  }

  if (
    normalized ===
    "UNSUPPORTED"
  ) {
    return {
      raw:
        "UNSUPPORTED",

      label:
        "Unsupported",

      className:
        "unsupported",
    };
  }

  return {
    raw:
      "SUPPORTED",

    label:
      "Supported",

    className:
      "supported",
  };
}

// ===========================================================
// CONFIDENCE
// ===========================================================

function normalizeConfidence(
  value
) {
  const normalized =
    normalizeConfidenceValue(
      value
    );

  return Math.round(
    normalized * 100
  );
}

function normalizeConfidenceValue(
  value
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return 0;
  }

  return number > 1
    ? number / 100
    : number;
}

// ===========================================================
// NUMBER
// ===========================================================

function toNumber(
  value
) {
  if (
    value ===
      undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : null;
}

// ===========================================================
// REMOVE MARKDOWN FROM CLAIM TEXT
// ===========================================================

function stripMarkdown(
  text
) {
  return String(text)
    .replace(
      /\*\*(.*?)\*\*/g,
      "$1"
    )
    .replace(
      /__(.*?)__/g,
      "$1"
    )
    .replace(
      /`(.*?)`/g,
      "$1"
    )
    .replace(
      /\s*\[(\d+)\](?=\s|[.,;:)]|$)/g,
      ""
    )
    .replace(
      /\s{2,}/g,
      " "
    )
    .trim();
}

// ===========================================================
// RESEARCH LIBRARY HELPERS
// ===========================================================

function formatResearchDate(value) {
  if (!value) return "Saved research";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Saved research";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getLibraryPreview(answer, sourceCount) {
  const text = stripMarkdown(answer || "");
  if (text) {
    return text.length > 180 ? `${text.slice(0, 180).trim()}…` : text;
  }

  return sourceCount > 0
    ? `${sourceCount} source${sourceCount === 1 ? "" : "s"} saved with this research.`
    : "Saved research session.";
}

// ===========================================================
// DOMAIN
// ===========================================================

function getDomain(
  url
) {
  if (!url) {
    return "Unknown source";
  }

  try {
    return new URL(url)
      .hostname
      .replace(
        "www.",
        ""
      );
  } catch {
    return "Unknown source";
  }
}

export default App;