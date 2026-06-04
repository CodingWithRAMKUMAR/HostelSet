import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yzfggwnkawicwlniflnn.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6Zmdnd25rYXdpY3dsbmlmbG5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMzQxNjYsImV4cCI6MjA5NTYxMDE2Nn0.FGm5Xo35eM2Ms-fNKnTtmop1W_55bpFMYIM09W3M0nk'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)


// Upload image to Supabase Storage
export async function uploadImage(file, folder = 'property-images') {
  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
  const filePath = `${folder}/${fileName}`

  const { error, data } = await supabase.storage
    .from('hostelset-images')
    .upload(filePath, file)

  if (error) throw error

  const { data: { publicUrl } } = supabase.storage
    .from('hostelset-images')
    .getPublicUrl(filePath)

  return publicUrl
}

// Delete image from Supabase Storage
export async function deleteImage(imageUrl) {
  const path = imageUrl.split('/').pop()
  const { error } = await supabase.storage
    .from('hostelset-images')
    .remove([`property-images/${path}`])
  
  if (error) console.error('Delete image error:', error)
}
