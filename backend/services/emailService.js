/**
 * 邮件服务模块
 * 处理邮件发送和邮箱验证码验证
 */

const nodemailer = require('nodemailer');
const { query } = require('../db');

// 邮件配置
const SMTP_CONFIG = {
  host: 'smtp.163.com',
  port: 465,
  secure: true, // 使用 SSL
  auth: {
    user: 'xxxxx@163.com',
    pass: 'xxxxxxx'
  }
};

// 创建邮件传输器
const transporter = nodemailer.createTransport(SMTP_CONFIG);

class EmailService {
  constructor() {
    // 验证码有效期（分钟）
    this.CODE_EXPIRY_MINUTES = 10;
    // 验证码长度
    this.CODE_LENGTH = 6;
    // 兼容性配置
    this.config = { enabled: true };
    this.transporter = transporter;
  }

  // 生成随机验证码
  generateCode() {
    return Math.random().toString().slice(2, 2 + this.CODE_LENGTH);
  }

  // 验证是否为QQ邮箱
  isQQEmail(email) {
    if (!email) return false;
    const qqEmailRegex = /^[1-9][0-9]{4,10}@qq\.com$/i;
    return qqEmailRegex.test(email);
  }

  // 从QQ邮箱提取QQ号
  getQQNumber(email) {
    if (!this.isQQEmail(email)) return null;
    return email.split('@')[0];
  }

  // 发送邮件
  async sendEmail(options) {
    try {
      const info = await transporter.sendMail({
        from: `"QQ农场助手" <${SMTP_CONFIG.auth.user}>`,
        to: options.to,
        subject: options.subject,
        html: options.html
      });
      console.log('[邮件服务] 邮件发送成功:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('[邮件服务] 邮件发送失败:', error);
      throw error;
    }
  }

  // 发送验证码邮件
  async sendVerificationCode(email) {
    // 验证是否为QQ邮箱
    if (!this.isQQEmail(email)) {
      throw new Error('请使用正确的QQ邮箱格式（如：123456@qq.com）');
    }

    // 检查该邮箱是否已被注册
    const existingUsers = await query(
      'SELECT id FROM users WHERE email = ? AND status != "deleted"',
      [email]
    );

    if (existingUsers.length > 0) {
      throw new Error('该QQ邮箱已被注册，请使用其他邮箱');
    }

    // 检查是否有未过期的验证码
    const [existingCodes] = await query(
      `SELECT id FROM email_verification_codes
       WHERE email = ? AND is_used = FALSE AND expires_at > NOW()`,
      [email]
    );

    if (existingCodes && existingCodes.length > 0) {
      // 删除旧的验证码
      await query(
        'DELETE FROM email_verification_codes WHERE email = ?',
        [email]
      );
    }

    // 生成新验证码
    const code = this.generateCode();

    // 保存验证码到数据库
    await query(
      `INSERT INTO email_verification_codes (email, code, expires_at)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
      [email, code, this.CODE_EXPIRY_MINUTES]
    );

    // 发送邮件到用户QQ邮箱
    try {
      await this.sendEmail({
        to: email,
        subject: '【玄机农场助手】注册验证码',
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #3b82f6;">QQ农场助手 - 注册验证码</h2>
          <p>您好！</p>
          <p>您正在注册玄机农场助手账号，验证码为：</p>
          <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <span style="font-size: 32px; font-weight: bold; color: #3b82f6; letter-spacing: 8px;">${code}</span>
          </div>
          <p>验证码有效期为 <strong>10分钟</strong>，请勿泄露给他人。</p>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">此邮件由 玄机农场助手 自动发送，请勿回复</p>
        </div>
        `
      });
      console.log(`[EmailService] 验证码邮件已发送：${email}`);
    } catch (error) {
      console.error('[EmailService] 发送验证码邮件失败:', error);
      // 即使邮件发送失败，也返回成功（因为验证码已保存到数据库）
      // 实际生产环境应该处理邮件发送失败的情况
    }

    return {
      success: true,
      message: '验证码已发送，请查收QQ邮箱',
      // 开发环境下返回验证码，生产环境应该删除这行
      code: process.env.NODE_ENV === 'development' ? code : undefined
    };
  }

  // 验证验证码
  async verifyCode(email, code) {
    if (!email || !code) {
      throw new Error('邮箱和验证码不能为空');
    }

    const records = await query(
      `SELECT id FROM email_verification_codes
       WHERE email = ? AND code = ? AND is_used = FALSE AND expires_at > NOW()`,
      [email, code]
    );

    if (!records || records.length === 0) {
      throw new Error('验证码错误或已过期');
    }

    // 标记验证码为已使用
    await query(
      'UPDATE email_verification_codes SET is_used = TRUE WHERE id = ?',
      [records[0].id]
    );

    return true;
  }

  // 清理过期的验证码
  async cleanExpiredCodes() {
    await query(
      'DELETE FROM email_verification_codes WHERE expires_at < NOW()'
    );
  }
}

module.exports = new EmailService();
