import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yzfggwnkawicwlniflnn.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6Zmdnd25rYXdpY3dsbmlmbG5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMzQxNjYsImV4cCI6MjA5NTYxMDE2Nn0.FGm5Xo35eM2Ms-fNKnTtmop1W_55bpFMYIM09W3M0nk'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
})

// Fixed upload image function with proper error handling
export const uploadImage = async (file, folder = 'property-photos') => {
  try {
    if (!file) throw new Error('No file provided')
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Only JPEG, PNG, WEBP, and GIF images are allowed')
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Image size must be less than 5MB')
    }
    
    // Generate unique filename
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`
    const filePath = `${folder}/${fileName}`
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('property-photos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type
      })
    
    if (error) {
      console.error('Storage upload error:', error)
      throw new Error(error.message)
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('property-photos')
      .getPublicUrl(filePath)
    
    return publicUrl
    
  } catch (error) {
    console.error('Upload function error:', error)
    throw error
  }
}

// Delete image from storage
export const deleteImage = async (imageUrl) => {
  try {
    // Extract file path from URL
    const urlParts = imageUrl.split('/')
    const filePath = urlParts.slice(urlParts.indexOf('property-photos') + 1).join('/')
    
    const { error } = await supabase.storage
      .from('property-photos')
      .remove([filePath])
    
    if (error) throw error
    return true
    
  } catch (error) {
    console.error('Delete image error:', error)
    return false
  }
}
