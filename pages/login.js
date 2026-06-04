// pages/login.js - Fixed version
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';
import { Phone, Home, Building2, ArrowRight, CheckCircle } from 'lucide-react';

export default function Login() {
  const router = useRouter();
  const { role: urlRole } = router.query;
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState(urlRole || 'tenant');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (urlRole && (urlRole === 'owner' || urlRole === 'tenant')) {
      setSelectedRole(urlRole);
    }
  }, [urlRole]);

  const sendOTP = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      setMessage('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const fullPhone = phoneNumber.startsWith('+91') ? phoneNumber : `+91${phoneNumber}`;
      const { error } = await supabase.auth.signInWithOtp({
        phone: fullPhone,
      });

      if (error) throw error;
      
      setShowOtpInput(true);
      setMessage('OTP sent successfully! Demo OTP: 123456');
    } catch (error) {
      setMessage('Failed to send OTP. Please try again.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      setMessage('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const fullPhone = phoneNumber.startsWith('+91') ? phoneNumber : `+91${phoneNumber}`;
      const { data, error } = await supabase.auth.verifyOtp({
        phone: fullPhone,
        token: otp,
        type: 'sms',
      });

      if (error) throw error;

      if (data.user) {
        const cleanPhone = phoneNumber.replace(/\D/g, '');
        const { data: existingUser } = await supabase
          .from('users')
          .select('*')
          .eq('phone', cleanPhone)
          .single();

        if (!existingUser) {
          const { error: insertError } = await supabase
            .from('users')
            .insert([
              {
                phone: cleanPhone,
                name: `User ${cleanPhone.slice(-4)}`,
                role: selectedRole,
              },
            ]);

          if (insertError) throw insertError;
        } else {
          if (existingUser.role !== selectedRole) {
            const { error: updateError } = await supabase
              .from('users')
              .update({ role: selectedRole })
              .eq('phone', cleanPhone);
            
            if (updateError) throw updateError;
          }
        }

        localStorage.setItem('userRole', selectedRole);
        localStorage.setItem('userPhone', cleanPhone);

        if (selectedRole === 'owner') {
          router.push('/owner/dashboard');
        } else {
          const { data: tenantData } = await supabase
            .from('tenants')
            .select('room_id')
            .eq('phone', cleanPhone)
            .single();

          if (tenantData?.room_id) {
            router.push('/tenant/dashboard');
          } else {
            router.push('/tenant/waiting');
          }
        }
      }
    } catch (error) {
      setMessage('Invalid OTP. Please try again.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <Home className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome to HostelSet</h1>
          <p className="text-slate-600 mt-2">Sign in to continue</p>
        </div>

        {!showOtpInput ? (
          <>
            <div className="mb-6">
              <label className="block text-slate-700 font-medium mb-2">Select Role</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSelectedRole('tenant')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedRole === 'tenant'
                      ? 'border-slate-900 bg-slate-50 text-slate-900'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <Building2 className="w-6 h-6 mx-auto mb-2" />
                  <div className="font-medium">Tenant</div>
                  <div className="text-xs">Find a hostel</div>
                </button>
                <button
                  onClick={() => setSelectedRole('owner')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedRole === 'owner'
                      ? 'border-slate-900 bg-slate-50 text-slate-900'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <Home className="w-6 h-6 mx-auto mb-2" />
                  <div className="font-medium">Owner</div>
                  <div className="text-xs">List property</div>
                </button>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-slate-700 font-medium mb-2">Phone Number</label>
              <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-slate-900">
                <span className="px-3 py-3 bg-slate-50 text-slate-600 border-r border-slate-200">+91</span>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="9876543210"
                  className="flex-1 px-4 py-3 outline-none"
                />
              </div>
            </div>

            <button
              onClick={sendOTP}
              disabled={loading}
              className="w-full bg-slate-900 text-white py-3 rounded-lg font-semibold hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </>
        ) : (
          <>
            <div className="mb-6">
              <label className="block text-slate-700 font-medium mb-2">Enter OTP</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                className="w-full px-4 py-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-slate-900"
                autoFocus
              />
              <p className="text-sm text-slate-500 mt-2">
                Demo OTP: 123456
              </p>
            </div>

            <button
              onClick={verifyOTP}
              disabled={loading}
              className="w-full bg-slate-900 text-white py-3 rounded-lg font-semibold hover:bg-slate-800 transition-all disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify & Login'}
            </button>

            <button
              onClick={() => setShowOtpInput(false)}
              className="w-full text-slate-600 py-2 mt-3 text-sm hover:text-slate-900"
            >
              ← Back to phone number
            </button>
          </>
        )}

        {message && (
          <div className={`mt-4 p-3 rounded-lg text-center text-sm ${
            message.includes('successfully') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
          }`}>
            {message}
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-slate-200 text-center">
          <p className="text-sm text-slate-500">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </motion.div>
    </div>
  );
}
