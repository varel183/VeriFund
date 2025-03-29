import React from "react";
import { useEffect } from "react";

export default function Alert({ type = "info", message, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === "error" ? "bg-red-200 text-red-800" : type === "success" ? "bg-green-400 text-green-800" : "bg-blue-200 text-blue-800";

  return <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg text-lg font-semibold z-50 ${bgColor}`}>{message}</div>;
}
