import React from "react";
import { PageHeader } from "../common";
import { supabase } from "../../supabase";

const SettingsPage = ({ activePage, userName, setUserName }) => {
    async function handleLogout() {
        const { error } = await supabase.auth.signOut();
        if (error) return alert(error.message);
    }

    return (
        <div
            id="settings"
            className={`page ${activePage === "settings" ? "block" : "hidden"} p-6`}
        >
            <PageHeader title="Settings" subtitle="Customize your FinanceFlow experience">
                <button
                    onClick={handleLogout}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
                >
                    Logout
                </button>
            </PageHeader>

            <div className="bg-white p-6 rounded-xl shadow-xl space-y-6 mt-6">
                <div>
                    <h3 className="font-semibold text-gray-800">Your Name</h3>
                    <input
                        type="text"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        className="mt-2 p-3 border rounded-lg w-full bg-gray-50"
                        placeholder="Enter your name"
                    />
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;