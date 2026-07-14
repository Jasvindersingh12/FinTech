// SettingsPage.js
import React from "react";
import { PageHeader } from "../common";

const SettingsPage = ({ activePage, userName, setUserName }) => {
    return (
        <div
            id="settings"
            className={`page ${activePage === "settings" ? "block" : "hidden"} p-6`}
        >
            <PageHeader title="Settings" subtitle="Customize your FinanceFlow experience" />

            <div className="bg-white p-6 rounded-xl shadow-xl space-y-6 mt-6">

                {/* USER NAME SETTING */}
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
