import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Trash2, Check, TrendingUp, TrendingDown, Minus, BookOpen, Flame, X, Award } from "lucide-react";

// ---------- helpers ----------
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

const dateStrDaysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

const daysBetweenInclusive = (startStr, endStr) => {
  const start = new Date(startStr + "T00:00:00");
  const end = new Date(endStr + "T00:00:00");
  const diff = Math.round((end - start) / 86400000);
  return diff + 1;
};

const STORAGE_KEY = "task-ledger:tasks";

export default function TaskLedger() {
  const [tasks, setTasks] = useState(null); // null = loading
  const [view, setView] = useState("today"); // 'today' | 'explore'
  const [newTaskName, setNewTaskName] = useState("");
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // ---------- load ----------
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setTasks(raw ? JSON.parse(raw) : []);
    } catch (e) {
      setTasks([]);
    }
  }, []);

  // ---------- persist ----------
  const persist = useCallback(async (next) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setError(null);
    } catch (e) {
      setError("Couldn't save — try again.");
    }
  }, []);

  const updateTasks = useCallback(
    (updater) => {
      setTasks((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        persist(next);
        return next;
      });
    },
    [persist]
  );

  // ---------- actions ----------
  const addTask = () => {
    const name = newTaskName.trim();
    if (!name) return;
    const newTask = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      createdDate: todayStr(),
      log: {},
    };
    updateTasks((prev) => [...prev, newTask]);
    setNewTaskName("");
  };

  const toggleToday = (id) => {
    const t = todayStr();
    updateTasks((prev) =>
      prev.map((task) =>
        task.id === id
          ? { ...task, log: { ...task.log, [t]: !task.log[t] } }
          : task
      )
    );
  };

  const deleteTask = (id) => {
    updateTasks((prev) => prev.filter((task) => task.id !== id));
    setConfirmDelete(null);
  };

  // ---------- derived stats ----------
  const stats = useMemo(() => {
    if (!tasks) return [];
    const t = todayStr();
    return tasks.map((task) => {
      const totalDays = Math.max(1, daysBetweenInclusive(task.createdDate, t));
      const completed = Object.values(task.log).filter(Boolean).length;
      const pct = Math.round((completed / totalDays) * 100);

      // last 14 days squares
      const squares = [];
      for (let i = 13; i >= 0; i--) {
        const ds = dateStrDaysAgo(i);
        const inRange = ds >= task.createdDate;
        squares.push({ date: ds, done: !!task.log[ds], inRange });
      }

      // current streak
      let streak = 0;
      for (let i = 0; ; i++) {
        const ds = dateStrDaysAgo(i);
        if (ds < task.createdDate) break;
        if (task.log[ds]) streak++;
        else break;
      }

      // longest streak ever
      let longestStreak = 0;
      let running = 0;
      for (let i = totalDays - 1; i >= 0; i--) {
        const ds = dateStrDaysAgo(i);
        if (task.log[ds]) {
          running++;
          longestStreak = Math.max(longestStreak, running);
        } else {
          running = 0;
        }
      }

      // 7-day trend: this week vs previous week completion rate
      const countRange = (fromDaysAgo, toDaysAgo) => {
        let done = 0;
        let possible = 0;
        for (let i = fromDaysAgo; i >= toDaysAgo; i--) {
          const ds = dateStrDaysAgo(i);
          if (ds < task.createdDate) continue;
          possible++;
          if (task.log[ds]) done++;
        }
        return possible > 0 ? Math.round((done / possible) * 100) : null;
      };
      const last7Pct = countRange(6, 0);
      const prev7Pct = countRange(13, 7);
      let trend = "flat";
      if (last7Pct !== null && prev7Pct !== null) {
        if (last7Pct > prev7Pct + 4) trend = "up";
        else if (last7Pct < prev7Pct - 4) trend = "down";
      }

      return { ...task, totalDays, completed, pct, squares, streak, longestStreak, last7Pct, prev7Pct, trend };
    });
  }, [tasks]);

  const sortedByPct = useMemo(
    () => [...stats].sort((a, b) => b.pct - a.pct),
    [stats]
  );

  const tierColor = (pct) => {
    if (pct >= 80) return { bar: "#5fb88f", text: "#5fb88f" };
    if (pct >= 50) return { bar: "#e8a33d", text: "#e8a33d" };
    return { bar: "#d9634a", text: "#d9634a" };
  };

  // ---------- render ----------
  if (tasks === null) {
    return (
      <div style={styles.page}>
        <div style={{ ...styles.container, alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
          <p style={{ color: "#8b8f9a", fontFamily: styles.fontBody }}>Loading your ledger…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .tl-row { animation: fadeIn 0.25s ease; }
        .tl-check:focus-visible, .tl-tab:focus-visible, .tl-add:focus-visible, .tl-input:focus-visible, .tl-del:focus-visible {
          outline: 2px solid #e8a33d; outline-offset: 2px;
        }
        .tl-check { transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease; }
        .tl-check:active { transform: scale(0.92); }
        .tl-tab { transition: color 0.15s ease; }
        .tl-del { transition: opacity 0.15s ease; opacity: 0; }
        .tl-row:hover .tl-del { opacity: 1; }
        .tl-bar-fill { transition: width 0.5s ease; }
        @media (prefers-reduced-motion: reduce) {
          .tl-row { animation: none; }
          .tl-bar-fill { transition: none; }
        }
      `}</style>

      <div style={styles.container}>
        {/* Header */}
        <header style={styles.header}>
          <div>
            <div style={styles.eyebrow}>DAILY LEDGER</div>
            <h1 style={styles.title}>Kya aaj kiya?</h1>
          </div>
          <nav style={styles.tabs}>
            <button
              className="tl-tab"
              onClick={() => setView("today")}
              style={{
                ...styles.tabBtn,
                color: view === "today" ? "#f2ede4" : "#6b6f7a",
                borderBottom: view === "today" ? "2px solid #e8a33d" : "2px solid transparent",
              }}
            >
              <BookOpen size={15} style={{ marginRight: 6, verticalAlign: -2 }} />
              Today
            </button>
            <button
              className="tl-tab"
              onClick={() => setView("explore")}
              style={{
                ...styles.tabBtn,
                color: view === "explore" ? "#f2ede4" : "#6b6f7a",
                borderBottom: view === "explore" ? "2px solid #e8a33d" : "2px solid transparent",
              }}
            >
              <TrendingUp size={15} style={{ marginRight: 6, verticalAlign: -2 }} />
              Explore
            </button>
          </nav>
        </header>

        {error && <div style={styles.errorBanner}>{error}</div>}

        {tasks.length === 0 ? (
          <div style={styles.empty}>
            <p style={styles.emptyText}>
              Abhi koi task nahi hai. Neeche pehla task add karo — gym, no alcohol, study, kuch bhi.
            </p>
          </div>
        ) : view === "today" ? (
          <TodayView stats={stats} toggleToday={toggleToday} tierColor={tierColor} />
        ) : (
          <ExploreView sortedByPct={sortedByPct} tierColor={tierColor} onDelete={setConfirmDelete} />
        )}

        {/* Add task — only on Today view */}
        {view === "today" && (
          <div style={styles.addRow}>
            <input
              className="tl-input"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              placeholder="Naya task likho… (jaise: Gym, No alcohol, Study)"
              style={styles.input}
              maxLength={60}
            />
            <button className="tl-add" onClick={addTask} style={styles.addBtn} aria-label="Add task">
              <Plus size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div style={styles.modalOverlay} onClick={() => setConfirmDelete(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <p style={{ color: "#f2ede4", fontFamily: styles.fontBody, fontSize: 14, marginBottom: 16 }}>
              "{confirmDelete.name}" ko delete karein? Iski poori history chali jayegi.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDelete(null)} style={styles.modalCancel}>
                Cancel
              </button>
              <button onClick={() => deleteTask(confirmDelete.id)} style={styles.modalDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Today View ----------
function TodayView({ stats, toggleToday, tierColor }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {stats.map((task) => {
        const t = tierColor(task.pct);
        const doneToday = task.squares[13].done;
        return (
          <div key={task.id} className="tl-row" style={styles.taskRow}>
            <button
              className="tl-check"
              onClick={() => toggleToday(task.id)}
              aria-pressed={doneToday}
              aria-label={`Mark ${task.name} ${doneToday ? "not done" : "done"} for today`}
              style={{
                ...styles.checkbox,
                background: doneToday ? "#5fb88f" : "transparent",
                borderColor: doneToday ? "#5fb88f" : "#4a4e5a",
              }}
            >
              {doneToday && <Check size={14} color="#12151c" strokeWidth={3} />}
            </button>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={styles.taskName}>{task.name}</div>
              <div style={styles.squareRow}>
                {task.squares.map((sq, i) => (
                  <div
                    key={i}
                    title={sq.date}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: !sq.inRange
                        ? "transparent"
                        : sq.done
                        ? "#5fb88f"
                        : "#2a2e38",
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ ...styles.pctLabel, color: t.text }}>{task.pct}%</div>
              {task.streak > 0 && (
                <div style={styles.streakLabel}>
                  <Flame size={11} style={{ marginRight: 2, verticalAlign: -2 }} />
                  {task.streak}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Explore View ----------
function TrendBadge({ trend, last7Pct, prev7Pct }) {
  if (last7Pct === null || prev7Pct === null) return null;
  const map = {
    up: { icon: TrendingUp, color: "#5fb88f", label: "improve ho raha hai" },
    down: { icon: TrendingDown, color: "#d9634a", label: "gir raha hai" },
    flat: { icon: Minus, color: "#8b8f9a", label: "steady hai" },
  };
  const { icon: Icon, color, label } = map[trend];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color, fontSize: 11, fontFamily: styles.fontMono }}>
      <Icon size={12} />
      is week {label}
    </span>
  );
}

function ExploreView({ sortedByPct, tierColor, onDelete }) {
  const strongest = sortedByPct[0];
  const weakest = sortedByPct[sortedByPct.length - 1];
  const risers = sortedByPct.filter((t) => t.trend === "up");
  const fallers = sortedByPct.filter((t) => t.trend === "down");

  return (
    <div>
      {sortedByPct.length > 1 && (
        <div style={styles.insightBox}>
          <span style={{ color: "#5fb88f" }}>{strongest.name}</span> mein sabse zyada consistent ho ({strongest.pct}%).{" "}
          <span style={{ color: "#d9634a" }}>{weakest.name}</span> pe sabse zyada dhyaan dena hai ({weakest.pct}%).
          {fallers.length > 0 && (
            <>
              {" "}Is hafte <span style={{ color: "#d9634a" }}>{fallers.map((f) => f.name).join(", ")}</span> mein giravat aayi hai.
            </>
          )}
          {risers.length > 0 && (
            <>
              {" "}<span style={{ color: "#5fb88f" }}>{risers.map((f) => f.name).join(", ")}</span> mein improvement dikh raha hai.
            </>
          )}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
        {sortedByPct.map((task) => {
          const t = tierColor(task.pct);
          return (
            <div key={task.id} className="tl-row" style={styles.exploreRow}>
              <div style={styles.exploreTop}>
                <span style={styles.exploreName}>{task.name}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ ...styles.pctLabel, color: t.text, fontSize: 15 }}>{task.pct}%</span>
                  <button
                    className="tl-del"
                    onClick={() => onDelete(task)}
                    aria-label={`Delete ${task.name}`}
                    style={styles.delBtn}
                  >
                    <Trash2 size={14} />
                  </button>
                </span>
              </div>
              <div style={styles.barTrack}>
                <div
                  className="tl-bar-fill"
                  style={{ width: `${task.pct}%`, background: t.bar, height: "100%", borderRadius: 3 }}
                />
              </div>
              <div style={styles.exploreMeta}>
                {task.completed} / {task.totalDays} din pura kiya · shuru hua {task.createdDate}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#e8a33d", fontSize: 11, fontFamily: styles.fontMono }}>
                  <Award size={12} />
                  best streak: {task.longestStreak} din
                </span>
                <TrendBadge trend={task.trend} last7Pct={task.last7Pct} prev7Pct={task.prev7Pct} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- styles ----------
const styles = {
  fontDisplay: "Georgia, 'Times New Roman', serif",
  fontBody:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontMono:
    "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
  page: {
    minHeight: "100vh",
    background: "#12151c",
    padding: "28px 16px 60px",
    boxSizing: "border-box",
  },
  container: {
    maxWidth: 560,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 22,
    flexWrap: "wrap",
    gap: 12,
  },
  eyebrow: {
    fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
    fontSize: 10.5,
    letterSpacing: "0.14em",
    color: "#e8a33d",
    marginBottom: 6,
  },
  title: {
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: 28,
    color: "#f2ede4",
    margin: 0,
    fontWeight: 400,
  },
  tabs: {
    display: "flex",
    gap: 18,
  },
  tabBtn: {
    background: "none",
    border: "none",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: 13.5,
    fontWeight: 600,
    padding: "4px 2px 8px",
    cursor: "pointer",
  },
  errorBanner: {
    background: "#3a1f1f",
    color: "#e8a89e",
    fontSize: 12.5,
    padding: "8px 12px",
    borderRadius: 6,
    marginBottom: 14,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  empty: {
    padding: "40px 20px",
    textAlign: "center",
    border: "1px dashed #2a2e38",
    borderRadius: 10,
    marginBottom: 18,
  },
  emptyText: {
    color: "#8b8f9a",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: 13.5,
    lineHeight: 1.6,
    margin: 0,
  },
  taskRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: "#181c25",
    border: "1px solid #232733",
    borderRadius: 10,
    padding: "12px 14px",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    border: "1.5px solid #4a4e5a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
  },
  taskName: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: 14.5,
    color: "#f2ede4",
    marginBottom: 5,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  squareRow: {
    display: "flex",
    gap: 3,
  },
  pctLabel: {
    fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
    fontSize: 14,
    fontWeight: 600,
  },
  streakLabel: {
    fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
    fontSize: 10.5,
    color: "#e8a33d",
    marginTop: 2,
  },
  addRow: {
    display: "flex",
    gap: 8,
    marginTop: 18,
  },
  input: {
    flex: 1,
    background: "#181c25",
    border: "1px solid #2a2e38",
    borderRadius: 8,
    padding: "11px 13px",
    color: "#f2ede4",
    fontSize: 13.5,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    outline: "none",
  },
  addBtn: {
    background: "#e8a33d",
    border: "none",
    borderRadius: 8,
    width: 42,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: "#12151c",
  },
  insightBox: {
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: 14.5,
    lineHeight: 1.6,
    color: "#c9cdd6",
    background: "#181c25",
    border: "1px solid #232733",
    borderRadius: 10,
    padding: "14px 16px",
    fontStyle: "italic",
  },
  exploreRow: {
    background: "#181c25",
    border: "1px solid #232733",
    borderRadius: 10,
    padding: "13px 15px",
  },
  exploreTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  exploreName: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: 14.5,
    color: "#f2ede4",
    fontWeight: 500,
  },
  barTrack: {
    width: "100%",
    height: 6,
    background: "#232733",
    borderRadius: 3,
    overflow: "hidden",
  },
  exploreMeta: {
    fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
    fontSize: 10.5,
    color: "#6b6f7a",
    marginTop: 7,
  },
  delBtn: {
    background: "none",
    border: "none",
    color: "#6b6f7a",
    cursor: "pointer",
    padding: 2,
    display: "flex",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 50,
  },
  modal: {
    background: "#1c2029",
    border: "1px solid #2a2e38",
    borderRadius: 12,
    padding: 20,
    maxWidth: 340,
    width: "100%",
  },
  modalCancel: {
    background: "none",
    border: "1px solid #3a3e4a",
    color: "#c9cdd6",
    borderRadius: 7,
    padding: "8px 14px",
    fontSize: 13,
    cursor: "pointer",
  },
  modalDelete: {
    background: "#d9634a",
    border: "none",
    color: "#12151c",
    borderRadius: 7,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
};
