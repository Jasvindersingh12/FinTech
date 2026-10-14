import React, { useEffect, useState } from "react";
import { PageHeader } from "../common";
import { authFetch } from "../../utils/api";

export const GoalsPage = ({ activePage, refreshDashboard, onGoalAdded }) => {
  const [goals, setGoals] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [goalName, setGoalName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [addAmount, setAddAmount] = useState({});

  useEffect(() => {
    authFetch("/api/goals")
      .then(res => res.json())
      .then(json => {
        if (json.status) setGoals(json.data);
      })
      .catch(err => console.error("Failed to load goals", err));
  }, [refreshDashboard]);

  const addGoal = async () => {
    if (!goalName || !targetAmount) return;

    // NOTE: backend columns are "name" and "due_date", not "goal"/"dueDate"
    const newGoal = { name: goalName, target: Number(targetAmount), saved: 0, due_date: null };

    try {
      const res = await authFetch("/api/goals", {
        method: "POST",
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

  const deleteGoal = async (id) => {
    try {
      const res = await authFetch(`/api/goals/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.status) setGoals(goals.filter(g => g.id !== id));
    } catch (err) {
      console.error("Error deleting goal", err);
    }
  };

  const handleAddAmount = async (goal) => {

    const amount = parseFloat(addAmount[goal.id]);

    if (!amount || amount <= 0) {
        return alert("Enter valid amount");
    }

    try {

        // Save expense
        await authFetch("/api/transactions", {
            method: "POST",
            body: JSON.stringify({
                description: `Goal Saving - ${goal.name}`,
                category: goal.name,
                amount: -amount,
                type: "Expense",
                date: new Date().toISOString().split("T")[0],
            }),
        });

        // Update goal saved value in database
        const res = await authFetch(`/api/goals/${goal.id}/add`, {

            method: "PATCH",

            body: JSON.stringify({
                amount: amount,
            }),

        });

        const json = await res.json();

        if (json.status) {

            setGoals(prev =>
                prev.map(g =>
                    g.id === goal.id
                        ? json.data
                        : g
                )
            );

        }

        setAddAmount({
            ...addAmount,
            [goal.id]: "",
        });

        onGoalAdded();

    } catch (err) {

        console.log(err);

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
                  <h3 className="text-lg font-semibold">{goal.name}</h3>
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