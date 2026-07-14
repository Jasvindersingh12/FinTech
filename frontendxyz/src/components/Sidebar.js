import { NavItem } from './common';
import React from 'react';
import { supabase } from '../supabase';

export const Sidebar = ({ activePage, setActivePage, onNavbarNavigate, userName, appName }) => {

    const initials = userName
        .split(" ")
        .map(w => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
 async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) return alert(error.message); 
    // Redirect to login page after logout
    window.location.href = "/auth"; 
  }
    return (
        <div className="fixed left-0 top-0 h-full w-64 bg-slate-900 text-white shadow-2xl z-50">
            <div className="p-6">
                <div className="flex items-center space-x-3 mb-8">
                    <div className="bg-gradient-to-br from-cyan-400 to-teal-500 p-3 rounded-xl shadow-lg border border-white border-opacity-20">
                        <span className="text-2xl">Jaz</span>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">{appName}</h1>
                        <p className="text-sm text-cyan-400">Smart buddy assistant </p>
                    </div>
                </div>

                <nav className="space-y-2">
                    <NavItem icon="📊" label="Dashboard" pageId="dashboard" activePage={activePage} setActivePage={setActivePage} onClick={onNavbarNavigate} />
                    <NavItem icon="💳" label="Transactions" pageId="transactions" activePage={activePage} setActivePage={setActivePage} onClick={onNavbarNavigate} />
                    <NavItem icon="🎯" label="Budget Planner" pageId="budget" activePage={activePage} setActivePage={setActivePage} onClick={onNavbarNavigate}/>
                    <NavItem icon="🏆" label="Financial Goals" pageId="goals" activePage={activePage} setActivePage={setActivePage} onClick={onNavbarNavigate}/>
                    <NavItem icon="📈" label="Analytics" pageId="analytics" activePage={activePage} setActivePage={setActivePage} onClick={onNavbarNavigate}/>
                    <NavItem icon="⚙️" label="Settings" pageId="settings" activePage={activePage} setActivePage={setActivePage} onClick={onNavbarNavigate}/>
                    <NavItem icon="💬" label="Assistant" pageId="assistant" activePage={activePage} setActivePage={setActivePage} onClick={onNavbarNavigate}/>
                     <button
                    onClick={handleLogout}
    className="text-white px-4 py-2 rounded-lg hover:bg-pink-700 transition"
  >
         Logout
  </button>
                </nav>
            </div>

            {/* BOTTOM USER INFO */}
            <div className="absolute bottom-6 left-6 right-6">
                <div className="bg-white bg-opacity-10 p-4 rounded-xl border border-white border-opacity-20 backdrop-blur-sm">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-teal-500 rounded-full flex items-center justify-center shadow-lg">
                            <span className="text-sm font-bold text-white">
                                {initials}
                                    
                            </span>
                       
                        </div>
                        <div>
                            <p className="font-medium text-white">{userName}</p>
                            <p className="text-xs text-cyan-200">Premium Member</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
