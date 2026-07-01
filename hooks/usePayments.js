import { useState, useEffect } from 'react';
import { signPrivateDocumentFields, supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

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
      setPaymentHistory(await Promise.all((data || []).map(payment => signPrivateDocumentFields(payment, ['payment_screenshot']))));
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
    if (paymentHistory.some((payment) => payment.status === 'payment_pending')) {
      toast.error('A payment proof is already waiting for owner confirmation.');
      return false;
    }
    setPaymentLoading(true);
    try {
      const screenshotUrl = await uploadFile(paymentScreenshot, 'rent');
      const amount = tenant.pending_amount || tenant.rent_amount;
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
      await Promise.all([loadPayments(), refreshData(true)]);
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
        loadPayments();
        if (payload.eventType === 'UPDATE' && payload.new?.tenant_id === tenant.id) refreshData(true);
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
