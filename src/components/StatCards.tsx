import React from 'react';

interface StatCardsProps {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
}

const StatCards: React.FC<StatCardsProps> = ({ totalIncome, totalExpenses, balance }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white rounded-xl shadow-md p-6 card">
        <div className="flex items-center">
          <div className="p-3 bg-green-100 rounded-lg mr-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-gray-500 text-sm">Total Income</p>
            <p className="text-2xl font-bold text-gray-800">${totalIncome.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6 card">
        <div className="flex items-center">
          <div className="p-3 bg-red-100 rounded-lg mr-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-gray-500 text-sm">Total Expenses</p>
            <p className="text-2xl font-bold text-gray-800">${totalExpenses.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6 card">
        <div className="flex items-center">
          <div className={`p-3 rounded-lg mr-4 ${balance >= 0 ? 'bg-blue-100' : 'bg-yellow-100'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${balance >= 0 ? 'text-blue-600' : 'text-yellow-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-gray-500 text-sm">Balance</p>
            <p className={`text-2xl font-bold ${balance >= 0 ? 'text-blue-600' : 'text-yellow-600'}`}>
              ${balance.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatCards;