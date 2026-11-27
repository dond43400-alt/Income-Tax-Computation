import React, { useState } from 'react';
import { X, Building2, Save, Sparkles } from 'lucide-react';
import { FirmDetails } from '../types';

interface FirmSettingsModalProps {
  firm: FirmDetails;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: FirmDetails) => void;
}

export const FirmSettingsModal: React.FC<FirmSettingsModalProps> = ({
  firm,
  isOpen,
  onClose,
  onSave,
}) => {
  if (!isOpen) return null;

  const [formData, setFormData] = useState<FirmDetails>({ ...firm });

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto no-print">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="font-bold text-base">Firm & Letterhead Settings</h3>
              <p className="text-[11px] text-slate-300">
                This appears on top of every printed Computation Sheet
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Firm / Office Name (ਲੇਟਰਹੈੱਡ ਨਾਮ)
            </label>
            <input
              type="text"
              value={formData.firmName}
              onChange={(e) => setFormData({ ...formData, firmName: e.target.value })}
              placeholder="e.g. SHARMA & ASSOCIATES TAX CONSULTANTS"
              className="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:border-blue-500 font-semibold text-slate-900 uppercase"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Practitioner Name</label>
              <input
                type="text"
                value={formData.practitionerName}
                onChange={(e) => setFormData({ ...formData, practitionerName: e.target.value })}
                placeholder="e.g. Adv. Rajesh Sharma"
                className="w-full p-2 border border-slate-300 rounded-xl outline-none focus:border-blue-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Designation</label>
              <input
                type="text"
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                placeholder="e.g. Tax Consultant / CA"
                className="w-full p-2 border border-slate-300 rounded-xl outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Reg. / Membership No.</label>
              <input
                type="text"
                value={formData.registrationNo}
                onChange={(e) => setFormData({ ...formData, registrationNo: e.target.value })}
                placeholder="e.g. ITP/PB/2018/4821"
                className="w-full p-2 border border-slate-300 rounded-xl outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Phone / Mobile No.</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 98765 43210"
                className="w-full p-2 border border-slate-300 rounded-xl outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Email Address</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="e.g. taxconsultant@gmail.com"
              className="w-full p-2 border border-slate-300 rounded-xl outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Office Address</label>
            <textarea
              rows={2}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Shop / Office No, Road, City, Punjab - Pincode"
              className="w-full p-2 border border-slate-300 rounded-xl outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200 transition text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition"
          >
            <Save className="w-4 h-4" />
            <span>Save Letterhead</span>
          </button>
        </div>

      </div>
    </div>
  );
};
