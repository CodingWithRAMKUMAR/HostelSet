import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { cleanPhoneNumber } from '../lib/utils';
import toast from 'react-hot-toast';

export function useOwnerTenants(property, rooms, tenants, setTenants, setStats, loadData) {
  const [formData, setFormData] = useState({ name:'', phone:'', email:'', rent_amount:'', room_id:'', advance_amount:'0', joining_fee:'0' });

  const addTenant = async (isSubmitting, setIsSubmitting) => {
    if (isSubmitting) return;
    if (!formData.name || !formData.phone || !formData.email || !formData.rent_amount || !formData.room_id) { toast.error('Please fill all fields'); return; }
    const cleanPhone = cleanPhoneNumber(formData.phone);
    if (cleanPhone.length !== 10) { toast.error('Enter valid 10-digit phone number'); return; }
    const selectedRoom = rooms.find(r => r.id === formData.room_id);
    if (!selectedRoom) { toast.error('Selected room not found'); return; }
    if (selectedRoom.current_occupants >= selectedRoom.capacity) { toast.error(`Room ${selectedRoom.room_number} is full!`); return; }
    setIsSubmitting(true);
    try {
      const tenantEmail = formData.email.trim(); const joiningFee = parseInt(formData.joining_fee)||0; const advanceMonths = parseInt(formData.advance_amount)||0; const monthlyRent = parseInt(formData.rent_amount);
      const totalJoiningAmount = (monthlyRent * advanceMonths) + joiningFee;
      const { data:authData, error:authError } = await supabase.auth.signUp({ email:tenantEmail, password:Math.random().toString(36).slice(-8), options:{ data:{ full_name:formData.name, role:'tenant', phone:cleanPhone } } });
      if (authError) throw authError;
      const userId = authData.user.id;
      await supabase.from('users').insert({ id:userId, email:tenantEmail, full_name:formData.name, phone:cleanPhone, role:'tenant', is_active:true });
      const pendingAmount = advanceMonths > 0 ? 0 : monthlyRent; const rentStatus = advanceMonths > 0 ? 'paid' : 'pending';
      const { data:newTenant, error:tenantError } = await supabase.from('tenants').insert({ user_id:userId, property_id:property.id, room_id:selectedRoom.id, name:formData.name, phone:cleanPhone, email:tenantEmail, rent_amount:monthlyRent, pending_amount:pendingAmount, total_paid:totalJoiningAmount, rent_status:rentStatus, move_in_date:new Date().toISOString().split('T')[0], status:'active' }).select().single();
      if (tenantError) throw tenantError;
      if (totalJoiningAmount > 0 && newTenant) { await supabase.from('payment_history').insert({ tenant_id:newTenant.id, amount:totalJoiningAmount, payment_date:new Date().toISOString().split('T')[0], payment_method:'advance', status:'success' }); }
      await supabase.from('rooms').update({ current_occupants: selectedRoom.current_occupants + 1, status: selectedRoom.current_occupants + 1 >= selectedRoom.capacity ? 'occupied' : 'vacant' }).eq('id', selectedRoom.id);
      await supabase.auth.resetPasswordForEmail(tenantEmail, { redirectTo:`${window.location.origin}/reset-password` }).catch(e => console.warn);
      toast.success(`Tenant "${formData.name}" added!`);
      setFormData({ name:'', phone:'', email:'', rent_amount:'', room_id:'', advance_amount:'0', joining_fee:'0' });
      await loadData(true);
    } catch (error) { toast.error('Failed to add tenant: ' + error.message); }
    finally { setIsSubmitting(false); }
  };

  return { tenants, formData, setFormData, addTenant };
}
