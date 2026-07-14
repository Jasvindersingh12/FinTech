// common.js
import React from 'react';

// Reusable Component 1: StatCard
export const StatCard = ({ title, value, change, changeColor, icon, iconBgClass, valueColor }) => (
    <div className="bg-white rounded-xl p-6 shadow-xl card-hover transform transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
        <div className="flex items-center justify-between">
            <div>
                <p className="text-gray-600 text-sm font-medium">{title}</p>
                <p className={`text-3xl font-bold ${valueColor}`}>{value}</p>
                <p className={`text-sm ${changeColor} mt-1`}>{change}</p>
            </div>
            <div className={`${iconBgClass} p-4 rounded-full shadow-lg`}>
                <span className="text-2xl">{icon}</span>
            </div>
        </div>
    </div>
);
// Reusable Component 2: PageHeader
export const PageHeader = ({ title, subtitle, children }) => (
    <header className="bg-white shadow-sm p-6 border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center justify-between">
            <div>
                <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
                <p className="text-gray-600">{subtitle}</p>
            </div>
            {children}
        </div>
    </header>
);
// : NavItem for Sidebar
export const NavItem = ({ icon, label, pageId, activePage, setActivePage, onClick }) => {
  const isActive = activePage === pageId;
  const activeClass = isActive
    ? "bg-slate-700 border-l-4 border-cyan-400 shadow-lg"
    : "hover:bg-slate-800 hover:transform hover:translate-x-1";

  return (
    <div
      className={`nav-item p-3 rounded-lg cursor-pointer transition-all duration-300 ${activeClass}`}
      onClick={() => {
        setActivePage(pageId);
        if (onClick) onClick();   // 🔥 trigger refresh when navigating
      }}
      role="button"
      tabIndex={0}
      onKeyPress={e => {
        if (e.key === "Enter") {
          setActivePage(pageId);
          if (onClick) onClick(); // also refresh on enter key
        }
      }}
    >
      <div className="flex items-center space-x-3">
        <span className="text-xl">{icon}</span>
        <span className="font-medium">{label}</span>
      </div>
    </div>
  );
};

