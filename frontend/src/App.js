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
  // undefined = still checking session, null = logged out, object = logged in
  const [session, setSession] = useState(undefined);
  const [activePage, setActivePage] = useState("dashboard");
  const [userName, setUserName] = useState("Demo User");
  const [isListening, setIsListening] = useState(false);
  const [refreshDashboard, setRefreshDashboard] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Clean up /auth URL if left in history from old logout
    if (window.location.pathname === "/auth") {
      window.history.replaceState(null, "", "/");
    }

    const extractUserName = (sess) => {
      if (!sess?.user) return "User";
      const metaName = sess.user.user_metadata?.name;
      if (metaName && metaName.trim()) return metaName.trim();
      if (sess.user.email) return sess.user.email.split("@")[0];
      return "User";
    };

    // Fallback: If session check hangs or fails, fall back to logged-out state after 2 seconds
    const timer = setTimeout(() => {
      if (mounted) {
        setSession((prev) => (prev === undefined ? null : prev));
      }
    }, 2000);

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return;
        clearTimeout(timer);
        if (error) {
          console.error("Supabase getSession error:", error);
          setSession(null);
        } else {
          const sess = data?.session || null;
          setSession(sess);
          if (sess) {
            setUserName(extractUserName(sess));
          }
        }
      })
      .catch((err) => {
        if (!mounted) return;
        clearTimeout(timer);
        console.error("Supabase auth error:", err);
        setSession(null);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (mounted) {
        setSession(sess || null);
        if (sess) {
          setUserName(extractUserName(sess));
        }
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timer);
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const triggerRefresh = () => {
    setRefreshDashboard((prev) => !prev);
  };

  // Still checking whether a session exists — avoid a flash of the login page
  if (session === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500">
        Loading...
      </div>
    );
  }

  // Not logged in — show sign in / sign up
  if (!session) {
    return <AuthPage />;
  }

  // Logged in — show the app
  return (
    <div className="flex bg-gray-100 min-h-screen">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        userName={userName}
        onNavbarNavigate={triggerRefresh}
      />

      <div className="ml-64 flex-1">
        <DashboardPage
          activePage={activePage}
          refreshDashboard={refreshDashboard}
        />

        <TransactionsPage
          activePage={activePage}
          refreshDashboard={refreshDashboard}
          onTransactionAdded={triggerRefresh}
        />

        <div className={activePage === "budget" ? "block" : "hidden"}>
          <BudgetPage />
        </div>

        <GoalsPage
          activePage={activePage}
          onGoalAdded={triggerRefresh}
        />

        <AnalyticsPage activePage={activePage} />

        <SettingsPage
          activePage={activePage}
          userName={userName}
          setUserName={setUserName}
        />

        <AssistantPage
          activePage={activePage}
          isListening={isListening}
          startListening={() => setIsListening(true)}
          stopListening={() => setIsListening(false)}
          IdleImage={IdleRobot}
          ListeningImage={ListeningRobot}
          onFinanceAction={triggerRefresh}
        />
      </div>
    </div>
  );
}
