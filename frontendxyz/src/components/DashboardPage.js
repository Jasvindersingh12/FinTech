import React, { useEffect, useState } from 'react';
import { PageHeader, StatCard } from './common';
import { SpendingChart } from './SpendingChart';
import { supabase } from "../supabase";

export const DashboardPage = ({ activePage,refreshDashboard }) => {
    const [transactions, setTransactions] = useState([]);

   useEffect(() => {
    fetch("http://127.0.0.1:8000/api/transactions")
        .then(res => res.json())
        .then(data => setTransactions(data.data || []))
        .catch(err => console.error("Dashboard fetch error:", err));
}, [refreshDashboard]);
    async function handleDelete(id) {
    try {
        const res = await fetch(`http://127.0.0.1:8000/api/transactions/${id}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" }
        });

        const result = await res.json();

        if (!res.ok) {
            alert(result.message || "Failed to delete");
            return;
        }

        // ✅ Remove deleted transaction from UI
        setTransactions(prev => prev.filter(tx => tx.id !== id));

        alert("Transaction deleted!");
    } catch (err) {
        console.error("Delete error:", err);
        alert("Something went wrong");
    }
}

    async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) return alert(error.message);
    // Redirect to login page after logout
    window.location.href = "/auth"; 
  }
    // Calculations
    const totalBalance = transactions.reduce((sum, t) => sum + t.amount, 0);
    const income = transactions.filter(t => t.type === 'Income').reduce((s, t) => s + t.amount, 0);
    const expenses = transactions.filter(t => t.type === 'Expense').reduce((s, t) => s + Math.abs(t.amount), 0);
    const savingsRate = income ? ((income - expenses) / income) * 100 : 0;

    // Recent transactions (latest 5)
    const recent = [...transactions].reverse().slice(0, 5);

    return (
        <div id="dashboard" className={`page ${activePage === "dashboard" ? "block animate-fade-in" : "hidden"}`}>
            

           <PageHeader title="Dashboard Overview" subtitle="Your financial summary">
  <button
    onClick={handleLogout}
    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
  >
    Logout
  </button>
</PageHeader>
            <div className="p-6 space-y-8">

                {/* Stats Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                    <StatCard
                        title="Total Balance"
                        value={`₹${totalBalance.toFixed(2)}`}
                        icon="💰"
                        valueColor="text-teal-600"
                        iconBgClass="bg-gradient-to-tr from-teal-400 to-cyan-500 text-white"
                    />

                    <StatCard
                        title="Monthly Income"
                        value={`₹${income.toFixed(2)}`}
                        icon="📈"
                        valueColor="text-indigo-600"
                        iconBgClass="bg-indigo-100 text-indigo-600"
                    />

                    <StatCard
                        title="Monthly Expenses"
                        value={`₹${expenses.toFixed(2)}`}
                        icon="🔥"
                        valueColor="text-red-600"
                        iconBgClass="bg-red-100 text-red-600"
                    />

                    <StatCard
                        title="Savings Rate"
                        value={`${savingsRate.toFixed(1)}%`}
                        icon="🎯"
                        valueColor="text-purple-600"
                        iconBgClass="bg-purple-100 text-purple-600"
                    />
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                    <div className="xl:col-span-2 bg-white rounded-xl p-6 shadow-xl">
                        <h3 className="text-xl font-semibold mb-4 text-gray-800">Monthly Spending Overview</h3>
                        <div className="relative h-80">
                            <SpendingChart transactions={transactions} />
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-6 shadow-xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-semibold text-gray-800">Recent Activity</h3>

                           
                        </div>

                        <ul className="space-y-4">
                            {recent.map(tx => (
                                <li key={tx.id} className="flex justify-between items-start border-b pb-3">
                                    <div>
                                        <p className="font-medium text-gray-700">{tx.desc}</p>
                                        <span className="text-sm text-gray-500">
                                            {tx.category} • {tx.date}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-3">
            <span className={`font-semibold ${tx.type === "Income" ? "text-green-600" : "text-red-600"}`}>
                {tx.type === "Income" ? "+" : "-"}₹{Math.abs(tx.amount)}
            </span>

            {/* ✅ DELETE BUTTON */}
            <button
                onClick={() => handleDelete(tx.id)}
                className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-700 transition"
            >
                Delete
            </button>
        </div>
                                </li>
                            ))}
                        </ul>
                    </div>

                </div>

            </div>
        </div>
    );
};
