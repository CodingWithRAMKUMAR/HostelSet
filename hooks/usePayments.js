import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { calculateCanonicalRentDue, isPendingRentPayment } from '../lib/rentDue';

export function usePayments(tenant, refreshData, owner) {
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [paymentsLoaded, setPaymentsLoaded] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [ownerUpiId, setOwnerUpiId] = useState('');
  const [ownerUpiPhone, setOwnerUpiPhone] = useState('');

  const loadPayments = async () => {
    if (!tenant?.id) return;
    const { data, error } = await supabase
      .from('payment_history')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('payment_date', { ascending: false });
    if (error) console.error('Payment history load failed:', error);
    else {
      setPaymentHistory(data || []);
      setPaymentsLoaded(true);
    }
  };

  const loadUPIDetails = async () => {
    if (!tenant?.property_id) return;
    const { data } = await supabase
      .from('owner_settings')
      .select('upi_id, upi_phone')
      .eq('property_id', tenant.property_id)
      .maybeSingle();
    setOwnerUpiId(data?.upi_id || tenant.property?.owner_upi_id || '');
    setOwnerUpiPhone(data?.upi_phone || owner?.phone || '');
  };

  const uploadFile = async (file, prefix) => {
    const fileName = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}.${file.name.split('.').pop()}`;
    const { data, error } = await supabase.storage
      .from('tenant-documents')
      .upload(fileName, file, { cacheControl: '3600' });
    if (error) throw error;
    return data.path;
  };

  const submitPaymentWithProof = async (paymentScreenshot, paymentTransactionId) => {
    if (!paymentScreenshot) { toast.error('Please upload payment screenshot'); return false; }
    if (!paymentTransactionId?.trim()) { toast.error('Please enter the UPI transaction ID'); return false; }
    if (!paymentScreenshot.type?.startsWith('image/') || paymentScreenshot.size > 5 * 1024 * 1024) {
      toast.error('Upload an image smaller than 5MB');
      return false;
    }
    if (paymentHistory.some(isPendingRentPayment)) {
      toast.error('A payment proof is already waiting for owner confirmation.');
      return false;
    }
    setPaymentLoading(true);
    try {
      const screenshotUrl = await uploadFile(paymentScreenshot, 'rent');
      const rentStatus = calculateCanonicalRentDue(tenant, paymentHistory);
      const amount = rentStatus.dueAmount || tenant.pending_amount || tenant.rent_amount;
      const { error: paymentError } = await supabase.from('payment_history').insert({
        tenant_id: tenant.id,
        amount: amount,
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'upi',
        status: 'payment_pending',
        payment_screenshot: screenshotUrl,
        upi_transaction_id: paymentTransactionId.trim()
      });
      if (paymentError) throw paymentError;
      toast.success('Payment proof submitted!');
      await loadPayments();
      return true;
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Failed to submit payment: ' + error.message);
      return false;
    } finally {
      setPaymentLoading(false);
    }
  };

  // Real-time payment updates
  useEffect(() => {
    if (!tenant?.id) return;
    setPaymentsLoaded(false);
    loadPayments();
    loadUPIDetails();

    const channel = supabase.channel('payments-tenant-isolated')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_history', filter: `tenant_id=eq.${tenant.id}` }, (payload) => {
        const changedPayment = payload.new || payload.old;
        if (changedPayment?.tenant_id !== tenant.id) return;
        setPaymentHistory(current => {
          if (payload.eventType === 'DELETE') return current.filter(payment => payment.id !== changedPayment.id);
          const index = current.findIndex(payment => payment.id === changedPayment.id);
          if (index === -1) return [changedPayment, ...current];
          return current.map(payment => payment.id === changedPayment.id ? { ...payment, ...changedPayment } : payment);
        });
        setPaymentsLoaded(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'owner_settings', filter: `owner_id=eq.${tenant.property?.owner_id}` }, () => {
        loadUPIDetails();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tenant?.id, tenant?.property_id, tenant?.property?.owner_id, tenant?.property?.owner_upi_id, owner?.phone]);

  return {
    paymentHistory,
    paymentsLoaded,
    paymentLoading,
    ownerUpiId,
    ownerUpiPhone,
    submitPaymentWithProof,
    loadUPIDetails
  };
}
