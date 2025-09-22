// components/CustomAlert.js
import { useEffect } from 'react';

export default function CustomAlert({ type = 'info', message, onClose, duration = 4000 }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  const colors = {
    info: 'bg-blue-100 text-blue-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
  };

  return (
    <div className={`fixed top-5 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded shadow-lg flex items-center space-x-3 animate-fadeIn ${colors[type]}`}>
      <span className="font-semibold">{type.toUpperCase()}:</span>
      <span>{message}</span>
      <button onClick={onClose} className="ml-auto font-bold hover:text-gray-700">&times;</button>
      <style jsx>{`
        @keyframes fadeIn {
          from {opacity: 0; transform: translate(-50%, -10px);}
          to {opacity: 1; transform: translate(-50%, 0);}
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease forwards;
        }
      `}</style>
    </div>
  );
}
