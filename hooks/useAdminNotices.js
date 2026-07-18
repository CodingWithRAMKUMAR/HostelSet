import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { deleteImage, supabase, uploadImage } from '../lib/supabase'
import { useRealtimeRefresh } from './useRealtimeRefresh'

export function useAdminNotices(enabled = true) {
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(true)

  const loadNotices = async (background = false) => {
    if (!enabled) return false
    if (!background) setLoading(true)
    const { data, error } = await supabase
      .from('notices')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Admin notices load failed:', error)
      if (!background) toast.error('Failed to load notices')
      setLoading(false)
      return false
    }

    setNotices(data || [])
    setLoading(false)
    return data || []
  }

  const postNotice = async (title, content, type, isUrgent, imageFile = null) => {
    if (!title || !content) {
      toast.error('Please fill both title and content')
      return false
    }

    let imageUrl = null
    try {
      if (imageFile) imageUrl = await uploadImage(imageFile, 'notice-images')

      const { error } = await supabase.from('notices').insert({
        property_id: null,
        title,
        content,
        type,
        is_urgent: Boolean(isUrgent),
        image_url: imageUrl,
        created_at: new Date().toISOString(),
      })

      if (error) throw error
      toast.success('Global notice posted!')
      await loadNotices(true)
      return true
    } catch (error) {
      if (imageUrl) await deleteImage(imageUrl)
      console.error('Admin notice post failed:', error)
      toast.error('Failed to post notice: ' + (error?.message || 'Unknown error'))
      return false
    }
  }

  const deleteNotice = async noticeId => {
    if (!confirm('Delete this global notice?')) return false
    const existingNotice = notices.find(notice => notice.id === noticeId)
    const { error } = await supabase.from('notices').delete().eq('id', noticeId)

    if (error) {
      toast.error('Failed to delete notice')
      return false
    }

    if (existingNotice?.image_url) {
      const imageDeleted = await deleteImage(existingNotice.image_url)
      if (!imageDeleted) console.warn('Notice deleted, but its stored image could not be removed.')
    }

    toast.success('Notice deleted.')
    await loadNotices(true)
    return true
  }

  useEffect(() => {
    if (enabled) loadNotices(false)
  }, [enabled])

  useRealtimeRefresh('admin-notices-live', ['notices'], loadNotices, enabled)

  return {
    notices,
    loading,
    postNotice,
    deleteNotice,
    refreshNotices: loadNotices,
  }
}
