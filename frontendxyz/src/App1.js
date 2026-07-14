import React, { useState, useEffect } from "react";
import { supabase } from "./supabase";

import AuthPage from "./components/AuthPage";
import { Sidebar } from "./components/Sidebar";
import { DashboardPage } from "./components/DashboardPage";
import { TransactionsPage } from "./components/TransactionsPage";
import GoalsPage from "./components/pages/GoalsPage";
import AnalyticsPage from "./components/pages/AnalyticsPage";
import SettingsPage from "./components/pages/SettingsPage";
import { BudgetPage } from "./components/BudgetPage";
import AssistantPage from "./components/AssistantPage";

import IdleRobot from "./assets/wait.png";
import ListeningRobot from "./assets/listen.png";

export default function App() {
  const [user, setUser] = useState(null);
  const [activePage, setActivePage] = useState("dashboard");
  const [userName, setUserName] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshDashboard, setRefreshDashboard] = useState(false);

  // ✅ Refresh function for everywhere
  const triggerRefresh = () => setRefreshDashboard(prev => !prev);

  // Load session from Supabase
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setUserName(data.session?.user?.email || "");
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setUserName(session?.user?.email || "");
      setLoading(false);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  if (loading)
    return (
      <div className="flex items-center justify-center h-screen text-lg">
        Loading...
      </div>
    );

  if (!user) return <AuthPage />;

  return (
    <div className="flex bg-gray-100 min-h-screen">

      {/* ✅ Send refresh trigger to Sidebar */}
      <Sidebar
  activePage={activePage}
  setActivePage={setActivePage}
  userName={userName}
  onNavbarNavigate={triggerRefresh} // ✅ sending refresh callback
/>

      <div className="ml-64 flex-1">

        {/* Dashboard listens for refresh */}
        <DashboardPage
          activePage={activePage}
          refreshDashboard={refreshDashboard}
        />

        {/* Transactions listens for refresh */}
        <TransactionsPage
          activePage={activePage}
          refreshDashboard={refreshDashboard}
          onTransactionAdded={triggerRefresh} // ← refresh for buttons too ✅
        />

        {/* Budget page toggle */}
        <div className={activePage === "budget" ? "block" : "hidden"}>
          <BudgetPage />
        </div>

        <GoalsPage activePage={activePage} onGoalAdded={triggerRefresh}/>
        <AnalyticsPage activePage={activePage} />

        <SettingsPage
          activePage={activePage}
          userName={userName}
          setUserName={setUserName}
        />

        {/* Assistant refresh trigger */}
        <AssistantPage
          activePage={activePage}
          isListening={isListening}
          startListening={() => setIsListening(true)}
          stopListening={() => setIsListening(false)}
          IdleImage={IdleRobot}
          ListeningImage={ListeningRobot}
          onFinanceAction={triggerRefresh} // ← already correct ✅
        />
      </div>
    </div>
  );
}
