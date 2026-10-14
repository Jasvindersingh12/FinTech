import React, { useEffect, useState } from "react";
import { PageHeader } from "../common";
import { authFetch } from "../../utils/api";

import { Pie, Bar } from "react-chartjs-2";

import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    BarElement,
} from "chart.js";

ChartJS.register(
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    BarElement
);

const AnalyticsPage = ({ activePage, refreshDashboard }) => {

    const [transactions, setTransactions] = useState([]);

    useEffect(() => {

        loadTransactions();

    }, [refreshDashboard]);

    async function loadTransactions() {

        try {

            const res = await authFetch("/api/transactions");

            const json = await res.json();

            if (json.status) {
                setTransactions(json.data);
            }

        } catch (err) {

            console.log(err);

        }

    }

    const normalizeCategory = (cat) => {

        if (!cat) return "Other";

        const c = cat.toLowerCase();

        if (c.includes("food")) return "Food & Dining";
        if (c.includes("drink")) return "Food & Dining";
        if (c.includes("groc")) return "Food & Dining";

        if (c.includes("transport")) return "Transportation";

        if (c.includes("entertain")) return "Entertainment";

        if (c.includes("house")) return "Housing";

        if (c.includes("utility")) return "Utilities";

        return cat;

    };

    const expenses = transactions.filter(
        t => t.type === "Expense"
    );

    const categoryTotals = {};

    expenses.forEach(t => {

        const cat = normalizeCategory(t.category);

        categoryTotals[cat] =
            (categoryTotals[cat] || 0) +
            Math.abs(t.amount);

    });

    const labels = Object.keys(categoryTotals);

    const values = Object.values(categoryTotals);

    return (

        <div
            id="analytics"
            className={`page ${activePage === "analytics" ? "block" : "hidden"} p-6`}
        >

            <PageHeader
                title="Financial Analytics"
                subtitle="See your spending patterns"
            />

            {labels.length === 0 ? (

                <div className="bg-white rounded-xl p-10 mt-6 text-center">

                    <h2 className="text-xl">
                        No Transactions Found
                    </h2>

                </div>

            ) : (

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">

                    <div className="bg-white rounded-xl shadow-xl p-6">

                        <h3 className="font-bold mb-4">
                            Spending Breakdown
                        </h3>

                        <Pie
                            data={{
                                labels,
                                datasets: [
                                    {
                                        data: values,
                                        backgroundColor: [
                                            "#34d399",
                                            "#60a5fa",
                                            "#f472b6",
                                            "#facc15",
                                            "#fb923c",
                                            "#c084fc",
                                        ],
                                    },
                                ],
                            }}
                        />

                    </div>

                    <div className="bg-white rounded-xl shadow-xl p-6">

                        <h3 className="font-bold mb-4">
                            Category Spending
                        </h3>

                        <Bar
                            data={{
                                labels,
                                datasets: [
                                    {
                                        label: "Amount (₹)",
                                        data: values,
                                        backgroundColor: [
                                        "#34d399",
                                        "#60a5fa",
                                        "#f472b6",
                                        "#facc15",
                                        "#fb923c",
                                        "#c084fc",
                                        "#ef4444",
                                        "#14b8a6",
                                        ],
                                        borderColor: [
                                        "#34d399",
                                        "#60a5fa",
                                        "#f472b6",
                                        "#facc15",
                                        "#fb923c",
                                        "#c084fc",
                                        "#ef4444",
                                        "#14b8a6",
                                        ],
                                        borderWidth: 1,
                                    },
                                    ]
                                                                }}
                            options={{
                                scales: {
                                    y: {
                                        beginAtZero: true,
                                    },
                                },
                            }}
                        />

                    </div>

                </div>

            )}

        </div>

    );

};

export default AnalyticsPage;