import React, { useEffect, useState } from "react";
import { PageHeader } from "./common";
import { supabase } from "../supabase";
import { authFetch } from "../utils/api";

export const TransactionsPage = ({ activePage, onTransactionAdded, refreshDashboard }) => {
  const [transactions, setTransactions] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);

  const [date, setDate] = useState("");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("Expense");

  const generalCategories = [
    "Food & Dining",
    "Entertainment",
    "Transportation",
    "Housing",
    "Utilities"
  ];
  const [selectedCategory, setSelectedCategory] = useState("Food & Dining");
  const [customCategory, setCustomCategory] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) return alert(error.message);
    // No redirect needed — App1's onAuthStateChange listener shows AuthPage automatically.
  }

  const fetchTransactions = async () => {
    try {
      const res = await authFetch("/api/transactions");
      const data = await res.json();
      setTransactions(data.data || []);
    } catch (err) {
      console.error("Transactions fetch error:", err);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [refreshDashboard]);

  const handleAddOrUpdate = async () => {
    const payload = {
      date,
      description: desc,
      category: useCustom ? customCategory : selectedCategory,
      amount: parseFloat(amount),
      type,
    };

    try {
      if (editId) {
        const res = await authFetch(`/api/transactions/${editId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });

        const result = await res.json();
        if (!res.ok || !result.status) {
          alert(result.message || "Failed to update");
          return;
        }

        setTransactions(prev =>
          prev.map(tx => (tx.id === editId ? { ...tx, ...payload } : tx))
        );

        alert("Transaction updated!");
        setEditId(null);
      } else {
        const res = await authFetch("/api/transactions", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        const result = await res.json();
        if (!res.ok || !result.status) {
          alert(result.message || "Failed to add");
          return;
        }

        alert("Transaction added!");
      }

      if (onTransactionAdded) onTransactionAdded();
      resetForm();
      fetchTransactions();
      setShowModal(false);
    } catch (err) {
      console.error("Save error:", err);
    }
  };

  async function handleDelete(id) {
    try {
      const res = await authFetch(`/api/transactions/${id}`, {
        method: "DELETE",
      });

      const result = await res.json();

      if (!res.ok || !result.status) {
        alert(result.message || "Failed to delete");
        return;
      }
      if (onTransactionAdded) onTransactionAdded();
      setTransactions(prev => prev.filter(tx => tx.id !== id));
      alert("Transaction deleted!");

    } catch (err) {
      console.error("Delete error:", err);
      alert("Something went wrong");
    }
  }

  function openEdit(tx) {
    setEditId(tx.id);
    setDate(tx.date);
    setDesc(tx.description);
    setAmount(tx.amount);
    setType(tx.type);

    if (generalCategories.includes(tx.category)) {
      setUseCustom(false);
      setSelectedCategory(tx.category);
      setCustomCategory("");
    } else {
      setUseCustom(true);
      setCustomCategory(tx.category);
      setSelectedCategory("");
    }

    setShowModal(true);
  }

  function resetForm() {
    setDate("");
    setDesc("");
    setAmount("");
    setType("Expense");
    setSelectedCategory("Food & Dining");
    setCustomCategory("");
    setUseCustom(false);
    setEditId(null);
  }

  return (
    <div className={`page ${activePage === "transactions" ? "block animate-fade-in" : "hidden"}`}>
      <PageHeader title="Transactions" subtitle="Your complete history">
        <button
          onClick={handleLogout}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
        >
          Logout
        </button>
      </PageHeader>

      <div className="p-6">
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="mb-4 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-lg transition"
        >
          + Add Transaction
        </button>

        <table className="w-full bg-white shadow-xl rounded-xl">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="p-4">Date</th>
              <th className="p-4">Description</th>
              <th className="p-4">Category</th>
              <th className="p-4">Amount</th>
              <th className="p-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(tx => (
              <tr key={tx.id} className="border-b">
                <td className="p-4">{tx.date}</td>
                <td className="p-4">{tx.description}</td>
                <td className="p-4">{tx.category}</td>
                <td className={`p-4 font-semibold ${tx.type === "Income" ? "text-green-600" : "text-red-600"}`}>
                  ₹{tx.amount}
                </td>
                <td className="p-4 space-x-3">
                  <button
                    onClick={() => openEdit(tx)}
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(tx.id)}
                    className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="bg-white w-96 p-6 rounded-xl shadow-xl">
            <h2 className="text-xl font-semibold mb-4">{editId ? "Edit Transaction" : "Add New Transaction"}</h2>

            <div className="space-y-3">
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full p-2 border rounded"
              />
              <input
                placeholder="Description"
                value={desc}
                onChange={e => setDesc(e.target.value)}
                className="w-full p-2 border rounded"
              />

              <select
                value={useCustom ? "Other" : selectedCategory}
                onChange={(e) => {
                  if (e.target.value === "Other") {
                    setUseCustom(true);
                    setSelectedCategory("");
                  } else {
                    setUseCustom(false);
                    setSelectedCategory(e.target.value);
                    setCustomCategory("");
                  }
                }}
                className="w-full p-2 border rounded"
              >
                {generalCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
                <option value="Other">Other</option>
              </select>

              {useCustom && (
                <input
                  placeholder="Enter category manually"
                  value={customCategory}
                  onChange={e => setCustomCategory(e.target.value)}
                  className="w-full p-2 border rounded"
                />
              )}

              <input
                type="number"
                placeholder="Amount"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full p-2 border rounded"
              />

              <select
                value={type}
                onChange={e => setType(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="Income">Income</option>
                <option value="Expense">Expense</option>
              </select>
            </div>

            <div className="flex justify-end mt-4 space-x-3">
              <button onClick={() => { resetForm(); setShowModal(false); }} className="px-4 py-2 bg-gray-300 rounded-lg">Cancel</button>
              <button onClick={handleAddOrUpdate} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};