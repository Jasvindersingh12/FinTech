import React, { useEffect, useState } from 'react';
import { PageHeader, StatCard } from './common';
import { SpendingChart } from './SpendingChart';
import { supabase } from "../supabase";
import { authFetch } from "../utils/api";

export const DashboardPage = ({ activePage, refreshDashboard }) => {
    const [transactions, setTransactions] = useState([]);

    useEffect(() => {
        authFetch("/api/transactions")
            .then(res => res.json())
            .then(data => setTransactions(data.data || []))
            .catch(err => console.error("Dashboard fetch error:", err));
    }, [refreshDashboard]);

    async function handleDelete(id) {
        try {
            const res = await authFetch(`/api/transactions/${id}`, { method: "DELETE" });
            const result = await res.json();

            if (!res.ok) {
                alert(result.message || "Failed to delete");
                return;
            }

            setTransactions(prev => prev.filter(tx => tx.id !== id));
        } catch (err) {
            console.error("Delete error:", err);
            alert(`Something went wrong: ${err.message}`);
        }
    }

    async function handleLogout() {
        const { error } = await supabase.auth.signOut();
        if (error) return alert(error.message);
    }

    const totalBalance = transactions.reduce((sum, t) => sum + t.amount, 0);
    const income = transactions.filter(t => t.type === 'Income').reduce((s, t) => s + t.amount, 0);
    const expenses = transactions.filter(t => t.type === 'Expense').reduce((s, t) => s + Math.abs(t.amount), 0);
    const savingsRate = income ? ((income - expenses) / income) * 100 : 0;

    const recent = [...transactions].reverse().slice(0, 5);

    return (
        <div id="dashboard" className={`page ${activePage === "dashboard" ? "block animate-fade-in" : "hidden"}`}>

            <PageHeader title="Dashboard Overview" subtitle="Your financial summary at a glance">
                <button
                    onClick={handleLogout}
                    className="bg-white border border-red-200 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 transition font-medium text-sm"
                >
                    Logout
                </button>
            </PageHeader>

            <div className="p-6 space-y-8 bg-gray-50 min-h-screen">

                {/* Hero balance strip */}
                <div className="rounded-2xl p-8 text-white shadow-xl bg-gradient-to-r from-teal-500 via-cyan-600 to-indigo-600 relative overflow-hidden">
                    <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/10"></div>
                    <div className="absolute -right-4 top-16 w-24 h-24 rounded-full bg-white/10"></div>
                    <p className="text-white/80 text-sm font-medium uppercase tracking-wide">Total Balance</p>
                    <p className="text-5xl font-extrabold mt-2">₹{totalBalance.toFixed(2)}</p>
                    
                </div>

                {/* Stats Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                   
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

                    <div className="xl:col-span-2 bg-white rounded-2xl p-6 shadow-md border border-gray-100">
                        <h3 className="text-xl font-semibold mb-4 text-gray-800">Monthly Spending Overview</h3>
                        <div className="relative h-80">
                            {transactions.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                    <div className="text-4xl mb-2">📉</div>
                                    <p>No transactions yet — add one to see your spending trend.</p>
                                </div>
                            ) : (
                                <SpendingChart transactions={transactions} />
                            )}
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-semibold text-gray-800">Recent Activity</h3>
                        </div>

                        {recent.length === 0 ? (
                            <div className="text-center text-gray-400 py-10">
                                <div className="text-3xl mb-2">🧾</div>
                                <p>Nothing here yet.</p>
                            </div>
                        ) : (
                            <ul className="space-y-4">
                                {recent.map(tx => (
                                    <li key={tx.id} className="flex justify-between items-start border-b border-gray-100 pb-3 last:border-0">
                                        <div>
                                            <p className="font-medium text-gray-700">{tx.description}</p>
                                            <span className="text-sm text-gray-400">
                                                {tx.category} • {tx.date}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <span className={`font-semibold ${tx.type === "Income" ? "text-green-600" : "text-red-600"}`}>
                                                {tx.type === "Income" ? "+" : "-"}₹{Math.abs(tx.amount)}
                                            </span>
                                            <button
                                                onClick={() => handleDelete(tx.id)}
                                                className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-md hover:bg-red-100 transition"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                </div>

            </div>
        </div>
    );
};