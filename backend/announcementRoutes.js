const express = require('express');
const router = express.Router();
const announcementService = require('./announcementService');
const { authMiddleware, adminMiddleware } = require('./authMiddleware');

// 获取所有公告（管理员）
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const announcements = await announcementService.getAllAnnouncements();
    res.json({ success: true, announcements });
  } catch (error) {
    console.error('获取公告列表失败:', error);
    res.status(500).json({ success: false, message: '获取公告列表失败' });
  }
});

// 创建公告（管理员）
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { title, content, intervalHours } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ success: false, message: '标题和内容不能为空' });
    }
    
    const id = await announcementService.createAnnouncement({
      title,
      content,
      intervalHours: intervalHours || 24
    });
    
    res.json({ success: true, id, message: '公告创建成功' });
  } catch (error) {
    console.error('创建公告失败:', error);
    res.status(500).json({ success: false, message: '创建公告失败' });
  }
});

// 更新公告（管理员）
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, intervalHours, isActive } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ success: false, message: '标题和内容不能为空' });
    }
    
    await announcementService.updateAnnouncement(id, {
      title,
      content,
      intervalHours: intervalHours || 24,
      isActive: isActive !== undefined ? isActive : true
    });
    
    res.json({ success: true, message: '公告更新成功' });
  } catch (error) {
    console.error('更新公告失败:', error);
    res.status(500).json({ success: false, message: '更新公告失败' });
  }
});

// 删除公告（管理员）
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await announcementService.deleteAnnouncement(id);
    res.json({ success: true, message: '公告删除成功' });
  } catch (error) {
    console.error('删除公告失败:', error);
    res.status(500).json({ success: false, message: '删除公告失败' });
  }
});

// 获取启用的公告列表（用户用）
router.get('/active', authMiddleware, async (req, res) => {
  try {
    const announcements = await announcementService.getActiveAnnouncements();
    res.json({ success: true, announcements });
  } catch (error) {
    console.error('获取公告失败:', error);
    res.status(500).json({ success: false, message: '获取公告失败' });
  }
});

module.exports = router;
