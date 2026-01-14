import React, { useMemo, useState } from 'react';
import { User, Phone, Calendar, CheckCircle, Search, ChevronRight, ArrowLeft, History, Filter, AlertCircle } from 'lucide-react';
import { Sale } from '../types';
import { db } from '../services/db';

interface CreditViewProps {
  sales: Sale[];
  onUpdate: () => void;
}

export const CreditView: React.FC<CreditViewProps> = ({ sales, onUpdate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<{name: string, contact: string} | null>(null);
  const [showSettled, setShowSettled] = useState(false);

  const customers = useMemo(() => {
    const customerMap = new Map();
    sales.forEach(sale => {
      // Include any sale that is currently 'Credit' or was previously marked as pending
      if (sale.paymentMethod === 'Credit' || sale.paymentStatus === 'Pending') {
        const key = `${sale.customerName}-${sale.customerContact || 'nocontact'}`;
        if (!customerMap.has(key)) {
          customerMap.set(key, {
            name: sale.customerName,
            contact: sale.customerContact || '',
            totalCredit: 0,
            totalPaid: 0,
            lastDate: sale.date
          });
        }
        const c = customerMap.get(key);
        c.totalCredit += sale.total;
        if (sale.paymentStatus === 'Paid') {
          c.totalPaid += sale.total;
        }
        if (new Date(sale.date) > new Date(c.lastDate)) c.lastDate = sale.date;
      }
    });

    return Array.from(customerMap.values())
      .map(c => ({...c, outstanding: c.totalCredit - c.totalPaid}))
      .filter(c => showSettled || c.outstanding > 0.01)
      .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.contact.includes(searchTerm))
      .sort((a, b) => b.outstanding - a.outstanding);
  }, [sales, searchTerm, showSettled]);

  const customerHistory = useMemo(() => {
    if (!selectedCustomer) return [];
    return sales
      .filter(s => 
        s.customerName === selectedCustomer.name && 
        (s.customerContact || '') === selectedCustomer.contact &&
        (s.paymentMethod === 'Credit' || s.paymentStatus === 'Pending' || s.paymentMethod === 'Cash') // Cash might be settled ones
      )
      .filter(s => {
          // If it's Cash/Paid, only show if it was originally a Credit (this is complex in current structure)
          // For now, let's show all for selected customer
          return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sales, selectedCustomer]);

  const handleSettle = async (sale: Sale) => {
    if (window.confirm(`Mark Bill #${sale.id.slice(-6)} as Settled?`)) {
      await db.updateSale({ 
        ...sale, 
        paymentStatus: 'Paid',
        paymentMethod: 'Cash' // Convert to cash upon settlement
      });
      onUpdate();
    }
  };

  if (!selectedCustomer) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Credit Ledger</h2>
              <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">Receivables & Debt Management</p>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => setShowSettled(!showSettled)} 
              className={`px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border-2 transition-all ${
                showSettled ? 'bg-slate-900 border-slate-900 text-white shadow-xl' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
              }`}
            >
                {showSettled ? 'Showing All' : 'Pending Only'}
            </button>
            <div className="bg-red-600 px-6 py-3 rounded-2xl text-white shadow-lg shadow-red-200">
                <p className="text-[10px] font-black uppercase opacity-80 tracking-widest">Total Outstanding</p>
                <p className="text-2xl font-black tracking-tighter">Rs.{customers.reduce((acc, c) => acc + c.outstanding, 0).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 bg-slate-50/50 border-b border-slate-100">
              <div className="relative max-w-md">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input 
                    type="text" 
                    placeholder="Search by client name..." 
                    className="w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-100 rounded-2xl focus:border-cyan-500 outline-none font-bold text-sm transition-all" 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                  />
              </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b">
                  <th className="px-8 py-6">Customer Profile</th>
                  <th className="px-8 py-6">Last Activity</th>
                  <th className="px-8 py-6 text-right">Balance Due</th>
                  <th className="px-8 py-6 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-20 text-center">
                      <div className="flex flex-col items-center opacity-20">
                        <CheckCircle size={64} />
                        <p className="mt-4 font-black uppercase tracking-widest">Clean Slate - No Debts</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                    customers.map((c, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => setSelectedCustomer({name: c.name, contact: c.contact})}>
                      <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-cyan-100 text-cyan-700 flex items-center justify-center font-black text-lg">
                                {c.name.charAt(0)}
                            </div>
                            <div>
                                <p className="font-black text-slate-900 uppercase text-lg tracking-tight leading-none">{c.name}</p>
                                <p className="text-xs font-bold text-slate-400 mt-1">{c.contact || 'No Contact'}</p>
                            </div>
                          </div>
                      </td>
                      <td className="px-8 py-6 text-slate-500 font-bold">{new Date(c.lastDate).toLocaleDateString()}</td>
                      <td className="px-8 py-6 text-right">
                          <span className={`font-black text-2xl tracking-tighter ${c.outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            Rs.{c.outstanding.toLocaleString()}
                          </span>
                      </td>
                      <td className="px-8 py-6 text-center">
                          <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-cyan-600 group-hover:text-white flex items-center justify-center transition-all mx-auto">
                            <ChevronRight size={20} />
                          </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
       <div className="flex items-center gap-4">
          <button onClick={() => setSelectedCustomer(null)} className="p-3 bg-white rounded-2xl border border-slate-200 hover:bg-slate-50 transition-all shadow-sm">
            <ArrowLeft size={24} />
          </button>
          <div>
              <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">{selectedCustomer.name}</h2>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Detailed Transaction Ledger</p>
          </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unpaid Amount</p>
                <p className="text-4xl font-black text-red-600 tracking-tighter">Rs.{customerHistory.filter(s => s.paymentStatus === 'Pending').reduce((acc, s) => acc + s.total, 0).toLocaleString()}</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Billing</p>
                <p className="text-4xl font-black text-slate-900 tracking-tighter">Rs.{customerHistory.reduce((acc, s) => acc + s.total, 0).toLocaleString()}</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Bills Issued</p>
                <p className="text-4xl font-black text-cyan-600 tracking-tighter">{customerHistory.length}</p>
            </div>
       </div>

       <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-8 py-6 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs flex items-center gap-2"><History size={16} /> Transaction History</h3>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chronological Order</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead>
                    <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b">
                        <th className="px-8 py-5">Date</th>
                        <th className="px-8 py-5">Bill Summary</th>
                        <th className="px-8 py-5 text-right">Invoice Total</th>
                        <th className="px-8 py-5 text-center">Status</th>
                        <th className="px-8 py-5 text-right">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {customerHistory.map(sale => (
                        <tr key={sale.id} className="hover:bg-slate-50/50">
                            <td className="px-8 py-6">
                                <p className="font-black text-slate-900 text-sm">{new Date(sale.date).toLocaleDateString()}</p>
                                <p className="text-[10px] text-slate-400 font-bold">#{sale.id.slice(-6).toUpperCase()}</p>
                            </td>
                            <td className="px-8 py-6">
                                <p className="text-xs font-bold text-slate-600 uppercase truncate max-w-xs">
                                    {sale.items.map(i => `${i.name} (x${i.quantity})`).join(', ')}
                                </p>
                            </td>
                            <td className="px-8 py-6 text-right font-black text-slate-900 text-lg">Rs.{sale.total.toLocaleString()}</td>
                            <td className="px-8 py-6 text-center">
                                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                    sale.paymentStatus === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}>
                                    {sale.paymentStatus}
                                </span>
                            </td>
                            <td className="px-8 py-6 text-right">
                                {sale.paymentStatus === 'Pending' ? (
                                    <button 
                                        onClick={() => handleSettle(sale)} 
                                        className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md transition-all active:scale-95"
                                    >
                                        Settle Now
                                    </button>
                                ) : (
                                    <CheckCircle size={20} className="text-green-500 ml-auto" />
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>
       </div>
    </div>
  );
};