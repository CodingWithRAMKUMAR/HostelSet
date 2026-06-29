import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export function usePayments(tenant, refreshData) {
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [ownerUpiId, setOwnerUpiId] = useState('');
  const [ownerUpiPhone, setOwnerUpiPhone] = useState('');

  const loadPayments = async () => {
    if (!tenant?.id) return;
    const { data } = await supabase
      .from('payment_history')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('payment_date', { ascending: false });
    setPaymentHistory(data || []);
  };

  const loadUPIDetails = async () => {
    if (!tenant?.property?.owner_id) return;
    const { data } = await supabase
      .from('owner_settings')
      .select('upi_id, upi_phone')
      .eq('owner_id', tenant.property.owner_id)
      .maybeSingle();
    setOwnerUpiId(data?.upi_id || tenant.property?.owner_upi_id || '');
    setOwnerUpiPhone(data?.upi_phone || '');
  };

  const uploadFile = async (file, prefix) => {
    const fileName = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}.${file.name.split('.').pop()}`;
    const { data, error } = await supabase.storage
      .from('tenant-documents')
      .upload(fileName, file, { cacheControl: '3600' });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('tenant-documents').getPublicUrl(fileName);
    return publicUrl;
  };

  const submitPaymentWithProof = async (paymentScreenshot, paymentTransactionId) => {
    if (!paymentScreenshot) { toast.error('Please upload payment screenshot'); return false; }
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
        upi_transaction_id: paymentTransactionId || null
      });
      if (paymentError) throw paymentError;
      toast.success('Payment proof submitted!');
      await refreshData(true);
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
    loadPayments();
    loadUPIDetails();

    const channel = supabase.channel('payments-tenant-isolated')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_history' }, (payload) => {
        loadPayments();
        if (payload.eventType === 'UPDATE' && payload.new?.tenant_id === tenant.id) refreshData(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'owner_settings', filter: `owner_id=eq.${tenant.property?.owner_id}` }, () => {
        loadUPIDetails();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tenant?.id, tenant?.property?.owner_id, tenant?.property?.owner_upi_id]);

  return {
    paymentHistory,
    paymentLoading,
    ownerUpiId,
    ownerUpiPhone,
    submitPaymentWithProof,
    loadUPIDetails
  };
}
