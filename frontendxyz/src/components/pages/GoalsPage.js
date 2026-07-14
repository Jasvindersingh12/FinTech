import React, { useEffect, useState } from "react";
import { PageHeader } from "../common";

export const GoalsPage = ({ activePage, refreshDashboard, onGoalAdded }) => {
  const [goals, setGoals] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [goalName, setGoalName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [addAmount, setAddAmount] = useState({}); // per-goal input

  const API_URL = "http://localhost:8000/api/goals";

  // Load goals from backend
  useEffect(() => {
    fetch(API_URL)
      .then(res => res.json())
      .then(json => {
        if (json.status) setGoals(json.data);
      })
      .catch(err => console.error("Failed to load goals", err));
  }, []);

  // Add new goal
  const addGoal = async () => {
    if (!goalName || !targetAmount) return;

    const newGoal = { goal: goalName, target: Number(targetAmount), saved: 0, dueDate: "" };

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newGoal),
      });
      const json = await res.json();
      if (json.status) setGoals([...goals, json.data]);

      setGoalName("");
      setTargetAmount("");
      setShowForm(false);
    } catch (err) {
      console.error("Error saving goal", err);
    }
  };

  // Delete goal
  const deleteGoal = async (id) => {
    try {
      const res = await fetch(`${API_URL}/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.status) setGoals(goals.filter(g => g.id !== id));
    } catch (err) {
      console.error("Error deleting goal", err);
    }
  };

  // Add progress & create expense transaction
  const handleAddAmount = async (goal) => {
    const amount = parseFloat(addAmount[goal.id]);
    if (!amount || amount <= 0) return alert("Enter a valid amount");

    const newTx = {
      desc: `Goal: ${goal.goal}`,
      category: goal.goal,
      amount: -Math.abs(amount),
      type: "Expense",
      date: new Date().toISOString().split("T")[0],
    };

    try {
      const res = await fetch("http://127.0.0.1:8000/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTx),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");

      // Update goal progress immediately
      setGoals(prevGoals =>
        prevGoals.map(g =>
          g.id === goal.id ? { ...g, saved: (g.saved || 0) + amount } : g
        )
      );

      setAddAmount({ ...addAmount, [goal.id]: "" });

      // Trigger dashboard refresh
      onGoalAdded();

      alert("Added to transactions!");
    } catch (err) {
      console.error(err);
      alert("Error adding transaction");
    }
  };

  return (
    <div id="goals" className={`page ${activePage === "goals" ? "block" : "hidden"} p-6`}>
      <PageHeader title="Financial Goals" subtitle="Plan and achieve your goals">
        <button
          className="bg-purple-600 text-white px-6 py-3 rounded-lg"
          onClick={() => setShowForm(!showForm)}
        >
          + New Goal
        </button>
      </PageHeader>

      {showForm && (
        <div className="bg-white p-6 rounded-xl shadow-lg mb-6 space-y-4">
          <input
            className="w-full p-3 border rounded-lg"
            placeholder="Goal name"
            value={goalName}
            onChange={(e) => setGoalName(e.target.value)}
          />
          <input
            className="w-full p-3 border rounded-lg"
            placeholder="Target Amount (₹)"
            type="number"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
          />
          <button
            className="bg-purple-600 text-white px-5 py-3 rounded-lg"
            onClick={addGoal}
          >
            Save Goal
          </button>
        </div>
      )}

      <div className="space-y-4">
        {goals.length === 0 ? (
          <p className="text-gray-500 italic">No goals yet.</p>
        ) : (
          goals.map(goal => (
            <div key={goal.id} className="bg-white p-6 rounded-xl shadow-lg">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold">{goal.goal}</h3>
                  <p className="mt-2 text-gray-700">
                    Target: <b>₹{goal.target}</b>
                  </p>
                  <p className="text-gray-600">Progress: ₹{goal.saved || 0}</p>
                  <div className="w-full bg-gray-200 rounded-full h-4 mt-2">
  <div
    className="bg-purple-600 h-4 rounded-full"
    style={{ width: `${Math.min(((goal.saved || 0) / goal.target) * 100, 100)}%` }}
  ></div>
</div>
                </div>

                {/* Input + button compact on right */}
                <div className="flex flex-col items-end gap-2">
                  <input
                    type="number"
                    className="p-1 border rounded w-20 text-sm"
                    placeholder="₹"
                    value={addAmount[goal.id] || ""}
                    onChange={(e) =>
                      setAddAmount({ ...addAmount, [goal.id]: e.target.value })
                    }
                  />
                  <button
                    className="bg-green-600 text-white px-2 py-1 rounded"
                    onClick={() => handleAddAmount(goal)}
                  >
                    +
                  </button>
                  <button
                    className="text-red-500 text-sm mt-1"
                    onClick={() => deleteGoal(goal.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {(goal.saved || 0) >= goal.target && (
  <p className="mt-2 text-green-600 font-bold">✅ Completed!</p>
)}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default GoalsPage;
