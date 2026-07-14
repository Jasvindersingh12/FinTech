// AnalyticsPage.js
import React, { useEffect, useState } from "react";
import { PageHeader } from "../common";
import { Pie, Bar } from "react-chartjs-2";
import {
    Chart as ChartJS,
    ArcElement, Tooltip, Legend,
    CategoryScale, LinearScale, BarElement
} from "chart.js";

ChartJS.register(
    ArcElement, Tooltip, Legend,
    CategoryScale, LinearScale, BarElement
);

const AnalyticsPage = ({ activePage }) => {
    const [transactions, setTransactions] = useState([]);

    useEffect(() => {
        fetch("http://127.0.0.1:8000/api/transactions")
            .then(res => res.json())
            .then(data => setTransactions(data.data || []))
            .catch(err => console.error("Analytics fetch error:", err));
    }, []);

    const normalizeCategory = (cat) => {
        if (!cat) return "Other";
        const c = cat.toLowerCase();

        if (c.includes("food") || c.includes("drink") || c.includes("groc")) return "Food & Dining";
        if (c.includes("entertain")) return "Entertainment";
        if (c.includes("transport")) return "Transportation";
        if (c.includes("house")) return "Housing";
        if (c.includes("utility")) return "Utilities";
        return cat;
    };

    const expenses = transactions.filter(t => t.type === "Expense");

    const categoryTotals = expenses.reduce((acc, t) => {
        const cat = normalizeCategory(t.category);
        acc[cat] = (acc[cat] || 0) + Math.abs(t.amount);
        return acc;
    }, {});

    const labels = Object.keys(categoryTotals);
    const values = Object.values(categoryTotals);

    return (
        <div id="analytics" className={`page ${activePage === "analytics" ? "block" : "hidden"} p-6`}>
            <PageHeader title="Financial Analytics" subtitle="See your spending patterns" />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">

                <div className="bg-white p-6 rounded-xl shadow-xl">
                    <h3 className="text-lg font-semibold mb-4">Spending Breakdown</h3>
                    <Pie data={{
                        labels,
                        datasets: [{
                            data: values,
                            backgroundColor: ["#34d399", "#60a5fa", "#f472b6", "#facc15", "#fb923c", "#c084fc"],
                        }],
                    }} />
                </div>

                <div className="bg-white p-6 rounded-xl shadow-xl">
                    <h3 className="text-lg font-semibold mb-4">Category-wise Spending</h3>
                    <Bar
                        data={{
                            labels,
                            datasets: [{
                                label: "Amount (₹)",
                                data: values,
                                backgroundColor: "#6366f1",
                            }]
                        }}
                        options={{ scales: { y: { beginAtZero: true } } }}
                    />
                </div>
            </div>
        </div>
    );
};

export default AnalyticsPage;
