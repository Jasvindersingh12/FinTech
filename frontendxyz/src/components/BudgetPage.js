import React, { useEffect, useState } from "react";

export const BudgetPage = ({ refreshDashboard }) => {
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);

  const normalizeCategory = (category) => {
    const c = category.toLowerCase();
    if (c.includes("food") || c.includes("grocer") || c === "drink") return "Food & Dining";
    if (c.includes("entertain")) return "Entertainment";
    if (c.includes("transport")) return "Transportation";
    if (c.includes("hous")) return "Housing";
    if (c.includes("util")) return "Utilities";
    return category;
  };

  // Fetch transactions when refresh is triggered
  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/transactions")
      .then(res => res.json())
      .then(data => setTransactions(data.data || []))
      .catch(err => console.error("Transaction fetch error:", err));
  }, [refreshDashboard]); // ✅ now listens for refresh

  // Fetch budgets when refresh is triggered
  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/budgets")
      .then(res => res.json())
      .then(data => setBudgets(data.data || []))
      .catch(err => console.error("Budget fetch error:", err));
  }, [refreshDashboard]); // ✅ also listens for refresh

  // Compute spent per category when transactions change
  const spentByCategory = {};
  transactions.forEach(tx => {
    if (tx.type === "Expense") {
      const norm = normalizeCategory(tx.category);
      spentByCategory[norm] = (spentByCategory[norm] || 0) + Math.abs(tx.amount);
    }
  });

  // Update backend budgets only when refreshDashboard changes (not budgets change!)
  useEffect(() => {
    if (budgets.length === 0) return;

    const updated = budgets.map(b => {
      const s = spentByCategory[b.category] || 0;
      return {
        ...b,
        spent: s,
        percentage: b.limit ? Math.round((s / b.limit) * 100) : 0
      };
    });

    fetch("http://127.0.0.1:8000/api/budgets/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated)
    }).catch(err => console.error("Budget update failed:", err));

    setBudgets(updated);
  }, [refreshDashboard]); // ✅ only runs when refresh toggles

   const editLimit = async (category) => {
    const newLimit = Number(prompt(`Enter new monthly limit for ${category}:`));
    if (!newLimit || newLimit <= 0 || isNaN(newLimit)) return alert("Invalid limit");

    const updatedBudgets = budgets.map(b =>
      b.category === category ? { ...b, limit: newLimit, percentage: Math.round((b.spent / newLimit) * 100) } : b
    );

    setBudgets(updatedBudgets);

    // Send update to backend
    try {
      await fetch("http://127.0.0.1:8000/api/budgets/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedBudgets)
      });
    } catch (err) {
      console.error("Failed to update budget limit:", err);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Budget Planner</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {budgets.map(b => {
          const pct = b.percentage || 0;
          const bar = Math.min(pct, 100);
          const color = pct > 100 ? "bg-red-600" : "bg-teal-600";

          return (
            <div key={b.category} className="bg-white p-5 rounded-xl shadow-lg">
              <h2 className="text-lg font-semibold">{b.category}</h2>
              <p className="text-gray-700">Spent: ₹{b.spent}</p>
              <p className="text-gray-500">Limit: ₹{b.limit}</p>

              <div className="w-full h-3 bg-gray-300 rounded-full mt-3">
                <div
                  className={`h-3 ${color} rounded-full`}
                  style={{ width: `${bar}%` }}
                ></div>
              </div>

               {pct > 100 && (
                <p className="text-red-600 mt-1 font-semibold">
                  ⚠️ Over budget by ₹{b.spent - b.limit}!
                </p>
              )}

              {/* Edit Limit Button */}
              <button
                onClick={() => editLimit(b.category)}
                className="mt-3 px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
              >
                Edit Limit
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
