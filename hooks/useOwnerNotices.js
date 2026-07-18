import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { deleteImage, supabase, uploadImage } from '../lib/supabase'
import { useRealtimeRefresh } from './useRealtimeRefresh'

export function useOwnerNotices(property, enabled = true) {
  const [notices, setNotices] = useState([])

  const loadNotices = async () => {
    if (!property?.id) return

    const { data, error } = await supabase
      .from('notices')
      .select('*')
      .or(`property_id.eq.${property.id},property_id.is.null`)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Owner notices load failed:', error.message)
      return
    }

    setNotices(data || [])
  }

  const postNotice = async (title, content, type, isUrgent, imageFile = null) => {
    if (!property?.id) {
      toast.error('Property information is not ready. Please try again.')
      return false
    }

    if (!title?.trim() || !content?.trim()) {
      toast.error('Please fill both title and content')
      return false
    }

    let imageUrl = null

    try {
      if (imageFile) {
        imageUrl = await uploadImage(imageFile, `${property.id}/notice-images`)
      }

      const { error } = await supabase.from('notices').insert({
        property_id: property.id,
        title: title.trim(),
        content: content.trim(),
        type,
        is_urgent: Boolean(isUrgent),
        image_url: imageUrl,
        created_at: new Date().toISOString(),
      })

      if (error) throw error

      toast.success('Notice posted!')
      await loadNotices()
      return true
    } catch (error) {
      if (imageUrl) await deleteImage(imageUrl)
      console.error('Owner notice post failed:', error)
      toast.error('Failed to post notice: ' + (error?.message || 'Unknown error'))
      return false
    }
  }

  const deleteNotice = async noticeId => {
    if (!confirm('Delete this notice?')) return false

    const existingNotice = notices.find(notice => notice.id === noticeId)
    if (!existingNotice?.property_id) {
      toast.error('HostelSet global notices can only be deleted by an admin.')
      return false
    }

    const { error } = await supabase
      .from('notices')
      .delete()
      .eq('id', noticeId)
      .eq('property_id', property.id)

    if (error) {
      toast.error('Failed to delete notice')
      return false
    }

    if (existingNotice.image_url) {
      const imageDeleted = await deleteImage(existingNotice.image_url)
      if (!imageDeleted) console.warn('Notice deleted, but its stored image could not be removed.')
    }

    toast.success('Notice deleted')
    await loadNotices()
    return true
  }

  useEffect(() => {
    setNotices([])
    if (property?.id && enabled) loadNotices()
  }, [property?.id, enabled])

  useRealtimeRefresh(
    `owner-notices-live:${property?.id || 'waiting'}`,
    ['notices'],
    loadNotices,
    Boolean(property?.id && enabled),
  )

  return { notices, postNotice, deleteNotice }
}
