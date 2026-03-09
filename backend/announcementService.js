const { query } = require('./db');

class AnnouncementService {
  // 获取所有公告（管理员用）
  async getAllAnnouncements() {
    const sql = `
      SELECT * FROM announcements
      ORDER BY created_at DESC
    `;
    return await query(sql);
  }

  // 获取启用的公告列表（用户用）
  async getActiveAnnouncements() {
    const sql = `
      SELECT * FROM announcements
      WHERE is_active = TRUE
      ORDER BY created_at DESC
    `;
    return await query(sql);
  }

  // 创建公告
  async createAnnouncement({ title, content, intervalHours = 24 }) {
    const sql = `
      INSERT INTO announcements (title, content, interval_hours)
      VALUES (?, ?, ?)
    `;
    const result = await query(sql, [title, content, intervalHours]);
    return result.insertId;
  }

  // 更新公告
  async updateAnnouncement(id, { title, content, intervalHours, isActive }) {
    const sql = `
      UPDATE announcements 
      SET title = ?, content = ?, interval_hours = ?, is_active = ?
      WHERE id = ?
    `;
    await query(sql, [title, content, intervalHours, isActive, id]);
    return true;
  }

  // 删除公告
  async deleteAnnouncement(id) {
    const sql = `DELETE FROM announcements WHERE id = ?`;
    await query(sql, [id]);
    return true;
  }

  // 获取单个公告
  async getAnnouncementById(id) {
    const sql = `SELECT * FROM announcements WHERE id = ?`;
    const results = await query(sql, [id]);
    return results[0] || null;
  }
}

module.exports = new AnnouncementService();
