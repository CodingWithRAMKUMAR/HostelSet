import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { cleanPhoneNumber } from '../lib/utils';
import toast from 'react-hot-toast';

export function useOwnerTenants(property, rooms, tenants, setTenants, setStats, loadData) {
  const [formData, setFormData] = useState({ name:'', phone:'', email:'', blood_group:'', rent_amount:'', room_id:'', advance_amount:'0', joining_fee:'0', profile_photo_file:null });

  const uploadProfilePhoto = async (tenantId, file, session) => {
    if (!file) return null
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Profile photo must be a JPEG, PNG, or WEBP image')
    if (file.size > 5 * 1024 * 1024) throw new Error('Profile photo must be under 5MB')
    const preparedResponse = await fetch('/api/owner/tenant-profile-photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ action: 'upload-url', tenantId, contentType: file.type, size: file.size }),
    })
    const prepared = await preparedResponse.json().catch(() => ({}))
    if (!preparedResponse.ok) throw new Error(prepared.error || 'Unable to prepare profile photo upload')
    const { error: uploadError } = await supabase.storage.from('tenant-documents').uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type })
    if (uploadError) throw new Error('Profile photo upload failed. Please try again.')
    const updateResponse = await fetch('/api/owner/tenant-profile-photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ action: 'update', tenantId, path: prepared.path }),
    })
    const updated = await updateResponse.json().catch(() => ({}))
    if (!updateResponse.ok) throw new Error(updated.error || 'Unable to save profile photo')
    return prepared.path
  };

  const addTenant = async (isSubmitting, setIsSubmitting) => {
    if (isSubmitting) return;
    if (!formData.name || !formData.phone || !formData.email || !formData.blood_group || !formData.rent_amount || !formData.room_id) { toast.error('Please fill all required fields, including blood group'); return; }
    if (formData.profile_photo_file && (!['image/jpeg', 'image/png', 'image/webp'].includes(formData.profile_photo_file.type) || formData.profile_photo_file.size > 5 * 1024 * 1024)) {
      toast.error('Profile photo must be a JPEG, PNG, or WEBP image under 5MB');
      return;
    }
    const cleanPhone = cleanPhoneNumber(formData.phone);
    if (cleanPhone.length !== 10) { toast.error('Enter valid 10-digit phone number'); return; }
    const selectedRoom = rooms.find(r => r.id === formData.room_id);
    if (!selectedRoom) { toast.error('Selected room not found'); return; }
    if (selectedRoom.current_occupants >= selectedRoom.capacity) { toast.error(`Room ${selectedRoom.room_number} is full!`); return; }
    setIsSubmitting(true);
    try {
      const tenantEmail = formData.email.trim().toLowerCase();
      const joiningFee = Number(formData.joining_fee || 0);
      const advanceMonths = Number(formData.advance_amount || 0);
      const monthlyRent = Number(formData.rent_amount);
      if (!Number.isFinite(monthlyRent) || monthlyRent <= 0 || !Number.isInteger(advanceMonths) || advanceMonths < 0 || !Number.isFinite(joiningFee) || joiningFee < 0) {
        throw new Error('Enter valid rent, advance months, and joining fee');
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Your session expired. Please log in again.');
      const response = await fetch('/api/owner/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          propertyId: property.id,
          roomId: selectedRoom.id,
          name: formData.name,
          phone: cleanPhone,
          email: tenantEmail,
          bloodGroup: formData.blood_group,
          monthlyRent,
          advanceMonths,
          joiningFee,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Tenant registration failed');
      if (formData.profile_photo_file && result.tenantId) {
        try {
          await uploadProfilePhoto(result.tenantId, formData.profile_photo_file, session);
        } catch (photoError) {
          toast.error(`Tenant added, but profile photo was not saved: ${photoError.message}`);
        }
      }
      toast.success(result.emailSent ? `Tenant "${formData.name}" added and invited!` : `Tenant "${formData.name}" added. Password email can be resent.`);
      setFormData({ name:'', phone:'', email:'', blood_group:'', rent_amount:'', room_id:'', advance_amount:'0', joining_fee:'0', profile_photo_file:null });
      await loadData(true);
    } catch (error) { toast.error('Failed to add tenant: ' + error.message); }
    finally { setIsSubmitting(false); }
  };

  return { tenants, formData, setFormData, addTenant };
}
