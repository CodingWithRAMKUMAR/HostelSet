import { useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export function useOwnerRooms(property, rooms, setRooms, setStats) {
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [roomForm, setRoomForm] = useState({ room_number:'', sharing_type:'double', monthly_rent:10000, room_audience:'coliving' });
  const sharingTypes = [ 
    { value:'single', label:'Single Sharing', capacity:1, icon:'👤', price:15000 }, 
    { value:'double', label:'Double Sharing', capacity:2, icon:'👥', price:10000 }, 
    { value:'triple', label:'Triple Sharing', capacity:3, icon:'👥👤', price:8000 }, 
    { value:'four', label:'Four Sharing', capacity:4, icon:'👥👥', price:7000 }, 
    { value:'five', label:'Five Sharing', capacity:5, icon:'👥👥👤', price:6000 } 
  ];

  // --- Add a new room ---
  const addRoom = async (isSubmitting, setIsSubmitting) => {
    if (isSubmitting) return;
    if (!roomForm.room_number) { toast.error('Enter room number'); return; }
    if (rooms.some(r => r.room_number === roomForm.room_number)) { toast.error(`Room ${roomForm.room_number} already exists!`); return; }
    
    setIsSubmitting(true);
    const selectedType = sharingTypes.find(t => t.value === roomForm.sharing_type);
    const { data: insertedRoom, error } = await supabase.from('rooms').insert({
      property_id: property.id, 
      room_number: roomForm.room_number, 
      sharing_type: roomForm.sharing_type,
      monthly_rent: parseInt(roomForm.monthly_rent)||selectedType.price, 
      deposit_amount: 3000,
      room_audience: roomForm.room_audience,
      capacity: selectedType.capacity,
      current_occupants: 0, 
      status: 'vacant'
    }).select().single();
    
    if (error) {
      toast.error('Failed to add room: ' + error.message);
    } else {
      toast.success(`Room ${roomForm.room_number} added!`);
      setShowRoomModal(false);
      setRoomForm({ room_number:'', sharing_type:'double', monthly_rent:10000, room_audience:'coliving' });
      setRooms(prev => [...prev, insertedRoom]);
      setStats(prev => ({ ...prev, totalRooms: prev.totalRooms + 1, vacant: prev.vacant + 1 }));
    }
    setIsSubmitting(false);
  };

  // --- Delete a room ---
  const deleteRoom = async (id, isSubmitting, setIsSubmitting) => {
    if (isSubmitting) return;
    const room = rooms.find(r => r.id === id);
    if (room.current_occupants > 0) { toast.error(`Cannot delete room with ${room.current_occupants} occupants`); return; }
    if (!confirm(`Delete Room ${room.room_number}?`)) return;
    
    setIsSubmitting(true);
    const { error } = await supabase.from('rooms').delete().eq('id', id);
    
    if (error) {
      toast.error('Failed to delete room');
    } else {
      toast.success('Room deleted');
      setRooms(prev => prev.filter(r => r.id !== id));
      setStats(prev => ({ ...prev, totalRooms: prev.totalRooms - 1, vacant: prev.vacant - 1 }));
    }
    setIsSubmitting(false);
  };

  return { 
    rooms, 
    showRoomModal, 
    setShowRoomModal, 
    roomForm, 
    setRoomForm, 
    sharingTypes, 
    addRoom, 
    deleteRoom 
  };
}
